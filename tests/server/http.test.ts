// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanPatchSchema, PlanInputSchema } from "@/lib/contracts";
import type { ErrorBody } from "@/lib/contracts";
import { resetRateLimits } from "@/lib/security/rate-limit";
import {
  invalid,
  json,
  perIpLimit,
  problem,
  readBody,
  requestId,
  runGuards,
  sameOrigin,
  toIssues,
  withRoute,
} from "@/lib/server/http";

beforeEach(() => resetRateLimits());
afterEach(() => vi.unstubAllEnvs());

const errorBody = async (res: Response) => (await res.json()) as ErrorBody;

const post = (headers: Record<string, string> = {}, body?: string) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json", ...headers },
    body,
  });

describe("responses", () => {
  it("never caches JSON and wraps errors as { error }", async () => {
    const res = json({ a: 1 }, { status: 201, headers: { Location: "/x" } });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("location")).toBe("/x");
    const err = problem(429, "Slow down", { "Retry-After": "3" });
    expect(await errorBody(err)).toEqual({ error: "Slow down" });
    expect(err.headers.get("retry-after")).toBe("3");
  });

  it("turns Zod issues into { path, message } pairs", async () => {
    const parsed = PlanInputSchema.safeParse({ eventType: "party" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const issues = toIssues(parsed.error);
    expect(issues.some((issue) => issue.path === "eventType")).toBe(true);
    const body = await errorBody(invalid(issues));
    expect(body.error).toMatch(/another look/);
    expect(body.issues).toEqual(issues);
  });
});

describe("readBody", () => {
  it("returns the validated body", async () => {
    const body = await readBody(post({}, '{"tasks":[]}'), 1024, PlanPatchSchema);
    expect(body).toEqual({ ok: true, data: { tasks: [] } });
  });

  it("answers 415, 413 and 400 for unreadable or invalid bodies", async () => {
    const cases: [Request, number][] = [
      [post({ "content-type": "text/plain" }, "{}"), 415],
      [post({}, JSON.stringify({ tasks: [], pad: "x".repeat(2000) })), 413],
      [post({}, "{oops"), 400],
      [post({}, '{"tasks":[],"hack":1}'), 400],
    ];
    for (const [req, status] of cases) {
      const body = await readBody(req, 1024, PlanPatchSchema);
      expect(body.ok ? 200 : body.response.status).toBe(status);
    }
  });
});

describe("guards", () => {
  it("blocks cross-site writes", () => {
    const res = runGuards(post({ origin: "https://evil.example" }), sameOrigin);
    expect(res?.status).toBe(403);
    expect(runGuards(post(), sameOrigin)).toBeNull();
  });

  it("rate-limits per IP and sets Retry-After", () => {
    const guard = perIpLimit("test-route", 2);
    const ip = { "x-forwarded-for": "198.51.100.1" };
    expect(runGuards(post(ip), guard)).toBeNull();
    expect(runGuards(post(ip), guard)).toBeNull();
    const blocked = runGuards(post(ip), guard);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(runGuards(post({ "x-forwarded-for": "198.51.100.2" }), guard)).toBeNull();
  });

  it("scales limits with RATE_LIMIT_SCALE", () => {
    vi.stubEnv("RATE_LIMIT_SCALE", "3");
    const guard = perIpLimit("scaled-route", 1);
    for (let i = 0; i < 3; i++) expect(runGuards(post(), guard)).toBeNull();
    expect(runGuards(post(), guard)?.status).toBe(429);
  });
});

describe("withRoute", () => {
  it("adds a request id and keeps the response", async () => {
    const handler = withRoute("GET /t", () => json({ ok: true }));
    const res = await handler(new Request("http://localhost/t"), {});
    expect(res.headers.get("x-request-id")).toMatch(/[0-9a-f-]{32,36}/);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns a plain-language 500 when the handler throws or rejects", async () => {
    const failure = new Error("db exploded with secret details");
    const handlers = [
      withRoute("GET /t", () => {
        throw failure;
      }),
      withRoute("GET /t", () => Promise.reject(failure)),
    ];
    for (const handler of handlers) {
      const res = await handler(new Request("http://localhost/t"), {});
      expect(res.status).toBe(500);
      const body = await errorBody(res);
      expect(body.error).toMatch(/Something went wrong/);
      expect(JSON.stringify(body)).not.toContain("secret");
    }
  });

  it("tolerates responses with immutable headers", async () => {
    const handler = withRoute("GET /t", () => Response.redirect("http://localhost/elsewhere", 303));
    expect((await handler(new Request("http://localhost/t"), {})).status).toBe(303);
  });

  it("reuses the Cloud Trace id when present", () => {
    const trace = "105445aa7843bc8bf206b12000100000";
    const traced = new Request("http://x/", {
      headers: { "x-cloud-trace-context": `${trace}/1;o=1` },
    });
    expect(requestId(traced)).toBe(trace);
  });
});
