// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BUDGET_CATEGORIES } from "@/lib/contracts/constants";
import type { VendorGuide } from "@/lib/contracts";
import { scheduleVendors } from "@/lib/engine/checklist";
import { scheduleCompression } from "@/lib/engine/compression";
import { addDays, maxDate } from "@/lib/engine/dates";
import { TODAY } from "./builders";
import { int, mulberry32 } from "./prng";

/** Mix of near events (heavy compression) and far ones (none), always at least a day away. */
const eventAfter = (rand: () => number): string =>
  addDays(TODAY, rand() < 0.6 ? int(rand, 1, 60) : int(rand, 1, 900));

/** 1–10 vendors with distinct categories and book-by lead times of 0–104 weeks. */
function randomVendors(rand: () => number): VendorGuide[] {
  const categories = [...BUDGET_CATEGORIES]
    .sort(() => rand() - 0.5)
    .slice(0, int(rand, 1, BUDGET_CATEGORIES.length));
  return categories.map((category) => ({
    category,
    bookByWeeks: rand() < 0.1 ? 0 : int(rand, 1, 104),
    questions: ["Q1?", "Q2?"],
    redFlags: ["Flag"],
  }));
}

describe("scheduleVendors (property)", () => {
  it("books between today and the event, a day early for anything with lead time, in sorted order", () => {
    const rand = mulberry32(41);
    for (let run = 0; run < 500; run++) {
      const event = eventAfter(rand);
      const vendors = randomVendors(rand);
      const out = scheduleVendors(vendors, event, TODAY);
      expect(out).toHaveLength(vendors.length);
      for (const v of out) {
        const guide = vendors.find((candidate) => candidate.category === v.category);
        if (!guide) throw new Error(`no guidance for ${v.category}`);
        expect(v.bookBy >= TODAY && v.bookBy <= event).toBe(true);
        expect(v.done || v.overdue).toBe(false);
        if (guide.bookByWeeks >= 1) expect(v.bookBy < event).toBe(true);
        if (guide.bookByWeeks === 0) expect(v.bookBy).toBe(event);
        expect(v.bookBy >= addDays(event, -guide.bookByWeeks * 7)).toBe(true);
      }
      const rank = (c: string): number => BUDGET_CATEGORIES.findIndex((b) => b === c);
      for (let i = 1; i < out.length; i++) {
        const [a, b] = [out[i - 1], out[i]];
        expect(
          a.bookBy < b.bookBy || (a.bookBy === b.bookBy && rank(a.category) <= rank(b.category)),
        ).toBe(true);
      }
    }
  });

  it("is unchanged when the longest lead fits, and proportional with the longest booking today when not", () => {
    const rand = mulberry32(42);
    let compressed = 0;
    let fitted = 0;
    for (let run = 0; run < 500; run++) {
      const event = eventAfter(rand);
      const vendors = randomVendors(rand);
      const info = scheduleCompression(
        vendors.map((v) => ({ leadWeeks: v.bookByWeeks })),
        event,
        TODAY,
      );
      const out = scheduleVendors(vendors, event, TODAY);
      const by = new Map(out.map((v) => [v.category, v.bookBy]));
      const longest = vendors.reduce((a, b) => (b.bookByWeeks > a.bookByWeeks ? b : a));
      if (info.compressed) {
        compressed += 1;
        expect(by.get(longest.category)).toBe(TODAY);
      } else {
        fitted += 1;
        for (const v of vendors) {
          const plain = maxDate(addDays(event, -v.bookByWeeks * 7), TODAY);
          expect(by.get(v.category)).toBe(v.bookByWeeks === 0 ? event : plain);
        }
      }
      const byLead = [...vendors].sort((a, b) => b.bookByWeeks - a.bookByWeeks);
      for (let i = 1; i < byLead.length; i++) {
        expect((by.get(byLead[i - 1].category) ?? "") <= (by.get(byLead[i].category) ?? "")).toBe(
          true,
        );
      }
    }
    expect(compressed).toBeGreaterThan(100);
    expect(fitted).toBeGreaterThan(30);
  });
});
