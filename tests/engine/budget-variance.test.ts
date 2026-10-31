// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { budgetVariance, overspendAlerts } from "@/lib/engine/budget";

const line = (
  category: BudgetCategory,
  amountINR: number,
  actualINR: number | null,
): Allocation => ({
  category,
  amountINR,
  percent: 0,
  perGuestINR: 0,
  rationale: "",
  locked: false,
  actualINR,
});

const lines = [
  line("venue", 400, 450),
  line("catering", 300, null),
  line("decor", 200, 150),
  line("photography", 100, 100),
  line("misc", 50, 90),
];

describe("budgetVariance", () => {
  it("compares planned and actual per row", () => {
    expect(budgetVariance(lines).rows).toEqual([
      { category: "venue", plannedINR: 400, actualINR: 450, varianceINR: 50, overspent: true },
      {
        category: "catering",
        plannedINR: 300,
        actualINR: null,
        varianceINR: null,
        overspent: false,
      },
      { category: "decor", plannedINR: 200, actualINR: 150, varianceINR: -50, overspent: false },
      {
        category: "photography",
        plannedINR: 100,
        actualINR: 100,
        varianceINR: 0,
        overspent: false,
      },
      { category: "misc", plannedINR: 50, actualINR: 90, varianceINR: 40, overspent: true },
    ]);
  });

  it("totals plan, recorded actuals and variance over rows that have an actual", () => {
    const v = budgetVariance(lines);
    expect(v.plannedINR).toBe(1_050);
    expect(v.actualINR).toBe(790);
    expect(v.varianceINR).toBe(40);
  });

  it("is all zero with no actuals or no lines", () => {
    expect(budgetVariance([line("venue", 100, null)])).toMatchObject({
      plannedINR: 100,
      actualINR: 0,
      varianceINR: 0,
    });
    expect(budgetVariance([])).toEqual({ rows: [], plannedINR: 0, actualINR: 0, varianceINR: 0 });
  });
});

describe("overspendAlerts", () => {
  it("lists only overspent rows, in order", () => {
    expect(overspendAlerts(lines, 1_000).map((a) => [a.category, a.overByINR])).toEqual([
      ["venue", 50],
      ["misc", 40],
    ]);
  });

  it("marks coverage by the cumulative overspend against contingency", () => {
    expect(overspendAlerts(lines, 60).map((a) => a.coveredByContingency)).toEqual([true, false]);
    expect(overspendAlerts(lines, 90).map((a) => a.coveredByContingency)).toEqual([true, true]);
    expect(overspendAlerts(lines, 49).map((a) => a.coveredByContingency)).toEqual([false, false]);
  });

  it("is empty when nothing is overspent", () => {
    expect(overspendAlerts([line("venue", 100, 100), line("misc", 10, null)], 50)).toEqual([]);
  });
});
