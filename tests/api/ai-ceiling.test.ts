// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createPlanRoute } from "@/app/api/plan/route";
import { POST as refine } from "@/app/api/plan/[id]/refine/route";
import { POST as vendors } from "@/app/api/vendors/route";
import type { PublicPlan } from "@/lib/contracts";
import { AI_GLOBAL_PER_MINUTE, aiGlobalLimit } from "@/lib/server/http";
import { futureInput, idCtx, jsonRequest, noCtx, offlineEnv } from "./request";

beforeEach(offlineEnv);
afterEach(() => vi.unstubAllEnvs());

/** Uses up what is left of the instance-wide AI window. */
function exhaustAiWindow(): void {
  const req = new Request("http://localhost:3000/");
  while (aiGlobalLimit(req) === null) {
    // keep drawing from the shared bucket
  }
}

async function expectBusy(res: Response): Promise<void> {
  expect(res.status).toBe(503);
  expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  expect((await res.json()).error).toMatch(/very busy right now\. Please try again in \d+ seconds/);
}

describe("instance-wide AI ceiling", () => {
  it(`admits ${AI_GLOBAL_PER_MINUTE} AI-backed requests per minute across all clients, scaled by RATE_LIMIT_SCALE`, () => {
    const req = new Request("http://localhost:3000/");
    for (let i = 0; i < AI_GLOBAL_PER_MINUTE; i++) expect(aiGlobalLimit(req)).toBeNull();
    expect(aiGlobalLimit(req)?.status).toBe(503);
    offlineEnv();
    vi.stubEnv("RATE_LIMIT_SCALE", "2");
    for (let i = 0; i < AI_GLOBAL_PER_MINUTE * 2; i++) expect(aiGlobalLimit(req)).toBeNull();
    expect(aiGlobalLimit(req)?.status).toBe(503);
  });

  it("returns 503 with Retry-After from plan creation, refine and vendors once spent", async () => {
    const created = await createPlanRoute(jsonRequest("/api/plan", futureInput()), noCtx);
    const { plan } = (await created.json()) as { plan: PublicPlan };
    exhaustAiWindow();
    await expectBusy(await createPlanRoute(jsonRequest("/api/plan", futureInput(), { headers: { "x-forwarded-for": "198.51.100.20" } }), noCtx));
    await expectBusy(await refine(jsonRequest(`/api/plan/${plan.id}/refine`, { question: "Ideas?" }), idCtx(plan.id)));
    await expectBusy(await vendors(jsonRequest("/api/vendors", { planId: plan.id, category: "decor" }), noCtx));
  });

  it("is checked after the per-client limit and validation, so junk requests do not spend it", async () => {
    exhaustAiWindow();
    expect((await createPlanRoute(jsonRequest("/api/plan", { nope: true }), noCtx)).status).toBe(400);
    expect((await vendors(jsonRequest("/api/vendors", { planId: "no-such-plan", category: "decor" }), noCtx)).status).toBe(404);
    expect((await refine(jsonRequest("/api/plan/no-such-plan/refine", { question: "Ideas?" }), idCtx("no-such-plan"))).status).toBe(404);
  });
});
