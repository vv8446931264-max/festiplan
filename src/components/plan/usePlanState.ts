"use client";

import { useEffect, useMemo, useReducer, useRef, useSyncExternalStore } from "react";
import { claimKeyFromHash, loadEditKey, subscribeEditKeys } from "@/lib/client/edit-keys";
import type { BudgetCategory, PlanPatch, PublicPlan } from "@/lib/contracts";
import { todayIST } from "@/lib/time";
import { allocationKey, planReducer, type PlanAction } from "./plan-reducer";
import { useAutosave } from "./useAutosave";

export type { SaveState } from "./useAutosave";

/**
 * Plan state for the view. Every change runs through the pure `planReducer`
 * (instant, no AI call); owners' changes are persisted by an ordered, debounced
 * autosave. Action callbacks are stable, so memoised chapters skip re-rendering.
 */
export function usePlanState(initial: PublicPlan, initialKey: string | null) {
  const [plan, dispatch] = useReducer(planReducer, initial);
  const storedKey = useSyncExternalStore(
    subscribeEditKeys,
    () => loadEditKey(initial.id),
    () => null,
  );
  const editKey = initialKey ?? storedKey;
  const { saveState, queue } = useAutosave(initial.id, editKey);

  // An edit link (#edit=…) stores its key; the store subscription then re-renders us.
  useEffect(() => void claimKeyFromHash(initial.id), [initial.id]);
  useBudgetSync(plan.budget, queue);

  const actions = useMemo(() => planActions(dispatch, queue), [queue]);
  return { plan, editable: editKey !== null, editKey, saveState, ...actions };
}

type Queue = (patch: PlanPatch) => void;

/** Owner actions: dispatch the pure change, and queue the matching save where it is known up front. */
function planActions(dispatch: React.Dispatch<PlanAction>, queue: Queue) {
  return {
    moveBudget: (category: BudgetCategory, amountINR: number) =>
      dispatch({ type: "move", category, amountINR }),
    lockBudget: (category: BudgetCategory, locked: boolean) =>
      dispatch({ type: "lock", category, locked }),
    recordActual: (category: BudgetCategory, actualINR: number | null) => {
      dispatch({ type: "actual", category, actualINR });
      queue({ actuals: [{ category, actualINR }] });
    },
    toggleTask: (id: string, done: boolean) => {
      dispatch({ type: "task", id, done, today: todayIST() });
      queue({ tasks: [{ id, done }] });
    },
    toggleVendor: (category: BudgetCategory, done: boolean) => {
      dispatch({ type: "vendor", category, done, today: todayIST() });
      queue({ vendors: [{ category, done }] });
    },
  };
}

/** Saves the allocation list whenever amounts or locks change (computed by the reducer). */
function useBudgetSync(budget: PublicPlan["budget"], queue: Queue) {
  const saved = useRef(allocationKey(budget));
  useEffect(() => {
    const key = allocationKey(budget);
    if (key === saved.current) return;
    saved.current = key;
    queue({
      allocations: budget.map(({ category, amountINR, locked }) => ({
        category,
        amountINR,
        locked,
      })),
    });
  }, [budget, queue]);
}
