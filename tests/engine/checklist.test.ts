// @vitest-environment node
import { describe, expect, it } from "vitest";
import { refreshVendorStatus, scheduleVendors, setVendorDone } from "@/lib/engine/checklist";
import { addDays } from "@/lib/engine/dates";
import { EVENT, TODAY, vendorGuide, vendorItem } from "./builders";

describe("scheduleVendors", () => {
  it("books by event minus the lead weeks, copying the guidance", () => {
    const input = [vendorGuide("venue", 16)];
    const [venue] = scheduleVendors(input, EVENT, TODAY);
    expect(venue).toEqual({
      category: "venue",
      bookBy: "2026-10-25",
      questions: ["Q1?", "Q2?"],
      redFlags: ["Flag"],
      done: false,
      overdue: false,
    });
    expect(venue.questions).not.toBe(input[0].questions);
  });

  it("never books before today", () => {
    expect(scheduleVendors([vendorGuide("catering", 40)], EVENT, TODAY)[0]).toMatchObject({
      bookBy: TODAY,
      overdue: false,
    });
  });

  it("sorts by book-by date, then budget-category order", () => {
    const guides = [
      vendorGuide("misc", 8),
      vendorGuide("catering", 12),
      vendorGuide("decor", 8),
      vendorGuide("venue", 8),
      vendorGuide("photography", 12),
    ];
    expect(scheduleVendors(guides, EVENT, TODAY).map((item) => item.category)).toEqual([
      "catering",
      "photography",
      "venue",
      "decor",
      "misc",
    ]);
    expect(scheduleVendors([], EVENT, TODAY)).toEqual([]);
  });

  it("books a lead-0 vendor on the event day and any other vendor at the latest the day before", () => {
    const out = scheduleVendors([vendorGuide("misc", 0), vendorGuide("gifts", 1)], EVENT, TODAY);
    expect(out.map((item) => [item.category, item.bookBy])).toEqual([
      ["gifts", "2027-02-07"],
      ["misc", EVENT],
    ]);
    const tomorrow = scheduleVendors(
      [vendorGuide("misc", 0), vendorGuide("gifts", 30)],
      addDays(TODAY, 1),
      TODAY,
    );
    expect(tomorrow.map((item) => [item.category, item.bookBy])).toEqual([
      ["gifts", TODAY],
      ["misc", addDays(TODAY, 1)],
    ]);
  });
});

describe("scheduleVendors when the event is closer than the ideal lead times", () => {
  // A wedding 12 days away: the longest lead (40 weeks, 280 days) compresses to the 12 days left.
  const WEDDING = [
    vendorGuide("venue", 40),
    vendorGuide("catering", 32),
    vendorGuide("photography", 32),
    vendorGuide("decor", 28),
    vendorGuide("attire", 24),
    vendorGuide("entertainment", 16),
    vendorGuide("transport", 8),
  ];
  const near = addDays(TODAY, 12);

  it("spreads book-by dates proportionally over the days left, in the same order", () => {
    const out = scheduleVendors(WEDDING, near, TODAY);
    expect(out.map((item) => [item.category, item.bookBy])).toEqual([
      ["venue", TODAY],
      ["catering", addDays(TODAY, 2)],
      ["photography", addDays(TODAY, 2)],
      ["decor", addDays(TODAY, 4)],
      ["attire", addDays(TODAY, 5)],
      ["entertainment", addDays(TODAY, 7)],
      ["transport", addDays(TODAY, 10)],
    ]);
    expect(out.every((item) => item.bookBy < near && !item.overdue && !item.done)).toBe(true);
  });

  it("leaves a plan that fits exactly as before", () => {
    const out = scheduleVendors(WEDDING, addDays(TODAY, 280), TODAY);
    expect(out.map((item) => item.bookBy)).toEqual(
      WEDDING.map((guide) => addDays(TODAY, 280 - guide.bookByWeeks * 7)).sort(),
    );
  });

  it("books everything today when the event is today or already past", () => {
    for (const day of [TODAY, addDays(TODAY, -4)]) {
      const out = scheduleVendors(WEDDING, day, TODAY);
      expect(out.every((item) => item.bookBy === TODAY && !item.overdue)).toBe(true);
    }
  });
});

describe("setVendorDone / refreshVendorStatus", () => {
  const rows = [
    vendorItem("venue", "2026-10-01", { overdue: true }),
    vendorItem("decor", "2026-12-01"),
  ];

  it("marks one row done, clearing overdue", () => {
    const out = setVendorDone(rows, "venue", true);
    expect(out[0]).toMatchObject({ done: true, overdue: false });
    expect(out[1]).toBe(rows[1]);
    expect(rows[0]).toMatchObject({ done: false, overdue: true });
  });

  it("un-doing keeps the overdue flag until refreshed", () => {
    expect(setVendorDone(rows, "venue", false)[0].overdue).toBe(true);
    expect(setVendorDone(rows, "decor", false)[1].overdue).toBe(false);
    expect(setVendorDone(rows, "gifts", true)).toEqual(rows);
  });

  it("recomputes overdue for a given today", () => {
    const done = vendorItem("catering", "2026-10-01", { done: true });
    const overdueOn = (today: string, items = rows) =>
      refreshVendorStatus(items, today).map((item) => item.overdue);
    expect(overdueOn("2026-11-01", [...rows, done])).toEqual([true, false, false]);
    expect(overdueOn("2026-09-01")).toEqual([false, false]);
  });
});
