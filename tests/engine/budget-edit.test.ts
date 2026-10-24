// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { applyEdits, rebalance, setActual, setLocked } from "@/lib/engine/budget";

const ctx = { totalINR: 1_000, guests: 10 };
const line = (category: BudgetCategory, amountINR: number, extra: Partial<Allocation> = {}): Allocation => ({
  category,
  amountINR,
  percent: 0,
  perGuestINR: 0,
  rationale: `why ${category}`,
  locked: false,
  actualINR: null,
  ...extra,
});
const base = (): Allocation[] => [line("venue", 400), line("catering", 300), line("decor", 200), line("misc", 100)];
const amounts = (l: Allocation[]): number[] => l.map((a) => a.amountINR);

describe("rebalance", () => {
  it("scales the other lines proportionally, keeping the sum", () => {
    const out = rebalance(base(), "venue", 500, ctx);
    expect(amounts(out)).toEqual([500, 250, 167, 83]);
    expect(out.map((a) => [a.percent, a.perGuestINR])).toEqual([
      [50, 50],
      [25, 25],
      [16.7, 17],
      [8.3, 8],
    ]);
  });

  it("keeps locked lines fixed", () => {
    expect(amounts(rebalance(setLocked(base(), "catering", true), "venue", 500, ctx))).toEqual([500, 300, 133, 67]);
  });

  it("clamps the target to what the locked lines leave", () => {
    const locked = setLocked(base(), "catering", true);
    expect(amounts(rebalance(locked, "venue", 9_999, ctx))).toEqual([700, 300, 0, 0]);
    expect(amounts(rebalance(locked, "venue", -50, ctx))).toEqual([0, 300, 467, 233]);
  });

  it("forces the target when nothing else can absorb the change", () => {
    const allLocked = base().map((a) => (a.category === "venue" ? a : { ...a, locked: true }));
    expect(amounts(rebalance(allLocked, "venue", 999, ctx))).toEqual([400, 300, 200, 100]);
    expect(amounts(rebalance([line("venue", 1_000)], "venue", 5, ctx))).toEqual([1_000]);
  });

  it("splits evenly when the unlocked others are all zero", () => {
    expect(amounts(rebalance([line("venue", 1_000), line("catering", 0), line("decor", 0)], "venue", 400, ctx))).toEqual([
      400, 300, 300,
    ]);
  });

  it("rounds fractions and treats NaN as zero or infinity as the maximum", () => {
    expect(rebalance(base(), "venue", 500.6, ctx)[0].amountINR).toBe(501);
    expect(rebalance(base(), "venue", Number.NaN, ctx)[0].amountINR).toBe(0);
    expect(rebalance(base(), "venue", Infinity, ctx)[0].amountINR).toBe(1_000);
  });

  it("lets a locked target move and keeps its flag", () => {
    const out = rebalance(setLocked(base(), "venue", true), "venue", 100, ctx);
    expect(out[0]).toMatchObject({ amountINR: 100, locked: true });
    expect(amounts(out).reduce((a, b) => a + b, 0)).toBe(1_000);
  });

  it("returns a copy for an unknown category", () => {
    const input = base().slice(1);
    const out = rebalance(input, "venue", 500, ctx);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("does not mutate its input", () => {
    const input = base();
    rebalance(input, "venue", 500, ctx);
    expect(input).toEqual(base());
  });
});

describe("setLocked / setActual", () => {
  it("change only the named line", () => {
    const locked = setLocked(base(), "decor", true);
    expect(locked.map((a) => a.locked)).toEqual([false, false, true, false]);
    expect(setLocked(locked, "decor", false).every((a) => !a.locked)).toBe(true);
    const actual = setActual(base(), "misc", 120);
    expect(actual.map((a) => a.actualINR)).toEqual([null, null, null, 120]);
    expect(setActual(actual, "misc", null)[3].actualINR).toBeNull();
  });

  it("ignore unknown categories and leave the input alone", () => {
    const input = base().slice(0, 2);
    expect(setLocked(input, "decor", true)).toEqual(input);
    expect(setActual(input, "decor", 5)).toEqual(input);
    expect(input.every((a) => !a.locked && a.actualINR === null)).toBe(true);
  });
});

describe("applyEdits", () => {
  const current = base().map((a) => ({ ...a, actualINR: a.category === "misc" ? 90 : null }));
  const edit = (category: BudgetCategory, amountINR: number, locked = false) => ({ category, amountINR, locked });
  const valid = [edit("misc", 50), edit("venue", 450, true), edit("catering", 300), edit("decor", 200)];

  it("applies amounts and locks, keeping rationale and actuals", () => {
    const out = applyEdits(current, valid, ctx);
    expect(out?.map((a) => [a.category, a.amountINR, a.locked])).toEqual([
      ["venue", 450, true],
      ["catering", 300, false],
      ["decor", 200, false],
      ["misc", 50, false],
    ]);
    expect(out?.[3]).toMatchObject({ actualINR: 90, rationale: "why misc", percent: 5, perGuestINR: 5 });
  });

  it("rejects a different number of edits", () => {
    expect(applyEdits(current, valid.slice(1), ctx)).toBeNull();
    expect(applyEdits(current, [...valid, edit("gifts", 0)], ctx)).toBeNull();
  });

  it("rejects a different total", () => {
    const over = [edit("venue", 401), edit("catering", 300), edit("decor", 200), edit("misc", 100)];
    expect(applyEdits(current, over, ctx)).toBeNull();
  });

  it("rejects negative or fractional amounts even when the sum matches", () => {
    expect(applyEdits(current, [edit("venue", 500), edit("catering", 300), edit("decor", 300), edit("misc", -100)], ctx)).toBeNull();
    expect(applyEdits(current, [edit("venue", 400.5), edit("catering", 299.5), edit("decor", 200), edit("misc", 100)], ctx)).toBeNull();
  });

  it("rejects a different or duplicated category set", () => {
    expect(applyEdits(current, [edit("venue", 400), edit("catering", 300), edit("decor", 200), edit("gifts", 100)], ctx)).toBeNull();
    expect(applyEdits(current, [edit("venue", 400), edit("venue", 300), edit("decor", 200), edit("misc", 100)], ctx)).toBeNull();
  });
});
