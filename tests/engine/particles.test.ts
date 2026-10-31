// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BUDGET_CATEGORIES } from "@/lib/contracts/constants";
import {
  assignParticles,
  emptyAssignment,
  hash01,
  layoutParticles,
  type ParticleAllocation,
  type ParticleAssignment,
} from "@/lib/engine/particles";
import { sum } from "./builders";

const lines = (amounts: number[]): ParticleAllocation[] =>
  amounts.map((amountINR, i) => ({
    category: BUDGET_CATEGORIES[i % BUDGET_CATEGORIES.length],
    amountINR,
  }));

/** Every column's slots are exactly 0..count-1, once each. */
function expectContiguous(a: ParticleAssignment) {
  a.counts.forEach((count, c) => {
    const slots = Array.from(a.column.keys())
      .filter((i) => a.column[i] === c)
      .map((i) => a.slot[i])
      .sort((x, y) => x - y);
    expect(slots).toEqual(Array.from({ length: count }, (_, k) => k));
  });
}

describe("layoutParticles", () => {
  it("sums to exactly n for many budgets", () => {
    for (let t = 0; t < 200; t++) {
      const amounts = Array.from({ length: 1 + (t % 10) }, (_, i) =>
        Math.floor(hash01(t * 31 + i) * 1_000_000),
      );
      const n = 1 + Math.floor(hash01(t) * 700);
      const counts = layoutParticles(lines(amounts), n);
      if (sum(amounts) > 0) expect(sum(counts)).toBe(n);
      counts.forEach((c, i) =>
        expect(Math.abs(c - (amounts[i] * n) / Math.max(sum(amounts), 1))).toBeLessThan(1),
      );
    }
  });

  it("splits proportionally and gives ties to the earlier line", () => {
    expect(layoutParticles(lines([50, 30, 20]), 10)).toEqual([5, 3, 2]);
    expect(layoutParticles(lines([1, 1, 1]), 10)).toEqual([4, 3, 3]);
    expect(layoutParticles(lines([1, 1]), 3)).toEqual([2, 1]);
  });

  it("returns all zeros for a zero total or no particles", () => {
    expect(layoutParticles(lines([0, 0, 0]), 600)).toEqual([0, 0, 0]);
    expect(layoutParticles(lines([10, 20]), 0)).toEqual([0, 0]);
    expect(layoutParticles(lines([10, 20]), Number.NaN)).toEqual([0, 0]);
    expect(layoutParticles([], 600)).toEqual([]);
  });

  it("treats negative and non-finite amounts as zero and floors n", () => {
    expect(layoutParticles(lines([-5, Number.POSITIVE_INFINITY, 10, Number.NaN]), 7.9)).toEqual([
      0, 0, 7, 0,
    ]);
  });
});

describe("assignParticles", () => {
  it("fills columns in order from an empty assignment", () => {
    const a = assignParticles(emptyAssignment(10), [3, 0, 7]);
    expect(a.counts).toEqual([3, 0, 7]);
    expect(Array.from(a.column)).toEqual([0, 0, 0, 2, 2, 2, 2, 2, 2, 2]);
    expectContiguous(a);
  });

  it("moves only the delta when one slider moves", () => {
    const n = 600;
    const before = lines([400_000, 250_000, 120_000, 90_000, 60_000, 30_000]);
    const after = before.map((l, i) => (i === 2 ? { ...l, amountINR: 240_000 } : l));
    const a = assignParticles(emptyAssignment(n), layoutParticles(before, n));
    const nextCounts = layoutParticles(after, n);
    const b = assignParticles(a, nextCounts);
    const moved = Array.from(b.column.keys()).filter((i) => a.column[i] !== b.column[i]);
    const delta = nextCounts.reduce((s, c, i) => s + Math.max(0, c - a.counts[i]), 0);
    expect(moved.length).toBe(delta);
    expect(moved.every((i) => b.column[i] === 2)).toBe(true);
    for (let i = 0; i < n; i++) if (a.column[i] === b.column[i]) expect(b.slot[i]).toBe(a.slot[i]);
    expect(b.counts).toEqual(nextCounts);
    expectContiguous(b);
  });

  it("is a no-op when counts do not change", () => {
    const a = assignParticles(emptyAssignment(50), [20, 30]);
    const b = assignParticles(a, [20, 30]);
    expect([Array.from(b.column), Array.from(b.slot)]).toEqual([
      Array.from(a.column),
      Array.from(a.slot),
    ]);
  });

  it("frees particles of dropped columns and parks the surplus", () => {
    const a = assignParticles(emptyAssignment(10), [4, 6]);
    const fewer = assignParticles(a, [3]);
    expect(fewer.counts).toEqual([3]);
    const parked = Array.from(fewer.column.keys()).filter((i) => fewer.column[i] === -1);
    expect(parked.length).toBe(7);
    expect(parked.map((i) => fewer.slot[i])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("caps columns when the counts ask for more particles than exist", () => {
    expect(assignParticles(emptyAssignment(5), [4, 4]).counts).toEqual([4, 1]);
  });

  it("repairs malformed input (negative and duplicate slots)", () => {
    const prev: ParticleAssignment = {
      column: Int16Array.from([0, 0, 0, 1]),
      slot: Int32Array.from([0, 0, -1, 9]),
      counts: [3, 1],
    };
    const next = assignParticles(prev, [3, 1.7, -2]);
    expect(next.counts).toEqual([3, 1, 0]);
    expect(next.column[0]).toBe(0);
    expect(next.slot[0]).toBe(0);
    expectContiguous(next);
  });
});
