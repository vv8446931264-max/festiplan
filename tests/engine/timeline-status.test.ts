// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ScheduledTask } from "@/lib/contracts";
import { compareByDue, isOverdue, refreshStatus, setTaskDone } from "@/lib/engine/timeline";

const TODAY = "2026-10-24";

describe("isOverdue / compareByDue", () => {
  it("is overdue only when not done and due before today", () => {
    expect(isOverdue(false, "2026-10-23", TODAY)).toBe(true);
    expect(isOverdue(false, TODAY, TODAY)).toBe(false);
    expect(isOverdue(true, "2026-10-23", TODAY)).toBe(false);
    expect(isOverdue(true, "2026-10-25", TODAY)).toBe(false);
  });

  it("orders by due then start", () => {
    const t = (due: string, start: string) => ({ due, start });
    expect(compareByDue(t("2026-11-01", "x"), t("2026-11-02", "a"))).toBeLessThan(0);
    expect(compareByDue(t("2026-11-02", "a"), t("2026-11-01", "x"))).toBeGreaterThan(0);
    expect(compareByDue(t("2026-11-01", "2026-10-30"), t("2026-11-01", "2026-10-31"))).toBeLessThan(0);
    expect(compareByDue(t("2026-11-01", "2026-10-31"), t("2026-11-01", "2026-10-30"))).toBeGreaterThan(0);
    expect(compareByDue(t("2026-11-01", "2026-10-30"), t("2026-11-01", "2026-10-30"))).toBe(0);
  });
});

describe("refreshStatus / setTaskDone", () => {
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
  const timeline = [st("late", "2026-11-01"), st("soon", "2026-12-01"), st("finished", "2026-11-01", { done: true })];

  it("recomputes overdue for a new today and changes nothing else", () => {
    const later = refreshStatus(timeline, "2026-11-15");
    expect(later.map((t) => t.overdue)).toEqual([true, false, false]);
    expect(refreshStatus(later, "2026-10-01").map((t) => t.overdue)).toEqual([false, false, false]);
    expect(later.map((t) => ({ ...t, overdue: false }))).toEqual(timeline.map((t) => ({ ...t, overdue: false })));
  });

  it("marks one task done, clearing its overdue flag", () => {
    const overdue = refreshStatus(timeline, "2026-11-15");
    const out = setTaskDone(overdue, "late", true);
    expect(out[0]).toMatchObject({ done: true, overdue: false });
    expect(out.slice(1)).toEqual(overdue.slice(1));
    expect(overdue[0]).toMatchObject({ done: false, overdue: true });
  });

  it("un-doing keeps overdue as it was until refreshStatus runs", () => {
    const stale = [st("a", "2026-11-01", { done: true, overdue: false }), st("b", "2026-11-01", { overdue: true })];
    expect(setTaskDone(stale, "a", false)[0]).toMatchObject({ done: false, overdue: false });
    expect(setTaskDone(stale, "b", false)[1]).toMatchObject({ done: false, overdue: true });
    expect(refreshStatus(setTaskDone(stale, "a", false), "2026-11-15")[0].overdue).toBe(true);
  });

  it("ignores an unknown id", () => {
    expect(setTaskDone(timeline, "nope", true)).toEqual(timeline);
  });
});
