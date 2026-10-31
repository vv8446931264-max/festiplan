// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clearPlanCache } from "@/lib/ai/plan";
import { templatePlan } from "@/lib/ai/templates";
import { DAY_MS } from "@/lib/time";
import { EVENT_TYPES, PLAN_TTL_DAYS } from "@/lib/contracts";
import { hashEditKey } from "@/lib/security/edit-key";
import {
  createPlan,
  getPublicPlan,
  isPlanId,
  newPlanId,
  patchPlan,
  toPublic,
} from "@/lib/server/plan-service";
import { MemoryStore } from "@/lib/store";
import {
  NOW,
  TODAY,
  budgetTotal,
  fakeAi,
  jsonReply,
  rng,
  sampleInput,
  storedPlan,
} from "./fixtures";

describe("createPlan", () => {
  it("allocates the budget exactly, including contingency", async () => {
    const { plan } = await storedPlan();
    expect(plan.contingencyINR).toBe(120_000);
    expect(budgetTotal(plan.budget) + plan.contingencyINR).toBe(1_200_000);
    expect(plan.source).toBe("template");
    expect(plan.model).toBe("template");
  });

  it("sums exactly for many random budgets and every event type", async () => {
    const next = rng(7);
    const store = new MemoryStore();
    for (let i = 0; i < 60; i++) {
      const budgetINR = 1_000 + Math.floor(next() * 499_999_000);
      const eventType = EVENT_TYPES.at(i % EVENT_TYPES.length) ?? "other";
      const input = sampleInput({ budgetINR, eventType, guests: 1 + i });
      const { plan } = await createPlan(input, TODAY, { store, ai: null });
      expect(budgetTotal(plan.budget) + plan.contingencyINR).toBe(budgetINR);
    }
  });

  it("schedules the timeline and vendors, and stores only the edit-key hash", async () => {
    const { store, plan, editKey } = await storedPlan();
    expect(editKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(plan).not.toHaveProperty("editKeyHash");
    expect(plan.timeline).toHaveLength(templatePlan(sampleInput()).tasks.length);
    expect(plan.vendors.length).toBeGreaterThanOrEqual(3);
    expect(plan.today).toBe(TODAY);
    expect(plan.createdAt).toBe(NOW.toISOString());
    expect(Date.parse(plan.expireAt) - NOW.getTime()).toBe(PLAN_TTL_DAYS * DAY_MS);
    const stored = await store.get(plan.id);
    expect(stored?.editKeyHash).toBe(hashEditKey(editKey));
    expect(stored?.expireAt).toBeInstanceOf(Date);
  });

  it("records Gemini as the source when the model answers", async () => {
    clearPlanCache();
    const { handle } = fakeAi([jsonReply(templatePlan(sampleInput()))]);
    const { plan } = await createPlan(sampleInput({ city: "Udaipur" }), TODAY, {
      store: new MemoryStore(),
      ai: handle,
    });
    expect(plan.source).toBe("gemini");
    expect(plan.model).toBe("gemini-3.5-flash");
  });
});

describe("getPublicPlan", () => {
  it("returns null for bad ids and missing plans", async () => {
    const { store } = await storedPlan();
    expect(await getPublicPlan("../etc", TODAY, { store })).toBeNull();
    expect(await getPublicPlan("missing-plan", TODAY, { store })).toBeNull();
  });

  it("recomputes overdue flags for today", async () => {
    const { store, plan } = await storedPlan();
    const later = await getPublicPlan(plan.id, plan.input.eventDate, { store });
    expect(later?.timeline.some((task) => task.overdue)).toBe(true);
    expect(later?.vendors.some((vendor) => vendor.overdue)).toBe(true);
    expect(later).not.toHaveProperty("editKeyHash");
  });
});

describe("patchPlan", () => {
  it("refuses a wrong or missing key with 403 and unknown plans with 404", async () => {
    const { store, plan } = await storedPlan();
    const patch = { tasks: [{ id: plan.timeline.at(0)?.id ?? "x", done: true }] };
    const refused = [
      [await patchPlan(plan.id, "wrong-key", patch, TODAY, { store }), 403],
      [await patchPlan(plan.id, null, patch, TODAY, { store }), 403],
      [await patchPlan("missing-plan", "k", patch, TODAY, { store }), 404],
      [await patchPlan("bad id!", "k", patch, TODAY, { store }), 404],
    ] as const;
    for (const [result, status] of refused) expect(result).toMatchObject({ ok: false, status });
  });

  it("refuses edits that don't fit with 422", async () => {
    const { store, plan, editKey } = await storedPlan();
    const ghost = { tasks: [{ id: "ghost-task", done: true }] };
    const res = await patchPlan(plan.id, editKey, ghost, TODAY, { store });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("saves ticks with a fresh updatedAt and recomputed status", async () => {
    const { store, plan, editKey } = await storedPlan();
    const taskId = plan.timeline.at(0)?.id ?? "x";
    const later = new Date(NOW.getTime() + 60_000);
    const patch = { tasks: [{ id: taskId, done: true }] };
    const res = await patchPlan(plan.id, editKey, patch, TODAY, { store, now: later });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.updatedAt).toBe(later.toISOString());
    expect(res.plan).not.toHaveProperty("editKeyHash");
    const saved = await getPublicPlan(plan.id, TODAY, { store });
    expect(saved?.timeline.find((task) => task.id === taskId)?.done).toBe(true);
  });
});

describe("ids and public shape", () => {
  it("makes 12-character URL-safe ids that pass the route check", () => {
    for (let i = 0; i < 20; i++) {
      const id = newPlanId();
      expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
      expect(isPlanId(id)).toBe(true);
    }
    expect(isPlanId("short")).toBe(false);
    expect(isPlanId("a".repeat(33))).toBe(false);
  });

  it("strips the hash and serialises expireAt", async () => {
    const { store, plan } = await storedPlan();
    const stored = await store.get(plan.id);
    if (!stored) throw new Error("missing");
    const pub = toPublic(stored);
    expect(pub).not.toHaveProperty("editKeyHash");
    expect(pub.expireAt).toBe(stored.expireAt.toISOString());
  });
});
