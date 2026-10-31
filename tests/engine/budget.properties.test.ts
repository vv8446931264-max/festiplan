// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BUDGET_CATEGORIES } from "@/lib/contracts/constants";
import type { Allocation, BudgetWeight } from "@/lib/contracts";
import { allocateBudget, withDerived } from "@/lib/engine/budget";
import { applyEdits, rebalance } from "@/lib/engine/budget-edit";
import { largestRemainder } from "@/lib/engine/largest-remainder";
import { amountsOf, sum } from "./builders";
import { int, mulberry32 } from "./prng";

const CASES = 500;
const isWhole = (amount: number): boolean => Number.isInteger(amount) && amount >= 0;

function randomWeights(rand: () => number): BudgetWeight[] {
  const categories = [...BUDGET_CATEGORIES]
    .sort(() => rand() - 0.5)
    .slice(0, int(rand, 4, BUDGET_CATEGORIES.length));
  return categories.map((category) => ({
    category,
    weight: int(rand, 1, 100),
    rationale: category,
  }));
}

function randomPlan(rand: () => number): {
  total: number;
  guests: number;
  contingency: number;
  lines: Allocation[];
} {
  const total = int(rand, 1_000, 500_000_000);
  const guests = int(rand, 1, 5_000);
  const out = allocateBudget({
    totalINR: total,
    weights: randomWeights(rand),
    guests,
    contingencyPercent: int(rand, 0, 30),
  });
  return { total, guests, contingency: out.contingencyINR, lines: out.allocations };
}

describe("largestRemainder (property)", () => {
  it("always sums exactly to the total with whole, non-negative parts, within 1 of exact", () => {
    const rand = mulberry32(1);
    for (let run = 0; run < CASES; run++) {
      const total = rand() < 0.2 ? int(rand, 0, 20) : int(rand, 0, 500_000_000);
      const big = rand() < 0.3;
      const weights = Array.from({ length: int(rand, 1, 12) }, () =>
        rand() < 0.15 ? 0 : big ? int(rand, 0, 500_000_000) : int(rand, 0, 1_000),
      );
      const out = largestRemainder(total, weights);
      const totalWeight = sum(weights);
      expect(out).toHaveLength(weights.length);
      expect(sum(out)).toBe(total);
      expect(out.every(isWhole)).toBe(true);
      out.forEach((part, index) => {
        const exact =
          totalWeight > 0 ? (total * weights[index]) / totalWeight : total / weights.length;
        expect(Math.abs(part - exact)).toBeLessThan(1 + 1e-6);
      });
    }
  });
});

describe("allocateBudget (property)", () => {
  it("allocations plus contingency equal the total exactly, sorted, unique, non-negative", () => {
    const rand = mulberry32(2);
    for (let run = 0; run < CASES; run++) {
      const { total, contingency, lines } = randomPlan(rand);
      expect(sum(amountsOf(lines)) + contingency).toBe(total);
      expect(lines.every((line) => isWhole(line.amountINR))).toBe(true);
      expect(new Set(lines.map((line) => line.category)).size).toBe(lines.length);
      for (let index = 1; index < lines.length; index++) {
        expect(lines[index - 1].amountINR).toBeGreaterThanOrEqual(lines[index].amountINR);
      }
    }
  });
});

describe("rebalance (property)", () => {
  it("never drifts, never goes negative, never moves a locked line, keeps order", () => {
    const rand = mulberry32(3);
    for (let run = 0; run < CASES; run++) {
      const { total, guests, lines } = randomPlan(rand);
      const locked = lines.map((line) => (rand() < 0.3 ? { ...line, locked: true } : line));
      const target = locked[int(rand, 0, locked.length - 1)];
      const asked = int(rand, -500, Math.floor(total * 1.5));
      const out = rebalance(locked, target.category, asked, { totalINR: total, guests });

      expect(sum(amountsOf(out))).toBe(sum(amountsOf(locked)));
      expect(out.every((line) => isWhole(line.amountINR))).toBe(true);
      expect(out.map((line) => line.category)).toEqual(locked.map((line) => line.category));
      locked.forEach((before, index) => {
        if (before.locked && before.category !== target.category) {
          expect(out[index].amountINR).toBe(before.amountINR);
        }
      });

      const others = locked.filter((line) => line.category !== target.category);
      const room = sum(amountsOf(locked)) - sum(amountsOf(others.filter((line) => line.locked)));
      const hasFree = others.some((line) => !line.locked);
      const result = out.find((line) => line.category === target.category)?.amountINR;
      expect(result).toBe(hasFree ? Math.min(Math.max(asked, 0), room) : room);
      expect(out).toEqual(withDerived(out, total, guests));
    }
  });
});

describe("applyEdits (property)", () => {
  it("accepts any redistribution with the same total and rejects any drift", () => {
    const rand = mulberry32(4);
    for (let run = 0; run < CASES; run++) {
      const { total, guests, lines } = randomPlan(rand);
      const context = { totalINR: total, guests };
      const shares = largestRemainder(
        sum(amountsOf(lines)),
        lines.map(() => int(rand, 0, 100)),
      );
      const edits = lines.map((line, index) => ({
        category: line.category,
        amountINR: shares[index],
        locked: rand() < 0.5,
      }));
      const out = applyEdits(lines, edits, context);
      expect(out?.map((line) => line.amountINR)).toEqual(shares);
      expect(out?.map((line) => line.locked)).toEqual(edits.map((edit) => edit.locked));
      const drift = edits.map((edit, index) =>
        index === 0 ? { ...edit, amountINR: edit.amountINR + 1 } : edit,
      );
      expect(applyEdits(lines, drift, context)).toBeNull();
    }
  });
});
