// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AiTask, ScheduledTask } from "@/lib/contracts";
import { scheduleCompression } from "@/lib/engine/compression";
import { addDays, diffDays } from "@/lib/engine/dates";
import { scheduleTimeline } from "@/lib/engine/timeline";
import { TODAY, aiTask as task, findTask } from "./builders";

/** The production bug: a wedding 12 days away whose tasks ideally start 4 to 26 weeks out. */
describe("scheduleTimeline when the event is closer than the ideal lead times", () => {
  const WEDDING: AiTask[] = [
    task("confirm-muhurat", 26, 7),
    task("agree-budget", 24, 7),
    task("draft-guest-list", 22, 14, ["agree-budget"]),
    task("book-venue", 20, 21, ["confirm-muhurat", "agree-budget"]),
    task("book-caterer", 18, 14, ["book-venue"]),
    task("book-photographer", 16, 10, ["confirm-muhurat"]),
    task("book-decorator", 14, 14, ["book-venue"]),
    task("order-attire", 12, 60, ["confirm-muhurat"]),
    task("send-save-dates", 10, 3, ["draft-guest-list"]),
    task("send-invitations", 6, 14, ["send-save-dates"]),
    task("final-headcount", 4, 3, ["send-invitations", "book-caterer"]),
    task("emergency-kit", 0, 1),
  ];
  const EVENT = addDays(TODAY, 12);
  const out = scheduleTimeline(WEDDING, EVENT, TODAY);
  const get = (id: string): ScheduledTask => findTask(out, id);
  const offsets = (t: ScheduledTask): [number, number] => [
    diffDays(TODAY, t.start),
    diffDays(TODAY, t.due),
  ];

  it("spreads the steps over the days left instead of piling them on the event day", () => {
    expect(Object.fromEntries(out.map((t) => [t.id, offsets(t)]))).toEqual({
      "confirm-muhurat": [0, 1],
      "agree-budget": [1, 2],
      "draft-guest-list": [2, 3],
      "book-venue": [3, 4],
      "book-caterer": [4, 5],
      "book-photographer": [5, 6],
      "book-decorator": [6, 7],
      "order-attire": [6, 10],
      "send-save-dates": [7, 8],
      "send-invitations": [9, 10],
      "final-headcount": [10, 11],
      "emergency-kit": [12, 12],
    });
    expect(new Set(out.map((t) => t.due)).size).toBeGreaterThanOrEqual(8);
  });

  it("puts only the lead-0 task on the day of the event", () => {
    expect(out.filter((t) => t.phase === "day-of").map((t) => t.id)).toEqual(["emergency-kit"]);
    expect(get("book-caterer").phase).toBe("final-week");
    expect(get("confirm-muhurat").phase).toBe("2-4w");
    expect(out.filter((t) => t.id !== "emergency-kit").every((t) => t.due < EVENT)).toBe(true);
  });

  it("flags every step that had to be compressed, and no other", () => {
    expect(out.filter((t) => !t.crunch).map((t) => t.id)).toEqual(["emergency-kit"]);
    expect(out.every((t) => !t.overdue && !t.done)).toBe(true);
  });

  it("keeps the order of ideal starts and respects every dependency", () => {
    const byLead = [...WEDDING].sort((a, b) => b.leadWeeks - a.leadWeeks);
    for (let i = 1; i < byLead.length; i++) {
      expect(get(byLead[i - 1].id).start <= get(byLead[i].id).start).toBe(true);
    }
    for (const t of WEDDING) {
      for (const dep of t.dependsOn) expect(get(dep).due <= get(t.id).start).toBe(true);
    }
    expect(out.map((t) => t.id)).toEqual([
      "confirm-muhurat",
      "agree-budget",
      "draft-guest-list",
      "book-venue",
      "book-caterer",
      "book-photographer",
      "book-decorator",
      "send-save-dates",
      "order-attire",
      "send-invitations",
      "final-headcount",
      "emergency-kit",
    ]);
  });

  it("schedules the same plan unchanged once there is time for it", () => {
    const roomy = scheduleTimeline(WEDDING, addDays(TODAY, 200), TODAY);
    expect(scheduleCompression(WEDDING, addDays(TODAY, 200), TODAY).compressed).toBe(false);
    expect(roomy.every((t) => !t.crunch)).toBe(true);
    expect(roomy.find((t) => t.id === "confirm-muhurat")).toMatchObject({
      start: addDays(TODAY, 200 - 182),
      due: addDays(TODAY, 200 - 182 + 7),
    });
  });

  it("degrades gracefully with one day left, an event today, and an event in the past", () => {
    const tomorrow = scheduleTimeline(WEDDING, addDays(TODAY, 1), TODAY);
    expect(
      tomorrow
        .filter((t) => t.id !== "emergency-kit")
        .every((t) => t.start === TODAY && t.due === TODAY),
    ).toBe(true);
    const sameDay = scheduleTimeline(WEDDING, TODAY, TODAY);
    expect(sameDay.every((t) => t.start === TODAY && t.due === TODAY && t.phase === "day-of")).toBe(
      true,
    );
    const past = scheduleTimeline(WEDDING, addDays(TODAY, -3), TODAY);
    expect(past.every((t) => t.start === TODAY && t.due === TODAY)).toBe(true);
  });
});
