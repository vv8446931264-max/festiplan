// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { BudgetCategory, Phase, ScheduledTask, VendorGuide, VendorItem } from "@/lib/contracts";
import {
  groupByCategory,
  groupByPhase,
  nextActions,
  progress,
  refreshVendorStatus,
  scheduleVendors,
  setVendorDone,
} from "@/lib/engine/checklist";

const EVENT = "2027-02-14";
const TODAY = "2026-10-24";

const guide = (category: BudgetCategory, bookByWeeks: number): VendorGuide => ({
  category,
  bookByWeeks,
  questions: ["Q1?", "Q2?"],
  redFlags: ["Flag"],
});
const item = (category: BudgetCategory, bookBy: string, extra: Partial<VendorItem> = {}): VendorItem => ({
  category,
  bookBy,
  questions: [],
  redFlags: [],
  done: false,
  overdue: false,
  ...extra,
});
const st = (id: string, due: string, extra: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id,
  title: id,
  category: "admin",
  start: due,
  due,
  phase: "1-3m",
  done: false,
  overdue: false,
  crunch: false,
  ...extra,
});

describe("scheduleVendors", () => {
  it("books by event minus the lead weeks, copying the guidance", () => {
    const input = [guide("venue", 16)];
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
    expect(scheduleVendors([guide("catering", 40)], EVENT, TODAY)[0]).toMatchObject({ bookBy: TODAY, overdue: false });
  });

  it("sorts by book-by date, then budget-category order", () => {
    const out = scheduleVendors(
      [guide("misc", 8), guide("catering", 20), guide("decor", 8), guide("venue", 8), guide("photography", 20)],
      EVENT,
      TODAY,
    );
    expect(out.map((v) => v.category)).toEqual(["catering", "photography", "venue", "decor", "misc"]);
    expect(scheduleVendors([], EVENT, TODAY)).toEqual([]);
  });
});

describe("setVendorDone / refreshVendorStatus", () => {
  const rows = [item("venue", "2026-10-01", { overdue: true }), item("decor", "2026-12-01")];

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
    const done = item("catering", "2026-10-01", { done: true });
    expect(refreshVendorStatus([...rows, done], "2026-11-01").map((v) => v.overdue)).toEqual([true, false, false]);
    expect(refreshVendorStatus(rows, "2026-09-01").map((v) => v.overdue)).toEqual([false, false]);
  });
});

describe("progress", () => {
  it("counts done items and rounds the percent", () => {
    expect(progress([{ done: true }, { done: false }, { done: false }])).toEqual({ done: 1, total: 3, percent: 33 });
    expect(progress([{ done: true }, { done: true }, { done: false }])).toEqual({ done: 2, total: 3, percent: 67 });
    expect(progress([{ done: true }])).toEqual({ done: 1, total: 1, percent: 100 });
  });

  it("is 0% for an empty list", () => {
    expect(progress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("nextActions", () => {
  const timeline = [
    st("c", "2026-12-01"),
    st("done-first", "2026-10-25", { done: true }),
    st("b", "2026-11-01", { start: "2026-10-30" }),
    st("a", "2026-11-01", { start: "2026-10-26" }),
    st("d", "2026-11-01", { start: "2026-10-26" }),
  ];

  it("returns the first three not-done tasks by due then start, ties in timeline order", () => {
    expect(nextActions(timeline).map((t) => t.id)).toEqual(["a", "d", "b"]);
  });

  it("honours n, including 0 and negatives, and does not mutate", () => {
    const before = timeline.map((t) => t.id);
    expect(nextActions(timeline, 1).map((t) => t.id)).toEqual(["a"]);
    expect(nextActions(timeline, 10).map((t) => t.id)).toEqual(["a", "d", "b", "c"]);
    expect(nextActions(timeline, 0)).toEqual([]);
    expect(nextActions(timeline, -2)).toEqual([]);
    expect(timeline.map((t) => t.id)).toEqual(before);
  });
});

describe("groupByCategory", () => {
  it("groups in first-seen order", () => {
    const out = groupByCategory([item("venue", "a"), item("decor", "b"), item("venue", "c")]);
    expect(out.map((g) => [g.category, g.items.map((i) => i.bookBy)])).toEqual([
      ["venue", ["a", "c"]],
      ["decor", ["b"]],
    ]);
  });

  it("works on tasks and on an empty list", () => {
    expect(groupByCategory([st("x", "d")]).map((g) => g.category)).toEqual(["admin"]);
    expect(groupByCategory([])).toEqual([]);
  });
});

describe("groupByPhase", () => {
  it("returns non-empty phases in PHASES order", () => {
    const phased = (id: string, phase: Phase) => st(id, "2026-11-01", { phase });
    const out = groupByPhase([phased("p", "day-of"), phased("q", "6m+"), phased("r", "2-4w"), phased("s", "6m+")]);
    expect(out.map((g) => [g.phase, g.tasks.map((t) => t.id)])).toEqual([
      ["6m+", ["q", "s"]],
      ["2-4w", ["r"]],
      ["day-of", ["p"]],
    ]);
    expect(groupByPhase([])).toEqual([]);
  });
});
