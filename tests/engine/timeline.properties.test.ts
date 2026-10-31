// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AiTask, ScheduledTask } from "@/lib/contracts";
import { compressedLeadDays, scheduleCompression } from "@/lib/engine/compression";
import { addDays, diffDays, maxDate, minDate } from "@/lib/engine/dates";
import { compareByDue, phaseFor, scheduleTimeline, topoSort } from "@/lib/engine/timeline";
import { int, mulberry32 } from "./prng";

const TODAY = "2026-10-24";

/** Mix of near events (heavy compression) and far ones (none), always at least a day away. */
const eventAfter = (rand: () => number): string =>
  addDays(TODAY, rand() < 0.6 ? int(rand, 1, 90) : int(rand, 1, 1_095));

/** Random tasks; with `acyclic`, dependencies only point at lower-numbered tasks. */
function randomTasks(rand: () => number, acyclic: boolean, withDeps = true): AiTask[] {
  const n = int(rand, 12, 30);
  const tasks: AiTask[] = Array.from({ length: n }, (_, i) => {
    const pool = acyclic ? i : n;
    const count = withDeps ? int(rand, 0, 3) : 0;
    const deps = Array.from({ length: count }, () => `t${int(rand, 0, Math.max(0, pool - 1))}`);
    return {
      id: `t${i}`,
      title: `Task ${i}`,
      category: "admin",
      leadWeeks: rand() < 0.1 ? 0 : int(rand, 1, 156),
      durationDays: int(rand, 1, 90),
      dependsOn: acyclic && i === 0 ? [] : deps,
    };
  });
  return acyclic ? tasks.sort(() => rand() - 0.5) : tasks;
}

const get = (out: ScheduledTask[], id: string): ScheduledTask => {
  const found = out.find((t) => t.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

/** Ids of tasks that (transitively) wait on a `leadWeeks = 0` task, which is due on the event day. */
function dependsOnDayOf(tasks: AiTask[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, boolean>();
  const tainted = (id: string): boolean => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const t = byId.get(id);
    const hit =
      t !== undefined && t.dependsOn.some((d) => byId.get(d)?.leadWeeks === 0 || tainted(d));
    memo.set(id, hit);
    return hit;
  };
  return new Set(tasks.filter((t) => tainted(t.id)).map((t) => t.id));
}

/** The uncompressed rule: used as an oracle whenever the ideal span fits before the event. */
function oracle(t: AiTask, event: string, depDues: string[]): { start: string; due: string } {
  const start = depDues.reduce(maxDate, maxDate(addDays(event, -t.leadWeeks * 7), TODAY));
  const latest = t.leadWeeks > 0 ? addDays(event, -1) : event;
  return { start, due: maxDate(start, minDate(addDays(start, t.durationDays), latest)) };
}

describe("scheduleTimeline (property)", () => {
  it("keeps every task inside [today, event], honours prerequisites and finishes work before the event", () => {
    const rand = mulberry32(11);
    for (let run = 0; run < 500; run++) {
      const event = eventAfter(rand);
      const tasks = randomTasks(rand, true);
      const out = scheduleTimeline(tasks, event, TODAY);
      const { availableDays } = scheduleCompression(tasks, event, TODAY);
      const lateByDep = dependsOnDayOf(tasks);
      expect(out).toHaveLength(tasks.length);
      for (const t of tasks) {
        const s = get(out, t.id);
        expect(s.start >= TODAY && s.start <= s.due && s.due <= event).toBe(true);
        expect(s.crunch).toBe(addDays(event, -t.leadWeeks * 7) < TODAY);
        expect(s.phase).toBe(phaseFor(s.due, event));
        expect(s.overdue).toBe(false);
        expect(s.start >= addDays(event, -t.leadWeeks * 7)).toBe(true);
        for (const dep of t.dependsOn) expect(get(out, dep).due <= s.start).toBe(true);
        if (t.leadWeeks >= 1 && availableDays >= 2 && !lateByDep.has(t.id))
          expect(s.due < event).toBe(true);
        if (t.leadWeeks === 0) expect(s.due).toBe(event);
      }
      for (let i = 1; i < out.length; i++)
        expect(compareByDue(out[i - 1], out[i])).toBeLessThanOrEqual(0);
    }
  });

  it("compresses nothing when the ideal span fits: same schedule as the plain backwards rule", () => {
    const rand = mulberry32(21);
    let fitted = 0;
    for (let run = 0; run < 500; run++) {
      const event = addDays(TODAY, int(rand, 150, 1_300));
      const tasks = randomTasks(rand, true).filter(
        (t) => t.leadWeeks * 7 <= diffDays(TODAY, event),
      );
      const info = scheduleCompression(tasks, event, TODAY);
      if (tasks.length === 0) continue;
      fitted += 1;
      expect(info).toMatchObject({ compressed: false, factor: 1 });
      const out = scheduleTimeline(tasks, event, TODAY);
      const known = new Set(tasks.map((t) => t.id));
      for (const t of tasks) {
        const deps = t.dependsOn.filter((d) => known.has(d)).map((d) => get(out, d).due);
        expect(get(out, t.id)).toMatchObject({ ...oracle(t, event, deps), crunch: false });
      }
    }
    expect(fitted).toBeGreaterThan(400);
  });

  it("keeps the order of ideal starts when compressing: more lead time never starts later", () => {
    const rand = mulberry32(31);
    let compressed = 0;
    for (let run = 0; run < 400; run++) {
      const event = eventAfter(rand);
      const tasks = randomTasks(rand, true, false);
      const info = scheduleCompression(tasks, event, TODAY);
      const out = scheduleTimeline(tasks, event, TODAY);
      compressed += info.compressed ? 1 : 0;
      const byLead = [...tasks].sort((a, b) => b.leadWeeks - a.leadWeeks);
      for (let i = 1; i < byLead.length; i++) {
        expect(get(out, byLead[i - 1].id).start <= get(out, byLead[i].id).start).toBe(true);
      }
      for (const t of tasks) {
        const ideal = addDays(event, -compressedLeadDays(t.leadWeeks, info.factor));
        expect(get(out, t.id).start).toBe(maxDate(ideal, TODAY));
      }
      if (info.compressed) expect(get(out, byLead[0].id).start).toBe(TODAY);
    }
    expect(compressed).toBeGreaterThan(150);
  });

  it("copes with arbitrary (possibly cyclic) dependencies", () => {
    const rand = mulberry32(12);
    let cycles = 0;
    for (let run = 0; run < 300; run++) {
      const event = eventAfter(rand);
      const tasks = randomTasks(rand, false);
      const out = scheduleTimeline(tasks, event, TODAY);
      expect(out).toHaveLength(tasks.length);
      expect(new Set(out.map((t) => t.id)).size).toBe(tasks.length);
      expect(out.every((t) => t.start >= TODAY && t.due >= t.start && t.due <= event)).toBe(true);
      if (topoSort(tasks) !== null) continue;
      cycles += 1;
      const { factor } = scheduleCompression(tasks, event, TODAY);
      for (const t of tasks) {
        const ideal = addDays(event, -compressedLeadDays(t.leadWeeks, factor));
        expect(get(out, t.id).start).toBe(maxDate(ideal, TODAY));
      }
    }
    expect(cycles).toBeGreaterThan(20);
  });
});
