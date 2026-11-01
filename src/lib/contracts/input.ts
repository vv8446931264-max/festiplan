import { z } from "zod";
import { AI_COUNTS, AI_TEXT_MAX } from "./ai-limits";
import { BUDGET_CATEGORIES, EVENT_TYPES, LANGS, LIMITS } from "./constants";

export { checkEventDate } from "./dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-14");

/** Validated request body for POST /api/plan. Unknown keys are rejected. */
export const PlanInputSchema = z.strictObject({
  eventType: z.enum(EVENT_TYPES),
  title: z.string().trim().max(LIMITS.titleMax).optional(),
  eventDate: isoDate,
  city: z.string().trim().min(LIMITS.cityMin, "Enter a city").max(LIMITS.cityMax),
  guests: z.number().int().min(LIMITS.guestsMin).max(LIMITS.guestsMax),
  budgetINR: z.number().int().min(LIMITS.budgetMin).max(LIMITS.budgetMax),
  vibe: z.string().trim().max(LIMITS.vibeMax),
  constraints: z
    .array(z.string().trim().min(1).max(LIMITS.constraintMax))
    .max(LIMITS.constraintsMax),
  language: z.enum(LANGS),
});
export type PlanInput = z.infer<typeof PlanInputSchema>;

/** A patch may carry twice the tasks a plan holds before it is rejected. */
const PATCH_TASKS_MAX = 2 * AI_COUNTS.tasks.max;

const hasAnyField = (patch: Record<string, unknown>): boolean =>
  Object.values(patch).some((value) => value !== undefined);

const taskDone = z.strictObject({
  id: z.string().min(1).max(AI_TEXT_MAX.taskId),
  done: z.boolean(),
});
const vendorDone = z.strictObject({ category: z.enum(BUDGET_CATEGORIES), done: z.boolean() });
const allocationEdit = z.strictObject({
  category: z.enum(BUDGET_CATEGORIES),
  amountINR: z.number().int().min(0).max(LIMITS.budgetMax),
  locked: z.boolean(),
});
const actual = z.strictObject({
  category: z.enum(BUDGET_CATEGORIES),
  actualINR: z.number().int().min(0).max(LIMITS.budgetMax).nullable(),
});

/** Validated body for PATCH /api/plan/[id]. Every field is optional; at least one is required. */
export const PlanPatchSchema = z
  .strictObject({
    tasks: z.array(taskDone).max(PATCH_TASKS_MAX).optional(),
    vendors: z.array(vendorDone).max(BUDGET_CATEGORIES.length).optional(),
    allocations: z.array(allocationEdit).max(BUDGET_CATEGORIES.length).optional(),
    actuals: z.array(actual).max(BUDGET_CATEGORIES.length).optional(),
  })
  .refine(hasAnyField, "Nothing to update");
export type PlanPatch = z.infer<typeof PlanPatchSchema>;

/** Validated body for POST /api/plan/[id]/refine. */
export const RefineSchema = z.strictObject({
  question: z.string().trim().min(2, "Ask a question").max(LIMITS.questionMax),
});

/** Plan ids as they appear in URLs: 6–32 URL-safe characters. */
export const PLAN_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;

/**
 * Validated body for POST /api/vendors. Lookups are bound to an existing plan: the city
 * and event type come from the stored plan, never from the request.
 */
export const VendorQuerySchema = z.strictObject({
  planId: z.string().regex(PLAN_ID_RE, "Unknown plan"),
  category: z.enum(BUDGET_CATEGORIES),
});
export type VendorQuery = z.infer<typeof VendorQuerySchema>;
