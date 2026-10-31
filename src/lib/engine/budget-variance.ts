import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { sum } from "./shared";

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
export type OverspendAlert = {
  category: BudgetCategory;
  overByINR: number;
  coveredByContingency: boolean;
};

type TrackedLine = Allocation & { actualINR: number };

const hasActual = (line: Allocation): line is TrackedLine => line.actualINR !== null;

/**
 * Planned versus actual per category. `actualINR` sums the recorded actuals; `varianceINR`
 * is actual minus planned over only the rows that have an actual (positive means overspent).
 * @param allocations Current lines.
 */
export function budgetVariance(allocations: Allocation[]): BudgetVariance {
  const rows: VarianceRow[] = allocations.map((line) => ({
    category: line.category,
    plannedINR: line.amountINR,
    actualINR: line.actualINR,
    varianceINR: line.actualINR === null ? null : line.actualINR - line.amountINR,
    overspent: line.actualINR !== null && line.actualINR > line.amountINR,
  }));
  const tracked = allocations.filter(hasActual);
  return {
    rows,
    plannedINR: sum(allocations.map((line) => line.amountINR)),
    actualINR: sum(tracked.map((line) => line.actualINR)),
    varianceINR: sum(tracked.map((line) => line.actualINR - line.amountINR)),
  };
}

/**
 * One alert per overspent line, in line order. `coveredByContingency` is true while the
 * running total of overspend is within the contingency reserve.
 * @param allocations Current lines.
 * @param contingencyINR Contingency reserve in rupees.
 */
export function overspendAlerts(
  allocations: Allocation[],
  contingencyINR: number,
): OverspendAlert[] {
  let overspentSoFar = 0;
  const alerts: OverspendAlert[] = [];
  for (const line of allocations) {
    if (line.actualINR === null || line.actualINR <= line.amountINR) continue;
    const overByINR = line.actualINR - line.amountINR;
    overspentSoFar += overByINR;
    alerts.push({
      category: line.category,
      overByINR,
      coveredByContingency: overspentSoFar <= contingencyINR,
    });
  }
  return alerts;
}
