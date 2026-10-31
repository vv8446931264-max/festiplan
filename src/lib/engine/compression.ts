import { diffDays } from "./dates";
import { DAYS_PER_WEEK } from "./shared";

/** How a plan's ideal lead times compare with the days actually left before the event. */
export type ScheduleCompression = {
  /** True when the ideal lead times do not fit and every step was shortened. */
  compressed: boolean;
  /** Multiplier applied to lead times and durations: 1 when they fit, otherwise below 1. */
  factor: number;
  /** Whole days from today to the event (0 when the event is today or already past). */
  availableDays: number;
  /** The longest ideal lead time, in days (`max(leadWeeks) · 7`). */
  idealDays: number;
};

/**
 * Proportional compression factor: 1 when the ideal span fits in the days available (or there is
 * no span to fit), otherwise `available / ideal`. Never negative.
 * @param idealSpanDays Longest ideal lead time, in days.
 * @param availableDays Days between today and the event.
 */
export function compressionFactor(idealSpanDays: number, availableDays: number): number {
  if (idealSpanDays <= 0 || idealSpanDays <= availableDays) return 1;
  return Math.max(0, availableDays) / idealSpanDays;
}

/**
 * Days before the event that a step with `leadWeeks` ideal lead time starts (or must be booked)
 * once compressed by `factor`. A step with at least one ideal week keeps at least one day of lead,
 * so it never lands on the event day; `leadWeeks` of 0 stays on the event day.
 * @param leadWeeks Ideal lead time in weeks.
 * @param factor Result of `compressionFactor`.
 */
export function compressedLeadDays(leadWeeks: number, factor: number): number {
  return leadWeeks > 0 ? Math.max(1, Math.round(leadWeeks * DAYS_PER_WEEK * factor)) : 0;
}

/**
 * Compares the ideal schedule length with the days left, so the UI can say so honestly:
 * "You have 12 days; this plan ideally needs 26 weeks, so every step is compressed proportionally".
 * @param tasks Anything with a `leadWeeks` (AI tasks, or vendor guides mapped to it).
 * @param eventDate ISO event date.
 * @param today ISO "today" (injected).
 */
export function scheduleCompression(
  tasks: readonly { leadWeeks: number }[],
  eventDate: string,
  today: string,
): ScheduleCompression {
  const availableDays = Math.max(0, diffDays(today, eventDate));
  const idealDays = tasks.reduce(
    (longest, task) => Math.max(longest, task.leadWeeks * DAYS_PER_WEEK),
    0,
  );
  const factor = compressionFactor(idealDays, availableDays);
  return { compressed: factor < 1, factor, availableDays, idealDays };
}
