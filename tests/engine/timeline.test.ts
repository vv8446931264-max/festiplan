// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scheduleTimeline } from "@/lib/engine/timeline";
import { EVENT, TODAY, aiTask as task, findTask } from "./builders";

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

  it("compresses a lead time that does not fit: starts today, shorter duration, crunch", () => {
    // 210 ideal days but 113 available: factor 113/210, so 5 days of work become 3.
    const [photo] = scheduleTimeline([task("photo", 30, 5)], EVENT, TODAY);
    expect(photo).toMatchObject({ start: TODAY, due: "2026-10-27", crunch: true, overdue: false });
  });

  it("scales every lead time and duration by the same factor", () => {
    // Longest lead 224 days vs 113 available: factor ~0.5. Crunch means the uncompressed ideal start
    // had passed, so "mid" (112 ideal days) is shortened but not flagged.
    const out = scheduleTimeline(
      [task("long", 32, 20), task("mid", 16, 10), task("short", 8, 4)],
      EVENT,
      TODAY,
    );
    expect(findTask(out, "long")).toMatchObject({ start: TODAY, due: "2026-11-03", crunch: true });
    expect(findTask(out, "mid")).toMatchObject({
      start: "2026-12-19",
      due: "2026-12-24",
      crunch: false,
    });
    expect(findTask(out, "short")).toMatchObject({
      start: "2027-01-17",
      due: "2027-01-19",
      crunch: false,
    });
  });

  it("starts a task after its prerequisites are due, wherever they sit in the list", () => {
    const out = scheduleTimeline([task("b", 12, 3, ["a"]), task("a", 13, 14)], EVENT, TODAY);
    expect(findTask(out, "a")).toMatchObject({ start: "2026-11-15", due: "2026-11-29" });
    expect(findTask(out, "b")).toMatchObject({
      start: "2026-11-29",
      due: "2026-12-02",
      crunch: false,
    });
  });

  it("finishes a task with lead time before the event day; only lead-0 tasks may be due on it", () => {
    expect(scheduleTimeline([task("late", 1, 30)], EVENT, TODAY)[0]).toMatchObject({
      start: "2027-02-07",
      due: "2027-02-13",
      phase: "final-week",
    });
    expect(scheduleTimeline([task("same-day", 0, 1)], EVENT, TODAY)[0]).toMatchObject({
      start: EVENT,
      due: EVENT,
      phase: "day-of",
    });
    expect(scheduleTimeline([task("kit", 0, 40)], EVENT, TODAY)[0]).toMatchObject({
      start: EVENT,
      due: EVENT,
    });
  });

  it("never schedules before today or before the start, even after the event", () => {
    expect(scheduleTimeline([task("after", 5, 3)], EVENT, "2027-03-01")[0]).toMatchObject({
      start: "2027-03-01",
      due: "2027-03-01",
      crunch: true,
      phase: "day-of",
    });
    expect(scheduleTimeline([task("today", 5, 3)], EVENT, EVENT)[0]).toMatchObject({
      start: EVENT,
      due: EVENT,
    });
  });

  it("lets a prerequisite due on the event day pull its dependents there", () => {
    const out = scheduleTimeline(
      [task("kit", 0, 1), task("after-kit", 2, 1, ["kit"])],
      EVENT,
      TODAY,
    );
    expect(findTask(out, "after-kit")).toMatchObject({ start: EVENT, due: EVENT });
  });

  it("ignores every dependency when there is a cycle", () => {
    const out = scheduleTimeline([task("a", 10, 5, ["b"]), task("b", 5, 5, ["a"])], EVENT, TODAY);
    expect(findTask(out, "a")).toMatchObject({ start: "2026-12-06", due: "2026-12-11" });
    expect(findTask(out, "b")).toMatchObject({ start: "2027-01-10", due: "2027-01-15" });
  });

  it("ignores dependencies on unknown ids", () => {
    const [a] = scheduleTimeline([task("a", 10, 5, ["ghost"])], EVENT, TODAY);
    expect(a).toMatchObject({ start: "2026-12-06", due: "2026-12-11" });
  });

  it("sorts by due, then start, then input order", () => {
    const tasks = [
      task("y", 0, 1),
      task("x", 2, 30),
      task("w", 1, 30),
      task("z", 0, 1),
      task("early", 8, 2),
    ];
    // x and w are both capped at the day before the event; x starts a week earlier. y and z tie fully.
    expect(scheduleTimeline(tasks, EVENT, TODAY).map((t) => t.id)).toEqual([
      "early",
      "x",
      "w",
      "y",
      "z",
    ]);
  });

  it("returns [] for no tasks and does not mutate its input", () => {
    expect(scheduleTimeline([], EVENT, TODAY)).toEqual([]);
    const tasks = [task("a", 3, 2, ["b"]), task("b", 2, 2)];
    const copy = structuredClone(tasks);
    scheduleTimeline(tasks, EVENT, TODAY);
    expect(tasks).toEqual(copy);
  });
});
