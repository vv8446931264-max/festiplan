// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AiTask } from "@/lib/contracts";
import { addDays } from "@/lib/engine/dates";
import { compareByDue, phaseFor, scheduleTimeline, topoSort } from "@/lib/engine/timeline";

/** Tiny seeded PRNG so failures are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = "2026-10-24";
const int = (rand: () => number, lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

/** Random tasks; with `acyclic`, dependencies only point at lower-numbered tasks. */
function randomTasks(rand: () => number, acyclic: boolean): AiTask[] {
  const n = int(rand, 12, 30);
  const tasks: AiTask[] = Array.from({ length: n }, (_, i) => {
    const pool = acyclic ? i : n;
    const deps = Array.from({ length: int(rand, 0, 3) }, () => `t${int(rand, 0, Math.max(0, pool - 1))}`);
    return {
      id: `t${i}`,
      title: `Task ${i}`,
      category: "admin",
      leadWeeks: int(rand, 0, 156),
      durationDays: int(rand, 1, 90),
      dependsOn: acyclic && i === 0 ? [] : deps,
    };
  });
  return acyclic ? tasks.sort(() => rand() - 0.5) : tasks;
}

describe("scheduleTimeline (property)", () => {
  it("respects today, the event, prerequisites, phases and ordering", () => {
    const rand = mulberry32(11);
    for (let run = 0; run < 300; run++) {
      const event = addDays(TODAY, int(rand, 1, 1_095));
      const tasks = randomTasks(rand, true);
      const out = scheduleTimeline(tasks, event, TODAY);
      const dueOf = new Map(out.map((t) => [t.id, t.due]));
      expect(out).toHaveLength(tasks.length);
      for (const t of tasks) {
        const s = out.find((x) => x.id === t.id);
        expect(s).toBeDefined();
        if (!s) continue;
        const ideal = addDays(event, -t.leadWeeks * 7);
        expect(s.start >= TODAY && s.start >= ideal).toBe(true);
        expect(s.due >= s.start && s.due <= (event > s.start ? event : s.start)).toBe(true);
        expect(s.crunch).toBe(ideal < TODAY);
        expect(s.phase).toBe(phaseFor(s.due, event));
        for (const dep of t.dependsOn) expect(s.start >= (dueOf.get(dep) ?? "")).toBe(true);
      }
      for (let i = 1; i < out.length; i++) expect(compareByDue(out[i - 1], out[i])).toBeLessThanOrEqual(0);
    }
  });

  it("copes with arbitrary (possibly cyclic) dependencies", () => {
    const rand = mulberry32(12);
    let cycles = 0;
    for (let run = 0; run < 300; run++) {
      const event = addDays(TODAY, int(rand, 1, 1_095));
      const tasks = randomTasks(rand, false);
      const out = scheduleTimeline(tasks, event, TODAY);
      expect(out).toHaveLength(tasks.length);
      expect(new Set(out.map((t) => t.id)).size).toBe(tasks.length);
      expect(out.every((t) => t.start >= TODAY && t.due >= t.start)).toBe(true);
      if (topoSort(tasks) === null) {
        cycles += 1;
        for (const t of tasks) {
          const ideal = addDays(event, -t.leadWeeks * 7);
          expect(out.find((x) => x.id === t.id)?.start).toBe(ideal > TODAY ? ideal : TODAY);
        }
      }
    }
    expect(cycles).toBeGreaterThan(20);
  });
});
