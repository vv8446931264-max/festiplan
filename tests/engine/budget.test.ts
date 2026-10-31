// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Allocation, BudgetCategory, BudgetWeight } from "@/lib/contracts";
import { allocateBudget, largestRemainder, withDerived } from "@/lib/engine/budget";

const line = (
  category: BudgetCategory,
  amountINR: number,
  extra: Partial<Allocation> = {},
): Allocation => ({
  category,
  amountINR,
  percent: 0,
  perGuestINR: 0,
  rationale: `why ${category}`,
  locked: false,
  actualINR: null,
  ...extra,
});
const weight = (
  category: BudgetCategory,
  w: number,
  rationale = `r-${category}`,
): BudgetWeight => ({
  category,
  weight: w,
  rationale,
});
const amounts = (l: Allocation[]): number[] => l.map((a) => a.amountINR);

describe("largestRemainder", () => {
  it("returns [] for no weights", () => expect(largestRemainder(100, [])).toEqual([]));

  it("splits exactly proportional totals", () => {
    expect(largestRemainder(900_000, [40, 30, 20, 10])).toEqual([
      360_000, 270_000, 180_000, 90_000,
    ]);
  });

  it("hands leftover rupees to the largest fractions first", () => {
    expect(largestRemainder(10, [1, 2])).toEqual([3, 7]);
    expect(largestRemainder(10, [2, 1])).toEqual([7, 3]);
  });

  it("breaks ties towards the lower index", () => {
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(largestRemainder(2, [1, 1, 1])).toEqual([1, 1, 0]);
    expect(largestRemainder(1, [5, 5])).toEqual([1, 0]);
  });

  it("splits evenly when every weight is zero", () => {
    expect(largestRemainder(7, [0, 0, 0])).toEqual([3, 2, 2]);
    expect(largestRemainder(0, [0, 0])).toEqual([0, 0]);
  });

  it("treats NaN, negative and infinite weights as zero", () => {
    expect(largestRemainder(5, [Number.NaN, -3, Infinity, 5])).toEqual([0, 0, 0, 5]);
  });

  it("gives zeros for a zero or negative total", () => {
    expect(largestRemainder(0, [1, 2])).toEqual([0, 0]);
    expect(largestRemainder(-5, [1, 2])).toEqual([0, 0]);
  });

  it("supports fractional weights", () => {
    expect(largestRemainder(10, [0.5, 0.5])).toEqual([5, 5]);
    expect(largestRemainder(100, [0.1, 0.2, 0.7])).toEqual([10, 20, 70]);
  });

  it("stays exact where floating point would drift", () => {
    expect(largestRemainder(499_999_999, [500_000_000, 500_000_000, 500_000_000])).toEqual([
      166_666_667, 166_666_666, 166_666_666,
    ]);
    expect(largestRemainder(500_000_000, [499_999_999, 1])).toEqual([499_999_999, 1]);
  });
});

describe("allocateBudget", () => {
  const weights = [
    weight("misc", 10),
    weight("venue", 40),
    weight("decor", 20),
    weight("catering", 30),
  ];

  it("reserves 10% contingency and splits the rest by weight, largest first", () => {
    const { contingencyINR, allocations } = allocateBudget({
      totalINR: 1_000_000,
      weights,
      guests: 200,
    });
    expect(contingencyINR).toBe(100_000);
    expect(allocations.map((a) => [a.category, a.amountINR, a.percent, a.perGuestINR])).toEqual([
      ["venue", 360_000, 36, 1800],
      ["catering", 270_000, 27, 1350],
      ["decor", 180_000, 18, 900],
      ["misc", 90_000, 9, 450],
    ]);
    expect(allocations[0]).toMatchObject({ rationale: "r-venue", locked: false, actualINR: null });
  });

  it("honours a custom contingency percent and rounds it", () => {
    expect(
      allocateBudget({ totalINR: 1_000_003, weights, guests: 1, contingencyPercent: 5 })
        .contingencyINR,
    ).toBe(50_000);
    expect(allocateBudget({ totalINR: 1_005, weights, guests: 1 }).contingencyINR).toBe(101);
  });

  it("clamps contingency to between 0 and the total", () => {
    const all = allocateBudget({ totalINR: 1_000, weights, guests: 1, contingencyPercent: 150 });
    expect(all.contingencyINR).toBe(1_000);
    expect(amounts(all.allocations)).toEqual([0, 0, 0, 0]);
    expect(
      allocateBudget({ totalINR: 1_000, weights, guests: 1, contingencyPercent: -5 })
        .contingencyINR,
    ).toBe(0);
  });

  it("breaks equal amounts by budget-category order", () => {
    const { allocations } = allocateBudget({
      totalINR: 1_000,
      weights: [weight("misc", 10), weight("venue", 10)],
      guests: 1,
      contingencyPercent: 0,
    });
    expect(allocations.map((a) => a.category)).toEqual(["venue", "misc"]);
  });

  it("keeps the first of duplicate categories", () => {
    const { allocations } = allocateBudget({
      totalINR: 1_000,
      weights: [
        weight("venue", 10, "first"),
        weight("venue", 90, "second"),
        weight("catering", 10),
      ],
      guests: 1,
      contingencyPercent: 0,
    });
    expect(allocations.map((a) => [a.category, a.amountINR, a.rationale])).toEqual([
      ["venue", 500, "first"],
      ["catering", 500, "r-catering"],
    ]);
  });

  it("returns no lines when there are no weights", () => {
    expect(allocateBudget({ totalINR: 1_000, weights: [], guests: 1 })).toEqual({
      contingencyINR: 100,
      allocations: [],
    });
  });
});

describe("withDerived", () => {
  it("recomputes percent (one decimal) and per-guest cost", () => {
    const out = withDerived([line("venue", 333), line("misc", 667)], 1_000, 7);
    expect(out.map((a) => [a.percent, a.perGuestINR])).toEqual([
      [33.3, 48],
      [66.7, 95],
    ]);
  });

  it("does not divide by zero", () => {
    expect(withDerived([line("venue", 0)], 0, 0)[0]).toMatchObject({ percent: 0, perGuestINR: 0 });
  });
});
