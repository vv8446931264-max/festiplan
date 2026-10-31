// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allocationKey, planReducer } from "@/components/plan/plan-reducer";
import { FIXTURE_TODAY, fixturePlan } from "../fixtures/plan";

const total = (p: ReturnType<typeof fixturePlan>) =>
  p.budget.reduce((s, a) => s + a.amountINR, 0) + p.contingencyINR;

describe("planReducer", () => {
  it("moves a budget line and keeps the total exact", () => {
    const plan = fixturePlan();
    const next = planReducer(plan, { type: "move", category: "decor", amountINR: 300_000 });
    expect(next.budget.find((a) => a.category === "decor")?.amountINR).toBe(300_000);
    expect(total(next)).toBe(plan.input.budgetINR);
    expect(next.timeline).toBe(plan.timeline);
  });

  it("locks a line, records actual spend and leaves other slices untouched", () => {
    const plan = fixturePlan();
    const locked = planReducer(plan, { type: "lock", category: "venue", locked: true });
    expect(locked.budget.find((a) => a.category === "venue")?.locked).toBe(true);
    const spent = planReducer(locked, { type: "actual", category: "venue", actualINR: 250_000 });
    expect(spent.budget.find((a) => a.category === "venue")?.actualINR).toBe(250_000);
    expect(allocationKey(spent.budget)).toBe(allocationKey(locked.budget));
    expect(spent.vendors).toBe(plan.vendors);
  });

  it("ticks tasks and vendors and refreshes their overdue flags", () => {
    const plan = fixturePlan();
    const id = plan.timeline[0]?.id ?? "";
    const ticked = planReducer(plan, { type: "task", id, done: true, today: FIXTURE_TODAY });
    expect(ticked.timeline.find((t) => t.id === id)?.done).toBe(true);
    const later = planReducer(ticked, { type: "task", id, done: false, today: "2027-03-22" });
    expect(later.timeline.find((t) => t.id === id)?.overdue).toBe(true);
    const category = plan.vendors[0]?.category ?? "venue";
    const booked = planReducer(plan, {
      type: "vendor",
      category,
      done: true,
      today: FIXTURE_TODAY,
    });
    expect(booked.vendors.find((v) => v.category === category)?.done).toBe(true);
  });
});
