// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Phase } from "@/lib/contracts";
import { groupByPhase, nextActions, progress } from "@/lib/engine/checklist";
import { scheduledTask } from "./builders";

describe("progress", () => {
  it("counts done items and rounds the percent", () => {
    expect(progress([{ done: true }, { done: false }, { done: false }])).toEqual({
      done: 1,
      total: 3,
      percent: 33,
    });
    expect(progress([{ done: true }, { done: true }, { done: false }])).toEqual({
      done: 2,
      total: 3,
      percent: 67,
    });
    expect(progress([{ done: true }])).toEqual({ done: 1, total: 1, percent: 100 });
  });

  it("is 0% for an empty list", () => {
    expect(progress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("nextActions", () => {
  const timeline = [
    scheduledTask("c", "2026-12-01"),
    scheduledTask("done-first", "2026-10-25", { done: true }),
    scheduledTask("b", "2026-11-01", { start: "2026-10-30" }),
    scheduledTask("a", "2026-11-01", { start: "2026-10-26" }),
    scheduledTask("d", "2026-11-01", { start: "2026-10-26" }),
  ];
  const idsOf = (limit?: number) => nextActions(timeline, limit).map((task) => task.id);

  it("returns the first three not-done tasks by due then start, ties in timeline order", () => {
    expect(idsOf()).toEqual(["a", "d", "b"]);
  });

  it("honours the limit, including 0 and negatives, and does not mutate", () => {
    const before = timeline.map((task) => task.id);
    expect(idsOf(1)).toEqual(["a"]);
    expect(idsOf(10)).toEqual(["a", "d", "b", "c"]);
    expect(idsOf(0)).toEqual([]);
    expect(idsOf(-2)).toEqual([]);
    expect(timeline.map((task) => task.id)).toEqual(before);
  });
});

describe("groupByPhase", () => {
  it("returns non-empty phases in PHASES order", () => {
    const phased = (id: string, phase: Phase) => scheduledTask(id, "2026-11-01", { phase });
    const out = groupByPhase([
      phased("p", "day-of"),
      phased("q", "6m+"),
      phased("r", "2-4w"),
      phased("s", "6m+"),
    ]);
    expect(out.map((group) => [group.phase, group.tasks.map((task) => task.id)])).toEqual([
      ["6m+", ["q", "s"]],
      ["2-4w", ["r"]],
      ["day-of", ["p"]],
    ]);
    expect(groupByPhase([])).toEqual([]);
  });
});
