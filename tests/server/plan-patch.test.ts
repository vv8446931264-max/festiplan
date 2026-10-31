// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Plan } from "@/lib/contracts";
import { applyPatch } from "@/lib/server/plan-patch";
import { budgetTotal, storedPlan } from "./fixtures";

/** The stored (internal) plan behind `storedPlan()`. */
async function internalPlan(): Promise<Plan> {
  const { store, plan } = await storedPlan();
  const stored = await store.get(plan.id);
  if (!stored) throw new Error("plan was not stored");
  return stored;
}

/** Every budget line, with `shift` rupees moved from the first line to the second (locked). */
function shiftedBudget(plan: Plan, shift: number) {
  return plan.budget.map((line, index) => {
    let amountINR = line.amountINR;
    if (index === 0) amountINR -= shift;
    if (index === 1) amountINR += shift;
    return { category: line.category, amountINR, locked: index === 0 };
  });
}

describe("applyPatch", () => {
  it("rejects budget edits that don't add up or leave out a category", async () => {
    const plan = await internalPlan();
    const inflated = plan.budget.map((line) => ({ ...line, amountINR: line.amountINR + 1 }));
    const partial = shiftedBudget(plan, 0).slice(1);
    for (const allocations of [inflated, partial]) {
      const result = applyPatch(plan, { allocations });
      expect(result).toMatchObject({ ok: false, status: 422 });
      if (!result.ok) expect(result.error).toMatch(/don't add up/);
    }
  });

  it("rejects ticks and spend for tasks, vendors or lines the plan doesn't have", async () => {
    const plan = await internalPlan();
    const vendor = plan.vendors.at(0)?.category ?? "venue";
    const line = plan.budget.at(0)?.category ?? "venue";
    const rejected = [
      applyPatch(plan, { tasks: [{ id: "ghost-task", done: true }] }),
      applyPatch(
        { ...plan, vendors: plan.vendors.slice(1) },
        { vendors: [{ category: vendor, done: true }] },
      ),
      applyPatch(
        { ...plan, budget: plan.budget.slice(1) },
        { actuals: [{ category: line, actualINR: 5 }] },
      ),
    ];
    for (const result of rejected) expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("applies balanced edits, actual spend and ticks without changing the input", async () => {
    const plan = await internalPlan();
    const first = plan.budget.at(0);
    if (!first) throw new Error("plan has no budget lines");
    const taskId = plan.timeline.at(0)?.id ?? "x";
    const vendor = plan.vendors.at(0)?.category ?? "venue";
    const result = applyPatch(plan, {
      allocations: shiftedBudget(plan, 1000),
      actuals: [{ category: first.category, actualINR: 4321 }],
      tasks: [{ id: taskId, done: true }],
      vendors: [{ category: vendor, done: true }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edited = result.plan.budget.find((line) => line.category === first.category);
    expect(edited).toMatchObject({
      amountINR: first.amountINR - 1000,
      locked: true,
      actualINR: 4321,
    });
    expect(budgetTotal(result.plan.budget)).toBe(budgetTotal(plan.budget));
    expect(result.plan.timeline.find((task) => task.id === taskId)?.done).toBe(true);
    expect(result.plan.vendors.find((item) => item.category === vendor)?.done).toBe(true);
    expect(plan.timeline.find((task) => task.id === taskId)?.done).toBe(false);
  });
});
