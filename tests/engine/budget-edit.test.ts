// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { applyEdits, rebalance, setActual, setLocked } from "@/lib/engine/budget-edit";
import { allocation, amountsOf, sum } from "./builders";

const context = { totalINR: 1_000, guests: 10 };
const base = (): Allocation[] => [
  allocation("venue", 400),
  allocation("catering", 300),
  allocation("decor", 200),
  allocation("misc", 100),
];

describe("rebalance", () => {
  it("scales the other lines proportionally, keeping the sum", () => {
    const out = rebalance(base(), "venue", 500, context);
    expect(amountsOf(out)).toEqual([500, 250, 167, 83]);
    expect(out.map((line) => [line.percent, line.perGuestINR])).toEqual([
      [50, 50],
      [25, 25],
      [16.7, 17],
      [8.3, 8],
    ]);
  });

  it("keeps locked lines fixed", () => {
    const locked = setLocked(base(), "catering", true);
    expect(amountsOf(rebalance(locked, "venue", 500, context))).toEqual([500, 300, 133, 67]);
  });

  it("clamps the target to what the locked lines leave", () => {
    const locked = setLocked(base(), "catering", true);
    expect(amountsOf(rebalance(locked, "venue", 9_999, context))).toEqual([700, 300, 0, 0]);
    expect(amountsOf(rebalance(locked, "venue", -50, context))).toEqual([0, 300, 467, 233]);
  });

  it("forces the target when nothing else can absorb the change", () => {
    const allLocked = base().map((line) =>
      line.category === "venue" ? line : { ...line, locked: true },
    );
    expect(amountsOf(rebalance(allLocked, "venue", 999, context))).toEqual([400, 300, 200, 100]);
    expect(amountsOf(rebalance([allocation("venue", 1_000)], "venue", 5, context))).toEqual([
      1_000,
    ]);
  });

  it("splits evenly when the unlocked others are all zero", () => {
    const lines = [allocation("venue", 1_000), allocation("catering", 0), allocation("decor", 0)];
    expect(amountsOf(rebalance(lines, "venue", 400, context))).toEqual([400, 300, 300]);
  });

  it("rounds fractions and treats NaN as zero or infinity as the maximum", () => {
    expect(rebalance(base(), "venue", 500.6, context)[0].amountINR).toBe(501);
    expect(rebalance(base(), "venue", Number.NaN, context)[0].amountINR).toBe(0);
    expect(rebalance(base(), "venue", Infinity, context)[0].amountINR).toBe(1_000);
  });

  it("lets a locked target move and keeps its flag", () => {
    const out = rebalance(setLocked(base(), "venue", true), "venue", 100, context);
    expect(out[0]).toMatchObject({ amountINR: 100, locked: true });
    expect(sum(amountsOf(out))).toBe(1_000);
  });

  it("returns a copy for an unknown category", () => {
    const input = base().slice(1);
    const out = rebalance(input, "venue", 500, context);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("does not mutate its input", () => {
    const input = base();
    rebalance(input, "venue", 500, context);
    expect(input).toEqual(base());
  });
});

describe("setLocked / setActual", () => {
  it("change only the named line", () => {
    const locked = setLocked(base(), "decor", true);
    expect(locked.map((line) => line.locked)).toEqual([false, false, true, false]);
    expect(setLocked(locked, "decor", false).every((line) => !line.locked)).toBe(true);
    const actual = setActual(base(), "misc", 120);
    expect(actual.map((line) => line.actualINR)).toEqual([null, null, null, 120]);
    expect(setActual(actual, "misc", null)[3].actualINR).toBeNull();
  });

  it("ignore unknown categories and leave the input alone", () => {
    const input = base().slice(0, 2);
    expect(setLocked(input, "decor", true)).toEqual(input);
    expect(setActual(input, "decor", 5)).toEqual(input);
    expect(input.every((line) => !line.locked && line.actualINR === null)).toBe(true);
  });
});

describe("applyEdits", () => {
  const current = base().map((line) => ({
    ...line,
    actualINR: line.category === "misc" ? 90 : null,
  }));
  const edit = (category: BudgetCategory, amountINR: number, locked = false) => ({
    category,
    amountINR,
    locked,
  });
  const valid = [
    edit("misc", 50),
    edit("venue", 450, true),
    edit("catering", 300),
    edit("decor", 200),
  ];

  it("applies amounts and locks, keeping rationale and actuals", () => {
    const out = applyEdits(current, valid, context);
    expect(out?.map((line) => [line.category, line.amountINR, line.locked])).toEqual([
      ["venue", 450, true],
      ["catering", 300, false],
      ["decor", 200, false],
      ["misc", 50, false],
    ]);
    expect(out?.[3]).toMatchObject({
      actualINR: 90,
      rationale: "why misc",
      percent: 5,
      perGuestINR: 5,
    });
  });

  it("rejects a different number of edits", () => {
    expect(applyEdits(current, valid.slice(1), context)).toBeNull();
    expect(applyEdits(current, [...valid, edit("gifts", 0)], context)).toBeNull();
  });

  it("rejects a different total", () => {
    const over = [edit("venue", 401), edit("catering", 300), edit("decor", 200), edit("misc", 100)];
    expect(applyEdits(current, over, context)).toBeNull();
  });

  it("rejects negative or fractional amounts even when the sum matches", () => {
    const negative = [
      edit("venue", 500),
      edit("catering", 300),
      edit("decor", 300),
      edit("misc", -100),
    ];
    const fractional = [
      edit("venue", 400.5),
      edit("catering", 299.5),
      edit("decor", 200),
      edit("misc", 100),
    ];
    expect(applyEdits(current, negative, context)).toBeNull();
    expect(applyEdits(current, fractional, context)).toBeNull();
  });

  it("rejects a different or duplicated category set", () => {
    const foreign = [
      edit("venue", 400),
      edit("catering", 300),
      edit("decor", 200),
      edit("gifts", 100),
    ];
    const repeated = [
      edit("venue", 400),
      edit("venue", 300),
      edit("decor", 200),
      edit("misc", 100),
    ];
    expect(applyEdits(current, foreign, context)).toBeNull();
    expect(applyEdits(current, repeated, context)).toBeNull();
  });
});
