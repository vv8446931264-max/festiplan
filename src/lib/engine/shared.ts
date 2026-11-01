import { BUDGET_CATEGORIES, type BudgetCategory } from "@/lib/contracts/constants";

/*
 * Small helpers shared by engine modules. Internal: deliberately not re-exported from the
 * engine barrel, so the public API stays the set of planning functions.
 */

/** Sum of a list of numbers; 0 for an empty list. */
export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `value` when it is a positive finite number, otherwise 0 (negatives, NaN and ±Infinity). */
export function positiveOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Ascending comparator for numbers or strings; ISO dates order correctly as strings. */
export function compareAscending<T extends number | string>(a: T, b: T): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Position of a category in the canonical `BUDGET_CATEGORIES` order, for stable tie-breaks. */
export function budgetCategoryRank(category: BudgetCategory): number {
  return BUDGET_CATEGORIES.indexOf(category);
}

/** An ISO `YYYY-MM-DD` date in the "basic" `YYYYMMDD` form used by iCalendar and Google. */
export function toBasicDate(iso: string): string {
  return iso.replaceAll("-", "");
}
