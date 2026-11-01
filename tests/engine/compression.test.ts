// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  compressedLeadDays,
  compressionFactor,
  daysToWeeks,
  scheduleCompression,
} from "@/lib/engine/compression";
import { addDays } from "@/lib/engine/dates";
import { TODAY, aiTask as task } from "./builders";

describe("compressionFactor", () => {
  it("is 1 when the ideal span fits, or there is nothing to fit", () => {
    expect(compressionFactor(112, 113)).toBe(1);
    expect(compressionFactor(112, 112)).toBe(1);
    expect(compressionFactor(0, 0)).toBe(1);
    expect(compressionFactor(0, 50)).toBe(1);
    expect(compressionFactor(-7, 3)).toBe(1);
  });

  it("is available / ideal when the span does not fit", () => {
    expect(compressionFactor(182, 91)).toBe(0.5);
    expect(compressionFactor(280, 14)).toBeCloseTo(0.05, 10);
    expect(compressionFactor(7, 1)).toBeCloseTo(1 / 7, 10);
  });

  it("is 0, never negative, when no days are left", () => {
    expect(compressionFactor(70, 0)).toBe(0);
    expect(compressionFactor(70, -12)).toBe(0);
  });
});

describe("compressedLeadDays", () => {
  it("keeps whole weeks at factor 1 and rounds when compressed", () => {
    expect(compressedLeadDays(16, 1)).toBe(112);
    expect(compressedLeadDays(26, 12 / 182)).toBe(12);
    expect(compressedLeadDays(12, 12 / 182)).toBe(6);
  });

  it("keeps at least one day for any ideal week, and zero for lead-0 steps", () => {
    expect(compressedLeadDays(1, 0)).toBe(1);
    expect(compressedLeadDays(2, 0.001)).toBe(1);
    expect(compressedLeadDays(0, 0.5)).toBe(0);
    expect(compressedLeadDays(0, 1)).toBe(0);
  });
});

describe("scheduleCompression", () => {
  const event = addDays(TODAY, 113);

  it("reports no compression when the longest lead time fits", () => {
    expect(scheduleCompression([task("a", 16, 1), task("b", 4, 1)], event, TODAY)).toEqual({
      compressed: false,
      factor: 1,
      availableDays: 113,
      idealDays: 112,
    });
  });

  it("reports the proportional factor when it does not", () => {
    const info = scheduleCompression(
      [task("a", 26, 1), task("b", 4, 1)],
      addDays(TODAY, 12),
      TODAY,
    );
    expect(info).toMatchObject({ compressed: true, availableDays: 12, idealDays: 182 });
    expect(info.factor).toBeCloseTo(12 / 182, 12);
  });

  it("handles no tasks, an event today and an event already past", () => {
    expect(scheduleCompression([], event, TODAY)).toEqual({
      compressed: false,
      factor: 1,
      availableDays: 113,
      idealDays: 0,
    });
    expect(scheduleCompression([task("a", 3, 1)], TODAY, TODAY)).toEqual({
      compressed: true,
      factor: 0,
      availableDays: 0,
      idealDays: 21,
    });
    expect(scheduleCompression([task("a", 3, 1)], addDays(TODAY, -5), TODAY)).toMatchObject({
      compressed: true,
      factor: 0,
      availableDays: 0,
    });
    expect(scheduleCompression([task("a", 0, 1)], addDays(TODAY, -5), TODAY)).toMatchObject({
      compressed: false,
      factor: 1,
      availableDays: 0,
    });
  });

  it("accepts anything with a leadWeeks", () => {
    expect(scheduleCompression([{ leadWeeks: 40 }], addDays(TODAY, 70), TODAY)).toMatchObject({
      compressed: true,
      idealDays: 280,
    });
  });
});

describe("daysToWeeks", () => {
  it("is exact for whole weeks", () => {
    expect(daysToWeeks(0)).toBe(0);
    expect(daysToWeeks(7)).toBe(1);
    expect(daysToWeeks(112)).toBe(16);
  });

  it("rounds to the nearest week, halves up", () => {
    expect(daysToWeeks(3)).toBe(0);
    expect(daysToWeeks(4)).toBe(1);
    expect(daysToWeeks(10)).toBe(1);
    expect(daysToWeeks(11)).toBe(2);
    expect(daysToWeeks(10.5)).toBe(2);
  });

  it("turns scheduleCompression's ideal days back into the longest lead time in weeks", () => {
    const { idealDays } = scheduleCompression([task("a", 26), task("b", 8)], TODAY, TODAY);
    expect(daysToWeeks(idealDays)).toBe(26);
  });
});
