// @vitest-environment node
import { describe, expect, it } from "vitest";
import { largestRemainder } from "@/lib/engine/largest-remainder";

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
