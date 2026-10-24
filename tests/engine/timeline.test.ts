// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AiTask, ScheduledTask } from "@/lib/contracts";
import { addDays } from "@/lib/engine/dates";
import { phaseFor, scheduleTimeline, topoSort } from "@/lib/engine/timeline";

const EVENT = "2027-02-14";
const TODAY = "2026-10-24";

const task = (id: string, leadWeeks: number, durationDays = 1, dependsOn: string[] = []): AiTask => ({
  id,
  title: `Task ${id}`,
  category: "admin",
  leadWeeks,
  durationDays,
  dependsOn,
});
const ids = (tasks: { id: string }[] | null): string[] | null => (tasks === null ? null : tasks.map((t) => t.id));
const byId = (timeline: ScheduledTask[], id: string): ScheduledTask => {
  const found = timeline.find((t) => t.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

describe("topoSort", () => {
  it("returns [] for no tasks and keeps independent tasks in order", () => {
    expect(topoSort([])).toEqual([]);
    expect(ids(topoSort([task("a", 1), task("b", 1), task("c", 1)]))).toEqual(["a", "b", "c"]);
  });

  it("puts prerequisites first even when they appear later", () => {
    const tasks = [task("c", 1, 1, ["b"]), task("b", 1, 1, ["a"]), task("a", 1)];
    expect(ids(topoSort(tasks))).toEqual(["a", "b", "c"]);
  });

  it("is stable: the lowest original index goes first among ready tasks", () => {
    const tasks = [task("a", 1, 1, ["d"]), task("b", 1), task("c", 1), task("d", 1)];
    expect(ids(topoSort(tasks))).toEqual(["b", "c", "d", "a"]);
    const diamond = [task("d", 1, 1, ["b", "c"]), task("c", 1, 1, ["a"]), task("b", 1, 1, ["a"]), task("a", 1)];
    expect(ids(topoSort(diamond))).toEqual(["a", "c", "b", "d"]);
  });

  it("ignores unknown ids and repeated dependencies", () => {
    expect(ids(topoSort([task("a", 1, 1, ["ghost"]), task("b", 1, 1, ["a", "a", "ghost"])]))).toEqual(["a", "b"]);
  });

  it("treats a duplicate id as the first one", () => {
    expect(ids(topoSort([task("a", 1), task("a", 1, 1, ["a"])]))).toEqual(["a", "a"]);
  });

  it("returns null for self-dependencies and cycles", () => {
    expect(topoSort([task("a", 1, 1, ["a"])])).toBeNull();
    expect(topoSort([task("a", 1, 1, ["b"]), task("b", 1, 1, ["a"])])).toBeNull();
    expect(topoSort([task("ok", 1), task("a", 1, 1, ["c"]), task("b", 1, 1, ["a"]), task("c", 1, 1, ["b"])])).toBeNull();
  });
});

describe("phaseFor", () => {
  const phase = (daysBefore: number) => phaseFor(addDays(EVENT, -daysBefore), EVENT);

  it("buckets by days before the event, inclusive at the upper edge", () => {
    expect([-3, -1, 0].map(phase)).toEqual(["day-of", "day-of", "day-of"]);
    expect([1, 7].map(phase)).toEqual(["final-week", "final-week"]);
    expect([8, 28].map(phase)).toEqual(["2-4w", "2-4w"]);
    expect([29, 91].map(phase)).toEqual(["1-3m", "1-3m"]);
    expect([92, 182].map(phase)).toEqual(["3-6m", "3-6m"]);
    expect([183, 1000].map(phase)).toEqual(["6m+", "6m+"]);
  });
});

describe("scheduleTimeline", () => {
  it("schedules backwards from the event with phase, no flags set", () => {
    const [venue] = scheduleTimeline([task("venue", 16, 14)], EVENT, TODAY);
    expect(venue).toEqual({
      id: "venue",
      title: "Task venue",
      category: "admin",
      start: "2026-10-25",
      due: "2026-11-08",
      phase: "3-6m",
      done: false,
      overdue: false,
      crunch: false,
    });
  });

  it("clamps a start that already passed to today and flags a crunch", () => {
    const [photo] = scheduleTimeline([task("photo", 30, 5)], EVENT, TODAY);
    expect(photo).toMatchObject({ start: TODAY, due: "2026-10-29", crunch: true, overdue: false });
  });

  it("starts a task after its prerequisites are due, wherever they sit in the list", () => {
    const out = scheduleTimeline([task("b", 12, 3, ["a"]), task("a", 13, 14)], EVENT, TODAY);
    expect(byId(out, "a")).toMatchObject({ start: "2026-11-15", due: "2026-11-29" });
    expect(byId(out, "b")).toMatchObject({ start: "2026-11-29", due: "2026-12-02", crunch: false });
  });

  it("never schedules past the event, and never before the start", () => {
    expect(scheduleTimeline([task("late", 1, 30)], EVENT, TODAY)[0]).toMatchObject({
      start: "2027-02-07",
      due: EVENT,
      phase: "day-of",
    });
    expect(scheduleTimeline([task("same-day", 0, 1)], EVENT, TODAY)[0]).toMatchObject({ start: EVENT, due: EVENT });
    expect(scheduleTimeline([task("after", 5, 3)], EVENT, "2027-03-01")[0]).toMatchObject({
      start: "2027-03-01",
      due: "2027-03-01",
      crunch: true,
      phase: "day-of",
    });
  });

  it("ignores every dependency when there is a cycle", () => {
    const out = scheduleTimeline([task("a", 10, 5, ["b"]), task("b", 5, 5, ["a"])], EVENT, TODAY);
    expect(byId(out, "a")).toMatchObject({ start: "2026-12-06", due: "2026-12-11" });
    expect(byId(out, "b")).toMatchObject({ start: "2027-01-10", due: "2027-01-15" });
  });

  it("ignores dependencies on unknown ids", () => {
    const [a] = scheduleTimeline([task("a", 10, 5, ["ghost"])], EVENT, TODAY);
    expect(a).toMatchObject({ start: "2026-12-06", due: "2026-12-11" });
  });

  it("sorts by due, then start, then input order", () => {
    const tasks = [task("y", 0, 1), task("x", 1, 30), task("z", 0, 1), task("early", 8, 2)];
    expect(scheduleTimeline(tasks, EVENT, TODAY).map((t) => t.id)).toEqual(["early", "x", "y", "z"]);
  });

  it("returns [] for no tasks and does not mutate its input", () => {
    expect(scheduleTimeline([], EVENT, TODAY)).toEqual([]);
    const tasks = [task("a", 3, 2, ["b"]), task("b", 2, 2)];
    const copy = structuredClone(tasks);
    scheduleTimeline(tasks, EVENT, TODAY);
    expect(tasks).toEqual(copy);
  });
});
