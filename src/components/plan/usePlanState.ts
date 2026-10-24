"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { claimKeyFromHash, loadEditKey, subscribeEditKeys } from "@/lib/client/edit-keys";
import type { BudgetCategory, PlanPatch, PublicPlan } from "@/lib/contracts";
import {
  rebalance, refreshStatus, refreshVendorStatus, setActual, setLocked, setTaskDone, setVendorDone,
} from "@/lib/engine";
import { todayIST } from "@/lib/time";
import { useAutosave } from "./useAutosave";

export type { SaveState } from "./useAutosave";

/**
 * Plan state for the view. Every change is applied locally with the pure engine
 * (instant, no AI call) and, for owners, persisted by an ordered, debounced autosave.
 */
export function usePlanState(initial: PublicPlan, initialKey: string | null) {
  const [plan, setPlan] = useState(initial);
  const storedKey = useSyncExternalStore(subscribeEditKeys, () => loadEditKey(initial.id), () => null);
  const editKey = initialKey ?? storedKey;
  const { saveState, queue } = useAutosave(initial.id, editKey);

  // An edit link (#edit=…) stores its key; the store subscription then re-renders us.
  useEffect(() => void claimKeyFromHash(initial.id), [initial.id]);

  const actions = usePlanActions(plan, setPlan, queue);
  return { plan, editable: editKey !== null, editKey, saveState, ...actions };
}

type SetPlan = React.Dispatch<React.SetStateAction<PublicPlan>>;

function usePlanActions(plan: PublicPlan, setPlan: SetPlan, queue: (p: PlanPatch) => void) {
  const ctx = { totalINR: plan.input.budgetINR, guests: plan.input.guests };
  const editsOf = (budget: PublicPlan["budget"]) =>
    budget.map(({ category, amountINR, locked }) => ({ category, amountINR, locked }));

  const moveBudget = (category: BudgetCategory, amountINR: number) => {
    const budget = rebalance(plan.budget, category, amountINR, ctx);
    setPlan({ ...plan, budget });
    queue({ allocations: editsOf(budget) });
  };
  const lockBudget = (category: BudgetCategory, locked: boolean) => {
    const budget = setLocked(plan.budget, category, locked);
    setPlan({ ...plan, budget });
    queue({ allocations: editsOf(budget) });
  };
  const recordActual = (category: BudgetCategory, actualINR: number | null) => {
    setPlan({ ...plan, budget: setActual(plan.budget, category, actualINR) });
    queue({ actuals: [{ category, actualINR }] });
  };
  const toggleTask = (id: string, done: boolean) => {
    setPlan({ ...plan, timeline: refreshStatus(setTaskDone(plan.timeline, id, done), todayIST()) });
    queue({ tasks: [{ id, done }] });
  };
  const toggleVendor = (category: BudgetCategory, done: boolean) => {
    setPlan({ ...plan, vendors: refreshVendorStatus(setVendorDone(plan.vendors, category, done), todayIST()) });
    queue({ vendors: [{ category, done }] });
  };
  return { moveBudget, lockBudget, recordActual, toggleTask, toggleVendor };
}
