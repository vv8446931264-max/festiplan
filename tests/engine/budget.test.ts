// @vitest-environment node
import { describe, expect, it } from "vitest";
import { allocateBudget, withDerived } from "@/lib/engine/budget";
import { allocation, amountsOf, budgetWeight } from "./builders";

describe("allocateBudget", () => {
  const weights = [
    budgetWeight("misc", 10),
    budgetWeight("venue", 40),
    budgetWeight("decor", 20),
    budgetWeight("catering", 30),
  ];

  it("reserves 10% contingency and splits the rest by weight, largest first", () => {
    const { contingencyINR, allocations } = allocateBudget({
      totalINR: 1_000_000,
      weights,
      guests: 200,
    });
    expect(contingencyINR).toBe(100_000);
    expect(
      allocations.map((line) => [line.category, line.amountINR, line.percent, line.perGuestINR]),
    ).toEqual([
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
    expect(amountsOf(all.allocations)).toEqual([0, 0, 0, 0]);
    expect(
      allocateBudget({ totalINR: 1_000, weights, guests: 1, contingencyPercent: -5 })
        .contingencyINR,
    ).toBe(0);
  });

  it("breaks equal amounts by budget-category order", () => {
    const { allocations } = allocateBudget({
      totalINR: 1_000,
      weights: [budgetWeight("misc", 10), budgetWeight("venue", 10)],
      guests: 1,
      contingencyPercent: 0,
    });
    expect(allocations.map((line) => line.category)).toEqual(["venue", "misc"]);
  });

  it("keeps the first of duplicate categories", () => {
    const { allocations } = allocateBudget({
      totalINR: 1_000,
      weights: [
        budgetWeight("venue", 10, "first"),
        budgetWeight("venue", 90, "second"),
        budgetWeight("catering", 10),
      ],
      guests: 1,
      contingencyPercent: 0,
    });
    expect(allocations.map((line) => [line.category, line.amountINR, line.rationale])).toEqual([
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
    const out = withDerived([allocation("venue", 333), allocation("misc", 667)], 1_000, 7);
    expect(out.map((line) => [line.percent, line.perGuestINR])).toEqual([
      [33.3, 48],
      [66.7, 95],
    ]);
  });

  it("does not divide by zero", () => {
    expect(withDerived([allocation("venue", 0)], 0, 0)[0]).toMatchObject({
      percent: 0,
      perGuestINR: 0,
    });
  });
});
