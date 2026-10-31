import type { BudgetCategory, PublicPlan } from "@/lib/contracts";
import {
  rebalance,
  refreshStatus,
  refreshVendorStatus,
  setActual,
  setLocked,
  setTaskDone,
  setVendorDone,
} from "@/lib/engine";

/** Every change an owner can make to a plan in the browser. */
export type PlanAction =
  | { type: "move"; category: BudgetCategory; amountINR: number }
  | { type: "lock"; category: BudgetCategory; locked: boolean }
  | { type: "actual"; category: BudgetCategory; actualINR: number | null }
  | { type: "task"; id: string; done: boolean; today: string }
  | { type: "vendor"; category: BudgetCategory; done: boolean; today: string };

/**
 * Pure state transition for the plan view — the same engine functions the server
 * uses, so the browser shows exactly what will be saved. No AI call, no I/O.
 */
export function planReducer(plan: PublicPlan, action: PlanAction): PublicPlan {
  const totals = { totalINR: plan.input.budgetINR, guests: plan.input.guests };
  switch (action.type) {
    case "move":
      return { ...plan, budget: rebalance(plan.budget, action.category, action.amountINR, totals) };
    case "lock":
      return { ...plan, budget: setLocked(plan.budget, action.category, action.locked) };
    case "actual":
      return { ...plan, budget: setActual(plan.budget, action.category, action.actualINR) };
    case "task":
      return {
        ...plan,
        timeline: refreshStatus(setTaskDone(plan.timeline, action.id, action.done), action.today),
      };
    case "vendor":
      return {
        ...plan,
        vendors: refreshVendorStatus(
          setVendorDone(plan.vendors, action.category, action.done),
          action.today,
        ),
      };
  }
}

/** The allocation edit list the PATCH endpoint expects, as a comparable key. */
export function allocationKey(budget: PublicPlan["budget"]): string {
  return budget
    .map((line) => `${line.category}:${line.amountINR}:${line.locked ? 1 : 0}`)
    .join("|");
}
