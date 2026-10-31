import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { withDerived } from "./budget";
import { largestRemainder } from "./largest-remainder";
import { sum } from "./shared";

/** Total budget and guest count needed to recompute derived fields. */
export type BudgetContext = { totalINR: number; guests: number };

/** One user edit to a budget line (mirrors a `PlanPatch` allocation). */
export type AllocationEdit = { category: BudgetCategory; amountINR: number; locked: boolean };

const amountsOf = (lines: readonly { amountINR: number }[]): number[] =>
  lines.map((line) => line.amountINR);

/** A requested amount as whole rupees within `[0, max]`. */
function clampAmount(value: number, max: number): number {
  const whole = Math.round(value);
  return whole > 0 ? Math.min(whole, max) : 0;
}

const isWholeRupees = (amount: number): boolean => Number.isInteger(amount) && amount >= 0;

/**
 * Sets one line to `amountINR` and rescales the unlocked others proportionally (largest
 * remainder), so the allocated sum never changes. Locked others stay fixed; the target is
 * clamped to what is left after them (and forced to it when no unlocked line can absorb the
 * change). An unknown category returns a copy of the input.
 * @param allocations Current lines.
 * @param category Line being edited.
 * @param amountINR Requested amount.
 * @param context Total budget and guests, for the derived fields.
 */
export function rebalance(
  allocations: Allocation[],
  category: BudgetCategory,
  amountINR: number,
  context: BudgetContext,
): Allocation[] {
  if (!allocations.some((line) => line.category === category)) return [...allocations];
  const others = allocations.filter((line) => line.category !== category);
  const unlocked = others.filter((line) => !line.locked);
  const lockedTotal = sum(amountsOf(others.filter((line) => line.locked)));
  const room = sum(amountsOf(allocations)) - lockedTotal;
  const target = unlocked.length === 0 ? room : clampAmount(amountINR, room);
  const shares = largestRemainder(room - target, amountsOf(unlocked));
  const nextAmounts = new Map<BudgetCategory, number>(
    unlocked.map((line, index) => [line.category, shares[index]]),
  );
  nextAmounts.set(category, target);
  return withDerived(
    allocations.map((line) => ({
      ...line,
      amountINR: nextAmounts.get(line.category) ?? line.amountINR,
    })),
    context.totalINR,
    context.guests,
  );
}

/**
 * Locks or unlocks one line.
 * @param allocations Current lines.
 * @param category Line to change.
 * @param locked New lock state.
 */
export function setLocked(
  allocations: Allocation[],
  category: BudgetCategory,
  locked: boolean,
): Allocation[] {
  return allocations.map((line) => (line.category === category ? { ...line, locked } : line));
}

/**
 * Records (or clears, with `null`) the actual spend for one line.
 * @param allocations Current lines.
 * @param category Line to change.
 * @param actualINR Actual rupees spent, or `null` to clear.
 */
export function setActual(
  allocations: Allocation[],
  category: BudgetCategory,
  actualINR: number | null,
): Allocation[] {
  return allocations.map((line) => (line.category === category ? { ...line, actualINR } : line));
}

/**
 * Applies a full set of user edits. Returns `null` unless the edits cover exactly the same
 * categories as `current`, every amount is a non-negative whole number, and the amounts
 * sum to exactly the current total. Rationale and actuals are kept.
 * @param current Current lines.
 * @param edits One edit per category.
 * @param context Total budget and guests, for the derived fields.
 */
export function applyEdits(
  current: Allocation[],
  edits: AllocationEdit[],
  context: BudgetContext,
): Allocation[] | null {
  if (edits.length !== current.length) return null;
  if (!edits.every((edit) => isWholeRupees(edit.amountINR))) return null;
  if (sum(amountsOf(edits)) !== sum(amountsOf(current))) return null;
  const lines: Allocation[] = [];
  for (const line of current) {
    const edit = edits.find((candidate) => candidate.category === line.category);
    if (!edit) return null;
    lines.push({ ...line, amountINR: edit.amountINR, locked: edit.locked });
  }
  return withDerived(lines, context.totalINR, context.guests);
}
