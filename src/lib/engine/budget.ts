import { BUDGET_CATEGORIES, CONTINGENCY_PERCENT } from "@/lib/contracts";
import type { Allocation, BudgetCategory, BudgetWeight } from "@/lib/contracts";

export { budgetVariance, overspendAlerts } from "./budget-variance";
export type { BudgetVariance, OverspendAlert, VarianceRow } from "./budget-variance";

/** Total budget and guest count needed to recompute derived fields. */
export type BudgetContext = { totalINR: number; guests: number };

/** One user edit to a budget line (mirrors a `PlanPatch` allocation). */
export type AllocationEdit = { category: BudgetCategory; amountINR: number; locked: boolean };

const WEIGHT_SCALE = 1_000_000;
const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
const toWeight = (w: number): bigint =>
  Number.isFinite(w) && w > 0 ? BigInt(Math.round(w * WEIGHT_SCALE)) : 0n;
const categoryRank = (c: BudgetCategory): number => BUDGET_CATEGORIES.indexOf(c);

/**
 * Splits an integer `total` across `weights` so the parts are non-negative integers
 * that sum exactly to `total`. Uses exact (BigInt) largest-remainder; ties go to the
 * lower index. Zero or invalid weights split evenly. No weights gives `[]`.
 * @param total Integer amount to split (negatives are treated as 0).
 * @param weights Relative weights.
 */
export function largestRemainder(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  let w = weights.map(toWeight);
  let all = w.reduce((a, b) => a + b, 0n);
  if (all === 0n) {
    w = weights.map(() => 1n);
    all = BigInt(weights.length);
  }
  const t = BigInt(Math.max(0, Math.trunc(total)));
  const parts = w.map((x, i) => ({ i, base: (t * x) / all, rem: (t * x) % all }));
  const left = Number(t - parts.reduce((a, p) => a + p.base, 0n));
  const ranked = [...parts].sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  const out = parts.map((p) => Number(p.base));
  for (const p of ranked.slice(0, left)) out[p.i] += 1;
  return out;
}

/**
 * Recomputes `percent` (share of the total, one decimal) and `perGuestINR` for every line.
 * @param allocations Budget lines.
 * @param totalINR Total budget, contingency included.
 * @param guests Guest count (at least 1 is assumed).
 */
export function withDerived(allocations: Allocation[], totalINR: number, guests: number): Allocation[] {
  return allocations.map((a) => ({
    ...a,
    percent: Math.round((a.amountINR / Math.max(1, totalINR)) * 1000) / 10,
    perGuestINR: Math.round(a.amountINR / Math.max(1, guests)),
  }));
}

const firstPerCategory = (weights: BudgetWeight[]): BudgetWeight[] => {
  const seen = new Set<BudgetCategory>();
  return weights.filter((w) => {
    if (seen.has(w.category)) return false;
    seen.add(w.category);
    return true;
  });
};

const byAmountThenCategory = (a: Allocation, b: Allocation): number =>
  b.amountINR - a.amountINR || categoryRank(a.category) - categoryRank(b.category);

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
  const contingencyINR = Math.min(totalINR, Math.max(0, Math.round((totalINR * contingencyPercent) / 100)));
  const amounts = largestRemainder(totalINR - contingencyINR, weights.map((w) => w.weight));
  const lines: Allocation[] = weights.map((w, i) => ({
    category: w.category,
    amountINR: amounts[i],
    percent: 0,
    perGuestINR: 0,
    rationale: w.rationale,
    locked: false,
    actualINR: null,
  }));
  return { contingencyINR, allocations: withDerived(lines.sort(byAmountThenCategory), totalINR, guests) };
}

const clampAmount = (value: number, max: number): number => {
  const whole = Math.round(value);
  return whole > 0 ? Math.min(whole, max) : 0;
};

/**
 * Sets one line to `amountINR` and rescales the unlocked others proportionally (largest
 * remainder), so the allocated sum never changes. Locked others stay fixed; the target is
 * clamped to what is left after them (and forced to it when no unlocked line can absorb the
 * change). An unknown category returns a copy of the input.
 * @param allocations Current lines.
 * @param category Line being edited.
 * @param amountINR Requested amount.
 * @param ctx Total budget and guests, for the derived fields.
 */
export function rebalance(
  allocations: Allocation[],
  category: BudgetCategory,
  amountINR: number,
  ctx: BudgetContext,
): Allocation[] {
  if (!allocations.some((a) => a.category === category)) return [...allocations];
  const others = allocations.filter((a) => a.category !== category);
  const free = others.filter((a) => !a.locked);
  const room = sum(allocations.map((a) => a.amountINR)) - sum(others.filter((a) => a.locked).map((a) => a.amountINR));
  const target = free.length === 0 ? room : clampAmount(amountINR, room);
  const shares = largestRemainder(room - target, free.map((a) => a.amountINR));
  const next = new Map<BudgetCategory, number>(free.map((a, i) => [a.category, shares[i]]));
  next.set(category, target);
  return withDerived(
    allocations.map((a) => ({ ...a, amountINR: next.get(a.category) ?? a.amountINR })),
    ctx.totalINR,
    ctx.guests,
  );
}

/**
 * Locks or unlocks one line.
 * @param allocations Current lines.
 * @param category Line to change.
 * @param locked New lock state.
 */
export function setLocked(allocations: Allocation[], category: BudgetCategory, locked: boolean): Allocation[] {
  return allocations.map((a) => (a.category === category ? { ...a, locked } : a));
}

/**
 * Records (or clears, with `null`) the actual spend for one line.
 * @param allocations Current lines.
 * @param category Line to change.
 * @param actualINR Actual rupees spent, or `null` to clear.
 */
export function setActual(allocations: Allocation[], category: BudgetCategory, actualINR: number | null): Allocation[] {
  return allocations.map((a) => (a.category === category ? { ...a, actualINR } : a));
}

const isWholeRupees = (n: number): boolean => Number.isInteger(n) && n >= 0;

/**
 * Applies a full set of user edits. Returns `null` unless the edits cover exactly the same
 * categories as `current`, every amount is a non-negative whole number, and the amounts
 * sum to exactly the current total. Rationale and actuals are kept.
 * @param current Current lines.
 * @param edits One edit per category.
 * @param ctx Total budget and guests, for the derived fields.
 */
export function applyEdits(current: Allocation[], edits: AllocationEdit[], ctx: BudgetContext): Allocation[] | null {
  if (edits.length !== current.length) return null;
  if (!edits.every((e) => isWholeRupees(e.amountINR))) return null;
  if (sum(edits.map((e) => e.amountINR)) !== sum(current.map((a) => a.amountINR))) return null;
  const lines: Allocation[] = [];
  for (const a of current) {
    const edit = edits.find((e) => e.category === a.category);
    if (!edit) return null;
    lines.push({ ...a, amountINR: edit.amountINR, locked: edit.locked });
  }
  return withDerived(lines, ctx.totalINR, ctx.guests);
}
