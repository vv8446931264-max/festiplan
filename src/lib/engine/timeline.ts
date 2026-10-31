import type { AiTask, Phase, ScheduledTask } from "@/lib/contracts";
import { compressedLeadDays, scheduleCompression } from "./compression";
import { addDays, diffDays, maxDate, minDate } from "./dates";

const PHASE_LIMITS: readonly (readonly [number, Phase])[] = [
  [0, "day-of"],
  [7, "final-week"],
  [28, "2-4w"],
  [91, "1-3m"],
  [182, "3-6m"],
];

const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Whether something due on `due` is late: not done and due before `today`.
 * @param done Completion state.
 * @param due ISO due date.
 * @param today ISO "today" (injected; the engine never reads the clock).
 */
export function isOverdue(done: boolean, due: string, today: string): boolean {
  return !done && due < today;
}

/**
 * Comparator for the order tasks are worked in: due date, then start date.
 * @param a First task (or any object with `due` and `start`).
 * @param b Second task.
 */
export function compareByDue(
  a: { due: string; start: string },
  b: { due: string; start: string },
): number {
  return cmp(a.due, b.due) || cmp(a.start, b.start);
}

/**
 * Phase bucket by days left before the event: 0 day-of, ≤7 final-week, ≤28 2-4w,
 * ≤91 1-3m, ≤182 3-6m, otherwise 6m+. Dates on or after the event are "day-of".
 * @param due ISO due date.
 * @param eventDate ISO event date.
 */
export function phaseFor(due: string, eventDate: string): Phase {
  const days = diffDays(due, eventDate);
  const hit = PHASE_LIMITS.find(([max]) => days <= max);
  return hit ? hit[1] : "6m+";
}

const firstIndexById = (tasks: AiTask[]): Map<string, number> => {
  const index = new Map<string, number>();
  tasks.forEach((t, i) => {
    if (!index.has(t.id)) index.set(t.id, i);
  });
  return index;
};

/** Kahn's algorithm over indices; ready tasks are taken lowest original index first. */
function topoOrder(tasks: AiTask[]): number[] | null {
  const index = firstIndexById(tasks);
  const indegree = tasks.map(() => 0);
  const dependents: number[][] = tasks.map(() => []);
  tasks.forEach((task, j) => {
    for (const dep of new Set(task.dependsOn)) {
      const i = index.get(dep);
      if (i === undefined) continue;
      dependents[i].push(j);
      indegree[j] += 1;
    }
  });
  const ready = indegree.flatMap((d, i) => (d === 0 ? [i] : []));
  const order: number[] = [];
  for (let i = ready.shift(); i !== undefined; i = ready.shift()) {
    order.push(i);
    for (const j of dependents[i]) {
      indegree[j] -= 1;
      if (indegree[j] === 0) ready.push(j);
    }
    ready.sort((a, b) => a - b);
  }
  return order.length === tasks.length ? order : null;
}

/**
 * Stable topological sort (Kahn). Dependencies on unknown ids are ignored; a
 * self-dependency or any cycle makes the whole result `null`.
 * @param tasks Tasks with `dependsOn` ids.
 * @returns Tasks with prerequisites first, or `null` on a cycle.
 */
export function topoSort(tasks: AiTask[]): AiTask[] | null {
  const order = topoOrder(tasks);
  return order === null ? null : order.map((i) => tasks[i]);
}

type Slot = { index: number; task: ScheduledTask };
type Frame = { eventDate: string; today: string; factor: number };

function placeTask(task: AiTask, deps: number[], dues: string[], frame: Frame): ScheduledTask {
  const { eventDate, today, factor } = frame;
  const idealStart = addDays(eventDate, -compressedLeadDays(task.leadWeeks, factor));
  const start = deps.reduce((s, d) => maxDate(s, dues[d]), maxDate(idealStart, today));
  const duration = Math.max(1, Math.round(task.durationDays * factor));
  const latest = task.leadWeeks > 0 ? addDays(eventDate, -1) : eventDate;
  const due = maxDate(start, minDate(addDays(start, duration), latest));
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    start,
    due,
    phase: phaseFor(due, eventDate),
    done: false,
    overdue: isOverdue(false, due, today),
    crunch: addDays(eventDate, -task.leadWeeks * 7) < today,
  };
}

/**
 * Schedules tasks backwards from the event. When the longest ideal lead time does not fit in the
 * days left, lead times and durations shrink by the same factor (`scheduleCompression`), so the
 * steps spread over the time available and keep their relative order.
 * `start = max(event − compressed lead, today, latest prerequisite due)`;
 * `due = start + duration`, capped at the day before the event for tasks with `leadWeeks ≥ 1`
 * (only `leadWeeks = 0` tasks may fall on the event day) but never before `start`.
 * `crunch` marks a task whose uncompressed ideal start had already passed. A prerequisite due on
 * the event day pushes its dependents there too. If the dependencies contain a cycle they are all
 * ignored. Sorted by due, start, then input order.
 * @param tasks AI task list.
 * @param eventDate ISO event date.
 * @param today ISO "today" (injected).
 */
export function scheduleTimeline(
  tasks: AiTask[],
  eventDate: string,
  today: string,
): ScheduledTask[] {
  const order = topoOrder(tasks);
  const index = firstIndexById(tasks);
  const frame: Frame = {
    eventDate,
    today,
    factor: scheduleCompression(tasks, eventDate, today).factor,
  };
  const dues: string[] = [];
  const slots: Slot[] = [];
  for (const i of order ?? tasks.map((_, k) => k)) {
    const deps = order === null ? [] : tasks[i].dependsOn.flatMap((id) => index.get(id) ?? []);
    const task = placeTask(tasks[i], deps, dues, frame);
    dues[i] = task.due;
    slots.push({ index: i, task });
  }
  slots.sort((a, b) => compareByDue(a.task, b.task) || a.index - b.index);
  return slots.map((s) => s.task);
}

/**
 * Recomputes `overdue` against a new "today". Nothing else changes.
 * @param timeline Scheduled tasks.
 * @param today ISO "today" (injected).
 */
export function refreshStatus(timeline: ScheduledTask[], today: string): ScheduledTask[] {
  return timeline.map((t) => ({ ...t, overdue: isOverdue(t.done, t.due, today) }));
}

/**
 * Marks one task done or not done. Done tasks are never overdue; un-doing leaves `overdue`
 * as it was, so call `refreshStatus` afterwards to recompute it.
 * @param timeline Scheduled tasks.
 * @param id Task id.
 * @param done New completion state.
 */
export function setTaskDone(timeline: ScheduledTask[], id: string, done: boolean): ScheduledTask[] {
  return timeline.map((t) => (t.id === id ? { ...t, done, overdue: !done && t.overdue } : t));
}
