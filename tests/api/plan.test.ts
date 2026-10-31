// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/plan/route";
import { addDays } from "@/lib/engine";
import type { PublicPlan } from "@/lib/contracts";
import { todayIST } from "@/lib/time";
import { ORIGIN, bodyOf, futureInput, jsonRequest, noCtx, offlineEnv } from "./request";
import type { ErrorBody } from "./request";

beforeEach(offlineEnv);
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/plan", () => {
  it("creates a plan and returns it once with the edit key", async () => {
    const input = futureInput();
    const res = await POST(jsonRequest("/api/plan", input), noCtx);
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { plan: PublicPlan; editKey: string };
    expect(body.editKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.headers.get("location")).toBe(`/plan/${body.plan.id}`);
    expect(body.plan.source).toBe("template");
    expect(body.plan.budget.reduce((s, a) => s + a.amountINR, 0) + body.plan.contingencyINR).toBe(
      input.budgetINR,
    );
    expect(body.plan).not.toHaveProperty("editKeyHash");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns field issues for an invalid brief", async () => {
    const res = await POST(
      jsonRequest("/api/plan", { ...futureInput(), guests: 0, extra: true }),
      noCtx,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      issues: { path: string; message: string }[];
    };
    expect(body.error).toBeTruthy();
    expect(body.issues.map((i) => i.path)).toContain("guests");
  });

  it("rejects past and far-future dates with a plain-language message", async () => {
    const past = await POST(
      jsonRequest("/api/plan", { ...futureInput(), eventDate: todayIST() }),
      noCtx,
    );
    expect(past.status).toBe(400);
    expect(await past.json()).toEqual({
      error: "Pick a date from tomorrow onwards.",
      issues: [{ path: "eventDate", message: "Pick a date from tomorrow onwards." }],
    });
    const far = await POST(
      jsonRequest("/api/plan", { ...futureInput(), eventDate: addDays(todayIST(), 365 * 4) }),
      noCtx,
    );
    expect(far.status).toBe(400);
  });

  it("refuses cross-site requests", async () => {
    const res = await POST(
      jsonRequest("/api/plan", futureInput(), { headers: { origin: "https://evil.example" } }),
      noCtx,
    );
    expect(res.status).toBe(403);
    const noOrigin = new Request(`${ORIGIN}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect((await POST(noOrigin, noCtx)).status).toBe(403);
  });

  it("enforces the 8 KB cap and JSON content type", async () => {
    const big = await POST(
      jsonRequest("/api/plan", { ...futureInput(), vibe: "x".repeat(9000) }),
      noCtx,
    );
    expect(big.status).toBe(413);
    const text = await POST(
      jsonRequest("/api/plan", "{}", { headers: { "content-type": "text/plain" } }),
      noCtx,
    );
    expect(text.status).toBe(415);
    const broken = await POST(jsonRequest("/api/plan", "{oops"), noCtx);
    expect(broken.status).toBe(400);
  });

  it("allows 5 plans per minute per IP, then 429 with Retry-After", async () => {
    const headers = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 5; i++)
      expect((await POST(jsonRequest("/api/plan", futureInput(), { headers }), noCtx)).status).toBe(
        201,
      );
    const blocked = await POST(jsonRequest("/api/plan", futureInput(), { headers }), noCtx);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await bodyOf<ErrorBody>(blocked)).error).toMatch(/wait/);
  });

  it("scales the limit with RATE_LIMIT_SCALE", async () => {
    vi.stubEnv("RATE_LIMIT_SCALE", "2");
    const headers = { "x-forwarded-for": "203.0.113.10" };
    for (let i = 0; i < 10; i++)
      expect((await POST(jsonRequest("/api/plan", futureInput(), { headers }), noCtx)).status).toBe(
        201,
      );
    expect((await POST(jsonRequest("/api/plan", futureInput(), { headers }), noCtx)).status).toBe(
      429,
    );
  });
});
