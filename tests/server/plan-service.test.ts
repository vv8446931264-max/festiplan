// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clearPlanCache } from "@/lib/ai/plan";
import { templatePlan } from "@/lib/ai/templates";
import { EVENT_TYPES, PLAN_TTL_DAYS } from "@/lib/contracts";
import type { Allocation } from "@/lib/contracts";
import { hashEditKey } from "@/lib/security/edit-key";
import { createPlan, getPublicPlan, isPlanId, newPlanId, patchPlan, toPublic } from "@/lib/server/plan-service";
import { MemoryStore } from "@/lib/store";
import { TODAY, fakeAi, jsonReply, rng, sampleInput } from "./fixtures";

const total = (budget: Allocation[]) => budget.reduce((s, a) => s + a.amountINR, 0);
const NOW = new Date("2026-10-24T06:30:00Z");

async function setup() {
  const store = new MemoryStore(() => NOW.getTime());
  const created = await createPlan(sampleInput(), TODAY, { store, ai: null, now: NOW });
  return { store, ...created };
}

describe("createPlan", () => {
  it("allocates the budget exactly, including contingency", async () => {
    const { plan } = await setup();
    expect(plan.contingencyINR).toBe(120_000);
    expect(total(plan.budget) + plan.contingencyINR).toBe(1_200_000);
    expect(plan.source).toBe("template");
    expect(plan.model).toBe("template");
  });

  it("sums exactly for many random budgets and every event type", async () => {
    const next = rng(7);
    const store = new MemoryStore();
    for (let i = 0; i < 60; i++) {
      const budgetINR = 1_000 + Math.floor(next() * 499_999_000);
      const eventType = EVENT_TYPES[i % EVENT_TYPES.length] ?? "other";
      const { plan } = await createPlan(sampleInput({ budgetINR, eventType, guests: 1 + i }), TODAY, { store, ai: null });
      expect(total(plan.budget) + plan.contingencyINR).toBe(budgetINR);
    }
  });

  it("schedules the timeline and vendors, and stores only the edit-key hash", async () => {
    const { store, plan, editKey } = await setup();
    expect(editKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(plan).not.toHaveProperty("editKeyHash");
    expect(plan.timeline).toHaveLength(templatePlan(sampleInput()).tasks.length);
    expect(plan.vendors.length).toBeGreaterThanOrEqual(3);
    expect(plan.today).toBe(TODAY);
    expect(plan.createdAt).toBe(NOW.toISOString());
    expect(Date.parse(plan.expireAt) - NOW.getTime()).toBe(PLAN_TTL_DAYS * 86_400_000);
    const stored = await store.get(plan.id);
    expect(stored?.editKeyHash).toBe(hashEditKey(editKey));
    expect(stored?.expireAt).toBeInstanceOf(Date);
  });

  it("records Gemini as the source when the model answers", async () => {
    clearPlanCache();
    const { handle } = fakeAi([jsonReply(templatePlan(sampleInput()))]);
    const { plan } = await createPlan(sampleInput({ city: "Udaipur" }), TODAY, { store: new MemoryStore(), ai: handle });
    expect(plan.source).toBe("gemini");
    expect(plan.model).toBe("gemini-3.5-flash");
  });
});

describe("getPublicPlan", () => {
  it("returns null for bad ids and missing plans", async () => {
    const { store } = await setup();
    expect(await getPublicPlan("../etc", TODAY, { store })).toBeNull();
    expect(await getPublicPlan("missing-plan", TODAY, { store })).toBeNull();
  });

  it("recomputes overdue flags for today", async () => {
    const { store, plan } = await setup();
    const later = await getPublicPlan(plan.id, plan.input.eventDate, { store });
    expect(later?.timeline.some((t) => t.overdue)).toBe(true);
    expect(later?.vendors.some((v) => v.overdue)).toBe(true);
    expect(later).not.toHaveProperty("editKeyHash");
  });
});

describe("patchPlan", () => {
  it("refuses a wrong or missing key with 403 and unknown plans with 404", async () => {
    const { store, plan } = await setup();
    const patch = { tasks: [{ id: plan.timeline[0]?.id ?? "x", done: true }] };
    expect(await patchPlan(plan.id, "wrong-key", patch, TODAY, { store })).toMatchObject({ ok: false, status: 403 });
    expect(await patchPlan(plan.id, null, patch, TODAY, { store })).toMatchObject({ ok: false, status: 403 });
    expect(await patchPlan("missing-plan", "k", patch, TODAY, { store })).toMatchObject({ ok: false, status: 404 });
    expect(await patchPlan("bad id!", "k", patch, TODAY, { store })).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects budget edits that don't add up with 422", async () => {
    const { store, plan, editKey } = await setup();
    const edits = plan.budget.map((a) => ({ category: a.category, amountINR: a.amountINR + 1, locked: false }));
    expect(await patchPlan(plan.id, editKey, { allocations: edits }, TODAY, { store })).toMatchObject({ ok: false, status: 422 });
    const partial = edits.slice(1);
    expect(await patchPlan(plan.id, editKey, { allocations: partial }, TODAY, { store })).toMatchObject({ ok: false, status: 422 });
  });

  it("rejects unknown tasks, vendors and categories with 422", async () => {
    const { store, plan, editKey } = await setup();
    const missingVendor = (["venue", "catering", "decor", "photography", "entertainment", "attire", "invitations", "gifts", "transport", "misc"] as const).find((c) => !plan.vendors.some((v) => v.category === c)) ?? "misc";
    for (const patch of [{ tasks: [{ id: "ghost-task", done: true }] }, { vendors: [{ category: missingVendor, done: true }] }]) {
      expect(await patchPlan(plan.id, editKey, patch, TODAY, { store })).toMatchObject({ ok: false, status: 422 });
    }
    const other = await createPlan(sampleInput({ eventType: "birthday" }), TODAY, { store, ai: null });
    const absent = (["attire", "transport"] as const).find((c) => !other.plan.budget.some((a) => a.category === c)) ?? "attire";
    const res = await patchPlan(other.plan.id, other.editKey, { actuals: [{ category: absent, actualINR: 5 }] }, TODAY, { store });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("applies ticks, actuals and balanced edits, and persists them", async () => {
    const { store, plan, editKey } = await setup();
    const [a, b, ...rest] = plan.budget;
    if (!a || !b) throw new Error("budget too short");
    const edits = [
      { category: a.category, amountINR: a.amountINR - 1000, locked: true },
      { category: b.category, amountINR: b.amountINR + 1000, locked: false },
      ...rest.map((r) => ({ category: r.category, amountINR: r.amountINR, locked: r.locked })),
    ];
    const taskId = plan.timeline[0]?.id ?? "x";
    const vendor = plan.vendors[0]?.category ?? "venue";
    const later = new Date(NOW.getTime() + 60_000);
    const res = await patchPlan(
      plan.id,
      editKey,
      { allocations: edits, actuals: [{ category: a.category, actualINR: 4321 }], tasks: [{ id: taskId, done: true }], vendors: [{ category: vendor, done: true }] },
      TODAY,
      { store, now: later },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const line = res.plan.budget.find((x) => x.category === a.category);
    expect(line).toMatchObject({ amountINR: a.amountINR - 1000, locked: true, actualINR: 4321 });
    expect(total(res.plan.budget) + res.plan.contingencyINR).toBe(1_200_000);
    expect(res.plan.timeline.find((t) => t.id === taskId)?.done).toBe(true);
    expect(res.plan.vendors.find((v) => v.category === vendor)?.done).toBe(true);
    expect(res.plan.updatedAt).toBe(later.toISOString());
    expect((await getPublicPlan(plan.id, TODAY, { store }))?.timeline.find((t) => t.id === taskId)?.done).toBe(true);
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
    const { store, plan } = await setup();
    const stored = await store.get(plan.id);
    if (!stored) throw new Error("missing");
    const pub = toPublic(stored);
    expect(pub).not.toHaveProperty("editKeyHash");
    expect(pub.expireAt).toBe(stored.expireAt.toISOString());
  });
});
