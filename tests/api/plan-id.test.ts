// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/plan/route";
import { GET, PATCH } from "@/app/api/plan/[id]/route";
import type { PublicPlan } from "@/lib/contracts";
import { ORIGIN, bodyOf, futureInput, idCtx, jsonRequest, noCtx, offlineEnv } from "./request";
import type { ErrorBody } from "./request";

beforeEach(offlineEnv);
afterEach(() => vi.unstubAllEnvs());

async function created(): Promise<{ plan: PublicPlan; editKey: string }> {
  const res = await POST(jsonRequest("/api/plan", futureInput()), noCtx);
  return (await res.json()) as { plan: PublicPlan; editKey: string };
}

const patch = (id: string, body: unknown, key?: string, headers: Record<string, string> = {}) =>
  PATCH(
    jsonRequest(`/api/plan/${id}`, body, {
      method: "PATCH",
      headers: { ...(key ? { "x-edit-key": key } : {}), ...headers },
    }),
    idCtx(id),
  );

describe("GET /api/plan/[id]", () => {
  it("returns the public plan", async () => {
    const { plan } = await created();
    const res = await GET(new Request(`${ORIGIN}/api/plan/${plan.id}`), idCtx(plan.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { plan: PublicPlan };
    expect(body.plan.id).toBe(plan.id);
    expect(body.plan).not.toHaveProperty("editKeyHash");
  });

  it("404s for unknown and malformed ids", async () => {
    for (const id of ["unknown-plan-id", "bad id", "x", "../../etc/passwd"]) {
      const res = await GET(new Request(`${ORIGIN}/api/plan/x`), idCtx(id));
      expect(res.status).toBe(404);
      expect((await bodyOf<ErrorBody>(res)).error).toMatch(/couldn't find/);
    }
  });
});

describe("PATCH /api/plan/[id]", () => {
  it("ticks a task with the right key", async () => {
    const { plan, editKey } = await created();
    const id = plan.timeline[0]?.id ?? "x";
    const res = await patch(plan.id, { tasks: [{ id, done: true }] }, editKey);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plan: PublicPlan };
    expect(body.plan.timeline.find((t) => t.id === id)?.done).toBe(true);
  });

  it("403s with a wrong or missing key", async () => {
    const { plan } = await created();
    const body = { tasks: [{ id: plan.timeline[0]?.id ?? "x", done: true }] };
    expect((await patch(plan.id, body, "not-the-key")).status).toBe(403);
    expect((await patch(plan.id, body)).status).toBe(403);
  });

  it("422s for budget edits that don't add up", async () => {
    const { plan, editKey } = await created();
    const allocations = plan.budget.map((a) => ({
      category: a.category,
      amountINR: a.amountINR + 5,
      locked: false,
    }));
    const res = await patch(plan.id, { allocations }, editKey);
    expect(res.status).toBe(422);
    expect((await bodyOf<ErrorBody>(res)).error).toMatch(/don't add up/);
  });

  it("400s for an empty or non-strict patch and 404s for unknown plans", async () => {
    const { plan, editKey } = await created();
    expect((await patch(plan.id, {}, editKey)).status).toBe(400);
    expect((await patch(plan.id, { tasks: [], hack: 1 }, editKey)).status).toBe(400);
    expect((await patch("unknown-plan-id", { tasks: [] }, editKey)).status).toBe(404);
  });

  it("requires same-origin and caps the body at 16 KB", async () => {
    const { plan, editKey } = await created();
    expect(
      (await patch(plan.id, { tasks: [] }, editKey, { origin: "https://evil.example" })).status,
    ).toBe(403);
    const huge = {
      tasks: Array.from({ length: 400 }, (_, i) => ({
        id: `task-${i}-${"x".repeat(30)}`,
        done: true,
      })),
    };
    expect((await patch(plan.id, huge, editKey)).status).toBe(413);
  });
});
