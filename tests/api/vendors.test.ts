// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createPlanRoute } from "@/app/api/plan/route";
import { POST as vendors } from "@/app/api/vendors/route";
import type { CreatedPlan, ErrorBody, PlanInput } from "@/lib/contracts";
import { bodyOf, futureInput, jsonRequest, noCtx, offlineEnv } from "./request";

beforeEach(offlineEnv);
afterEach(() => vi.unstubAllEnvs());

async function planId(overrides: Partial<PlanInput> = {}): Promise<string> {
  const res = await createPlanRoute(jsonRequest("/api/plan", futureInput(overrides)), noCtx);
  return ((await res.json()) as CreatedPlan).plan.id;
}

const lookup = (body: unknown, headers: Record<string, string> = {}) =>
  vendors(jsonRequest("/api/vendors", body, { headers }), noCtx);

describe("POST /api/vendors", () => {
  it("looks up vendors for the plan's own city and event type", async () => {
    const id = await planId({ city: "Kochi", eventType: "birthday" });
    const res = await lookup({ planId: id, category: "catering" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      places: [],
      searchUrl:
        "https://www.google.com/maps/search/?api=1&query=Catering%20for%20birthday%20party%20in%20Kochi",
      source: "search",
    });
  });

  it("404s for a well-formed id with no plan behind it", async () => {
    const res = await lookup({ planId: "no-such-plan", category: "venue" });
    expect(res.status).toBe(404);
    expect((await bodyOf<ErrorBody>(res)).error).toMatch(/couldn't find that plan/);
  });

  it("refuses free-form lookups: city/eventType keys, missing or malformed planId, unknown category", async () => {
    const id = await planId();
    for (const body of [
      { planId: id, category: "catering", city: "Jaipur" },
      { planId: id, category: "catering", eventType: "wedding" },
      { city: "Jaipur", category: "catering", eventType: "wedding" },
      { planId: "../etc", category: "catering" },
      { planId: "short", category: "catering" },
      { planId: id, category: "fireworks" },
    ]) {
      const res = await lookup(body);
      expect(res.status).toBe(400);
      expect((await bodyOf<ErrorBody>(res)).issues?.length).toBeGreaterThan(0);
    }
  });

  it("enforces the 1 KB cap and same-origin", async () => {
    expect((await lookup({ planId: "x".repeat(2000), category: "venue" })).status).toBe(413);
    const id = await planId();
    expect(
      (await lookup({ planId: id, category: "venue" }, { origin: "https://evil.example" })).status,
    ).toBe(403);
  });

  it("allows 10 lookups per minute per client, then 429", async () => {
    const id = await planId();
    const headers = { "x-forwarded-for": "2001:db8:5:6::1" };
    for (let i = 0; i < 10; i++)
      expect((await lookup({ planId: id, category: "venue" }, headers)).status).toBe(200);
    // Another address in the same IPv6 /64 shares the window.
    const sameNetwork = await lookup(
      { planId: id, category: "venue" },
      { "x-forwarded-for": "2001:db8:5:6:ffff::9" },
    );
    expect(sameNetwork.status).toBe(429);
    expect(Number(sameNetwork.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      (await lookup({ planId: id, category: "venue" }, { "x-forwarded-for": "2001:db8:5:7::1" }))
        .status,
    ).toBe(200);
  });
});
