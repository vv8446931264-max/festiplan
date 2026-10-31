// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BUDGET_CATEGORIES } from "@/lib/contracts";
import type { Allocation, BudgetWeight } from "@/lib/contracts";
import {
  allocateBudget,
  applyEdits,
  largestRemainder,
  rebalance,
  withDerived,
} from "@/lib/engine/budget";

/** Tiny seeded PRNG so failures are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CASES = 500;
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const int = (rand: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rand() * (hi - lo + 1));
const isWhole = (n: number): boolean => Number.isInteger(n) && n >= 0;

function randomWeights(rand: () => number): BudgetWeight[] {
  const cats = [...BUDGET_CATEGORIES]
    .sort(() => rand() - 0.5)
    .slice(0, int(rand, 4, BUDGET_CATEGORIES.length));
  return cats.map((category) => ({ category, weight: int(rand, 1, 100), rationale: category }));
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
    for (let n = 0; n < CASES; n++) {
      const total = rand() < 0.2 ? int(rand, 0, 20) : int(rand, 0, 500_000_000);
      const big = rand() < 0.3;
      const weights = Array.from({ length: int(rand, 1, 12) }, () =>
        rand() < 0.15 ? 0 : big ? int(rand, 0, 500_000_000) : int(rand, 0, 1_000),
      );
      const out = largestRemainder(total, weights);
      const all = sum(weights);
      expect(out).toHaveLength(weights.length);
      expect(sum(out)).toBe(total);
      expect(out.every(isWhole)).toBe(true);
      out.forEach((part, i) => {
        const exact = all > 0 ? (total * weights[i]) / all : total / weights.length;
        expect(Math.abs(part - exact)).toBeLessThan(1 + 1e-6);
      });
    }
  });
});

describe("allocateBudget (property)", () => {
  it("allocations plus contingency equal the total exactly, sorted, unique, non-negative", () => {
    const rand = mulberry32(2);
    for (let n = 0; n < CASES; n++) {
      const { total, contingency, lines } = randomPlan(rand);
      expect(sum(lines.map((a) => a.amountINR)) + contingency).toBe(total);
      expect(lines.every((a) => isWhole(a.amountINR))).toBe(true);
      expect(new Set(lines.map((a) => a.category)).size).toBe(lines.length);
      for (let i = 1; i < lines.length; i++)
        expect(lines[i - 1].amountINR).toBeGreaterThanOrEqual(lines[i].amountINR);
    }
  });
});

describe("rebalance (property)", () => {
  it("never drifts, never goes negative, never moves a locked line, keeps order", () => {
    const rand = mulberry32(3);
    for (let n = 0; n < CASES; n++) {
      const { total, guests, lines } = randomPlan(rand);
      const locked = lines.map((a) => (rand() < 0.3 ? { ...a, locked: true } : a));
      const target = locked[int(rand, 0, locked.length - 1)];
      const asked = int(rand, -500, Math.floor(total * 1.5));
      const out = rebalance(locked, target.category, asked, { totalINR: total, guests });

      expect(sum(out.map((a) => a.amountINR))).toBe(sum(locked.map((a) => a.amountINR)));
      expect(out.every((a) => isWhole(a.amountINR))).toBe(true);
      expect(out.map((a) => a.category)).toEqual(locked.map((a) => a.category));
      locked.forEach((before, i) => {
        if (before.locked && before.category !== target.category)
          expect(out[i].amountINR).toBe(before.amountINR);
      });

      const lockedOthers = sum(
        locked.filter((a) => a.locked && a.category !== target.category).map((a) => a.amountINR),
      );
      const room = sum(locked.map((a) => a.amountINR)) - lockedOthers;
      const hasFree = locked.some((a) => !a.locked && a.category !== target.category);
      const result = out.find((a) => a.category === target.category)?.amountINR;
      expect(result).toBe(hasFree ? Math.min(Math.max(asked, 0), room) : room);
      expect(out).toEqual(withDerived(out, total, guests));
    }
  });
});

describe("applyEdits (property)", () => {
  it("accepts any redistribution with the same total and rejects any drift", () => {
    const rand = mulberry32(4);
    for (let n = 0; n < CASES; n++) {
      const { total, guests, lines } = randomPlan(rand);
      const ctx = { totalINR: total, guests };
      const current = sum(lines.map((a) => a.amountINR));
      const shares = largestRemainder(
        current,
        lines.map(() => int(rand, 0, 100)),
      );
      const edits = lines.map((a, i) => ({
        category: a.category,
        amountINR: shares[i],
        locked: rand() < 0.5,
      }));
      const out = applyEdits(lines, edits, ctx);
      expect(out?.map((a) => a.amountINR)).toEqual(shares);
      expect(out?.map((a) => a.locked)).toEqual(edits.map((e) => e.locked));
      const drift = edits.map((e, i) => (i === 0 ? { ...e, amountINR: e.amountINR + 1 } : e));
      expect(applyEdits(lines, drift, ctx)).toBeNull();
    }
  });
});
