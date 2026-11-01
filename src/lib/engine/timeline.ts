import type { AiTask, Phase, ScheduledTask } from "@/lib/contracts";
import { DAYS_PER_WEEK } from "@/lib/time";
import { compressedLeadDays, scheduleCompression } from "./compression";
import { addDays, diffDays, maxDate, minDate } from "./dates";
import { compareAscending } from "./shared";

/** Phase for a due date, by the most days left before the event that still belong to it. */
const PHASE_BY_MAX_DAYS_LEFT: readonly (readonly [number, Phase])[] = [
  [0, "day-of"],
  [7, "final-week"],
  [28, "2-4w"],
  [91, "1-3m"],
  [182, "3-6m"],
];

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
  return compareAscending(a.due, b.due) || compareAscending(a.start, b.start);
}

/**
 * Phase bucket by days left before the event: 0 day-of, ≤7 final-week, ≤28 2-4w,
 * ≤91 1-3m, ≤182 3-6m, otherwise 6m+. Dates on or after the event are "day-of".
 * @param due ISO due date.
 * @param eventDate ISO event date.
 */
export function phaseFor(due: string, eventDate: string): Phase {
  const daysLeft = diffDays(due, eventDate);
  const bucket = PHASE_BY_MAX_DAYS_LEFT.find(([maxDaysLeft]) => daysLeft <= maxDaysLeft);
  return bucket ? bucket[1] : "6m+";
}

/** Index of each id's first occurrence (a repeated id refers to the first task with it). */
function firstIndexById(tasks: AiTask[]): Map<string, number> {
  const indexById = new Map<string, number>();
  tasks.forEach((task, index) => {
    if (!indexById.has(task.id)) indexById.set(task.id, index);
  });
  return indexById;
}

/** Kahn's algorithm over indices; ready tasks are taken lowest original index first. */
function topoOrder(tasks: AiTask[]): number[] | null {
  const indexById = firstIndexById(tasks);
  const inDegree = tasks.map(() => 0);
  const dependents: number[][] = tasks.map(() => []);
  tasks.forEach((task, taskIndex) => {
    for (const prerequisiteId of new Set(task.dependsOn)) {
      const prerequisite = indexById.get(prerequisiteId);
      if (prerequisite === undefined) continue;
      dependents[prerequisite].push(taskIndex);
      inDegree[taskIndex] += 1;
    }
  });
  const ready = inDegree.flatMap((degree, index) => (degree === 0 ? [index] : []));
  const order: number[] = [];
  for (let next = ready.shift(); next !== undefined; next = ready.shift()) {
    order.push(next);
    for (const dependent of dependents[next]) {
      inDegree[dependent] -= 1;
      if (inDegree[dependent] === 0) ready.push(dependent);
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
  return order === null ? null : order.map((index) => tasks[index]);
}

/** The schedule every task is placed in: event, today and the compression factor. */
type Frame = { eventDate: string; today: string; factor: number };

/** Dates one task, given the due dates of its prerequisites (already placed). */
function placeTask(task: AiTask, prerequisiteDues: string[], frame: Frame): ScheduledTask {
  const { eventDate, today, factor } = frame;
  const idealStart = addDays(eventDate, -compressedLeadDays(task.leadWeeks, factor));
  const start = prerequisiteDues.reduce(maxDate, maxDate(idealStart, today));
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
    crunch: addDays(eventDate, -task.leadWeeks * DAYS_PER_WEEK) < today,
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
  const indexById = firstIndexById(tasks);
  const { factor } = scheduleCompression(tasks, eventDate, today);
  const frame: Frame = { eventDate, today, factor };
  const dueByIndex: string[] = [];
  const placed: { index: number; task: ScheduledTask }[] = [];
  for (const index of order ?? tasks.map((_, position) => position)) {
    const prerequisites =
      order === null ? [] : tasks[index].dependsOn.flatMap((id) => indexById.get(id) ?? []);
    const task = placeTask(
      tasks[index],
      prerequisites.map((prerequisite) => dueByIndex[prerequisite]),
      frame,
    );
    dueByIndex[index] = task.due;
    placed.push({ index, task });
  }
  placed.sort((a, b) => compareByDue(a.task, b.task) || a.index - b.index);
  return placed.map((entry) => entry.task);
}

/**
 * Recomputes `overdue` against a new "today". Nothing else changes.
 * @param timeline Scheduled tasks.
 * @param today ISO "today" (injected).
 */
export function refreshStatus(timeline: ScheduledTask[], today: string): ScheduledTask[] {
  return timeline.map((task) => ({ ...task, overdue: isOverdue(task.done, task.due, today) }));
}

/**
 * Marks one task done or not done. Done tasks are never overdue; un-doing leaves `overdue`
 * as it was, so call `refreshStatus` afterwards to recompute it.
 * @param timeline Scheduled tasks.
 * @param id Task id.
 * @param done New completion state.
 */
export function setTaskDone(timeline: ScheduledTask[], id: string, done: boolean): ScheduledTask[] {
  return timeline.map((task) =>
    task.id === id ? { ...task, done, overdue: !done && task.overdue } : task,
  );
}
