import type {
  AiTask,
  Allocation,
  BudgetCategory,
  BudgetWeight,
  ScheduledTask,
  VendorGuide,
  VendorItem,
} from "@/lib/contracts";

/** The "today" engine tests schedule against (the engine never reads the clock). */
export const TODAY = "2026-10-24";

/** A Valentine's Day event, 113 days after {@link TODAY}. */
export const EVENT = "2027-02-14";

/** A budget line with neutral derived fields; `extra` overrides any of them. */
export function allocation(
  category: BudgetCategory,
  amountINR: number,
  extra: Partial<Allocation> = {},
): Allocation {
  return {
    category,
    amountINR,
    percent: 0,
    perGuestINR: 0,
    rationale: `why ${category}`,
    locked: false,
    actualINR: null,
    ...extra,
  };
}

/** An AI budget weight; the rationale defaults to `r-<category>`. */
export function budgetWeight(
  category: BudgetCategory,
  weight: number,
  rationale = `r-${category}`,
): BudgetWeight {
  return { category, weight, rationale };
}

/** An AI task titled `Task <id>` in the admin category. */
export function aiTask(
  id: string,
  leadWeeks: number,
  durationDays = 1,
  dependsOn: string[] = [],
): AiTask {
  return { id, title: `Task ${id}`, category: "admin", leadWeeks, durationDays, dependsOn };
}

/** A scheduled admin task that starts and is due on `due`; `extra` overrides any field. */
export function scheduledTask(
  id: string,
  due: string,
  extra: Partial<ScheduledTask> = {},
): ScheduledTask {
  return {
    id,
    title: id,
    category: "admin",
    start: due,
    due,
    phase: "1-3m",
    done: false,
    overdue: false,
    crunch: false,
    ...extra,
  };
}

/** Vendor guidance with two questions and one red flag. */
export function vendorGuide(category: BudgetCategory, bookByWeeks: number): VendorGuide {
  return { category, bookByWeeks, questions: ["Q1?", "Q2?"], redFlags: ["Flag"] };
}

/** A vendor checklist row with no guidance text; `extra` overrides any field. */
export function vendorItem(
  category: BudgetCategory,
  bookBy: string,
  extra: Partial<VendorItem> = {},
): VendorItem {
  return { category, bookBy, questions: [], redFlags: [], done: false, overdue: false, ...extra };
}

/** The amounts of budget lines, in order. */
export const amountsOf = (lines: readonly { amountINR: number }[]): number[] =>
  lines.map((line) => line.amountINR);

/** The sum of any list of numbers (typed arrays included). */
export const sum = (values: ArrayLike<number>): number =>
  Array.from(values).reduce((total, value) => total + value, 0);

/** The task with `id`; throws, so a missing task fails the test loudly. */
export function findTask(timeline: readonly ScheduledTask[], id: string): ScheduledTask {
  const found = timeline.find((task) => task.id === id);
  if (!found) throw new Error(`missing task ${id}`);
  return found;
}
