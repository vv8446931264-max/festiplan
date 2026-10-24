import type { Allocation, BudgetCategory } from "@/lib/contracts";

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/** Planned versus actual spend for one category. */
export type VarianceRow = {
  category: BudgetCategory;
  plannedINR: number;
  actualINR: number | null;
  varianceINR: number | null;
  overspent: boolean;
};

/** Planned-vs-actual summary. `varianceINR` only compares rows that have an actual. */
export type BudgetVariance = {
  rows: VarianceRow[];
  plannedINR: number;
  actualINR: number;
  varianceINR: number;
};

/** A category whose actual spend exceeds its plan. */
export type OverspendAlert = { category: BudgetCategory; overByINR: number; coveredByContingency: boolean };

/**
 * Planned versus actual per category. `actualINR` sums the recorded actuals; `varianceINR`
 * is actual minus planned over only the rows that have an actual (positive means overspent).
 * @param allocations Current lines.
 */
export function budgetVariance(allocations: Allocation[]): BudgetVariance {
  const rows: VarianceRow[] = allocations.map((a) => ({
    category: a.category,
    plannedINR: a.amountINR,
    actualINR: a.actualINR,
    varianceINR: a.actualINR === null ? null : a.actualINR - a.amountINR,
    overspent: a.actualINR !== null && a.actualINR > a.amountINR,
  }));
  const tracked = allocations.filter((a): a is Allocation & { actualINR: number } => a.actualINR !== null);
  return {
    rows,
    plannedINR: sum(allocations.map((a) => a.amountINR)),
    actualINR: sum(tracked.map((a) => a.actualINR)),
    varianceINR: sum(tracked.map((a) => a.actualINR - a.amountINR)),
  };
}

/**
 * One alert per overspent line, in line order. `coveredByContingency` is true while the
 * running total of overspend is within the contingency reserve.
 * @param allocations Current lines.
 * @param contingencyINR Contingency reserve in rupees.
 */
export function overspendAlerts(allocations: Allocation[], contingencyINR: number): OverspendAlert[] {
  let running = 0;
  const alerts: OverspendAlert[] = [];
  for (const a of allocations) {
    if (a.actualINR === null || a.actualINR <= a.amountINR) continue;
    const overByINR = a.actualINR - a.amountINR;
    running += overByINR;
    alerts.push({ category: a.category, overByINR, coveredByContingency: running <= contingencyINR });
  }
  return alerts;
}
