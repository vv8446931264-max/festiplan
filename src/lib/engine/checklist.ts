import { PHASES } from "@/lib/contracts/constants";
import type {
  BudgetCategory,
  Phase,
  ScheduledTask,
  VendorGuide,
  VendorItem,
} from "@/lib/contracts";
import { compressedLeadDays, scheduleCompression } from "./compression";
import { addDays, maxDate } from "./dates";
import { budgetCategoryRank, compareAscending } from "./shared";
import { compareByDue, isOverdue } from "./timeline";

/** Earliest book-by date first; on the same day, the canonical category order. */
const byBookByThenCategory = (a: VendorItem, b: VendorItem): number =>
  compareAscending(a.bookBy, b.bookBy) ||
  budgetCategoryRank(a.category) - budgetCategoryRank(b.category);

/**
 * Turns AI vendor guidance into a dated checklist. `bookBy = max(event − bookByWeeks·7·f, today)`
 * where `f` is the proportional compression factor for the vendor lead times (1 when the longest
 * one fits before the event, so a far-off event is unchanged). A vendor with `bookByWeeks ≥ 1` is
 * booked by the day before the event at the latest, whenever that is not already past.
 * Sorted by `bookBy`, then budget-category order. Nothing is done at creation.
 * @param vendors Vendor guidance from the AI plan.
 * @param eventDate ISO event date.
 * @param today ISO "today" (injected).
 */
export function scheduleVendors(
  vendors: VendorGuide[],
  eventDate: string,
  today: string,
): VendorItem[] {
  const { factor } = scheduleCompression(
    vendors.map((guide) => ({ leadWeeks: guide.bookByWeeks })),
    eventDate,
    today,
  );
  return vendors
    .map((guide): VendorItem => {
      const leadDays = compressedLeadDays(guide.bookByWeeks, factor);
      const bookBy = maxDate(addDays(eventDate, -leadDays), today);
      return {
        category: guide.category,
        bookBy,
        questions: [...guide.questions],
        redFlags: [...guide.redFlags],
        done: false,
        overdue: isOverdue(false, bookBy, today),
      };
    })
    .sort(byBookByThenCategory);
}

/**
 * Recomputes `overdue` on vendor rows against a new "today".
 * @param items Vendor checklist rows.
 * @param today ISO "today" (injected).
 */
export function refreshVendorStatus(items: VendorItem[], today: string): VendorItem[] {
  return items.map((item) => ({ ...item, overdue: isOverdue(item.done, item.bookBy, today) }));
}

/**
 * Marks one vendor row done or not done. Done rows are never overdue; un-doing leaves
 * `overdue` as it was, so call `refreshVendorStatus` afterwards to recompute it.
 * @param items Vendor checklist rows.
 * @param category Row to change.
 * @param done New completion state.
 */
export function setVendorDone(
  items: VendorItem[],
  category: BudgetCategory,
  done: boolean,
): VendorItem[] {
  return items.map((item) =>
    item.category === category ? { ...item, done, overdue: !done && item.overdue } : item,
  );
}

/**
 * Completion counts for any list of done-flagged items.
 * @param items Things with a `done` flag.
 * @returns Done count, total and a rounded percent (0 when the list is empty).
 */
export function progress(items: { done: boolean }[]): {
  done: number;
  total: number;
  percent: number;
} {
  const done = items.filter((item) => item.done).length;
  const total = items.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * The next tasks to work on: not done, by due date then start date (ties keep timeline order).
 * @param timeline Scheduled tasks.
 * @param limit How many to return.
 */
export function nextActions(timeline: ScheduledTask[], limit = 3): ScheduledTask[] {
  return timeline
    .filter((task) => !task.done)
    .sort(compareByDue)
    .slice(0, Math.max(0, limit));
}

/**
 * Groups tasks by phase, in `PHASES` order (earliest first), skipping empty phases.
 * @param timeline Scheduled tasks.
 */
export function groupByPhase(
  timeline: ScheduledTask[],
): { phase: Phase; tasks: ScheduledTask[] }[] {
  return PHASES.map((phase) => ({
    phase,
    tasks: timeline.filter((task) => task.phase === phase),
  })).filter((group) => group.tasks.length > 0);
}
