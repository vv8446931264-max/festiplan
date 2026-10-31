import { CONTINGENCY_PERCENT } from "@/lib/contracts/constants";
import type { Allocation, BudgetWeight } from "@/lib/contracts";
import { largestRemainder } from "./largest-remainder";
import { budgetCategoryRank } from "./shared";

/** `part` as a percentage of `whole`, rounded to one decimal place (×1000, round, ÷10). */
const percentOf = (part: number, whole: number): number => Math.round((part / whole) * 1000) / 10;

/** `round(total × percent / 100)`, kept within `[0, total]`. */
const contingencyFor = (totalINR: number, percent: number): number =>
  Math.min(totalINR, Math.max(0, Math.round((totalINR * percent) / 100)));

/**
 * Recomputes `percent` (share of the total, one decimal) and `perGuestINR` for every line.
 * @param allocations Budget lines.
 * @param totalINR Total budget, contingency included.
 * @param guests Guest count (at least 1 is assumed).
 */
export function withDerived(
  allocations: Allocation[],
  totalINR: number,
  guests: number,
): Allocation[] {
  const total = Math.max(1, totalINR);
  const guestCount = Math.max(1, guests);
  return allocations.map((line) => ({
    ...line,
    percent: percentOf(line.amountINR, total),
    perGuestINR: Math.round(line.amountINR / guestCount),
  }));
}

/** Keeps the first weight of each category (the model may repeat one). */
function firstPerCategory(weights: BudgetWeight[]): BudgetWeight[] {
  const seen = new Set<BudgetWeight["category"]>();
  return weights.filter((entry) => {
    if (seen.has(entry.category)) return false;
    seen.add(entry.category);
    return true;
  });
}

/** Largest amount first; equal amounts follow the canonical category order. */
const byAmountThenCategory = (a: Allocation, b: Allocation): number =>
  b.amountINR - a.amountINR || budgetCategoryRank(a.category) - budgetCategoryRank(b.category);

/**
 * Turns AI category weights into whole-rupee allocations. Contingency is
 * `round(total × pct / 100)`; the remainder is split by largest remainder, so
 * allocations plus contingency equal `totalINR` exactly. Duplicate categories keep the first.
 * @param args Total, weights, guest count and optional contingency percent.
 * @returns The contingency and lines sorted by amount (descending), then category order.
 */
export function allocateBudget(args: {
  totalINR: number;
  weights: BudgetWeight[];
  guests: number;
  contingencyPercent?: number;
}): { contingencyINR: number; allocations: Allocation[] } {
  const { totalINR, guests, contingencyPercent = CONTINGENCY_PERCENT } = args;
  const weights = firstPerCategory(args.weights);
  const contingencyINR = contingencyFor(totalINR, contingencyPercent);
  const amounts = largestRemainder(
    totalINR - contingencyINR,
    weights.map((entry) => entry.weight),
  );
  const lines: Allocation[] = weights.map((entry, index) => ({
    category: entry.category,
    amountINR: amounts[index],
    percent: 0,
    perGuestINR: 0,
    rationale: entry.rationale,
    locked: false,
    actualINR: null,
  }));
  return {
    contingencyINR,
    allocations: withDerived(lines.sort(byAmountThenCategory), totalINR, guests),
  };
}
