import { z } from "zod";
import { EVENT_TYPES, LANGS, BUDGET_CATEGORIES, LIMITS as L } from "./constants";

export { checkEventDate } from "./dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-14");

/** Validated request body for POST /api/plan. Unknown keys are rejected. */
export const PlanInputSchema = z.strictObject({
  eventType: z.enum(EVENT_TYPES),
  title: z.string().trim().max(L.titleMax).optional(),
  eventDate: isoDate,
  city: z.string().trim().min(L.cityMin, "Enter a city").max(L.cityMax),
  guests: z.number().int().min(L.guestsMin).max(L.guestsMax),
  budgetINR: z.number().int().min(L.budgetMin).max(L.budgetMax),
  vibe: z.string().trim().max(L.vibeMax),
  constraints: z.array(z.string().trim().min(1).max(L.constraintMax)).max(L.constraintsMax),
  language: z.enum(LANGS),
});
export type PlanInput = z.infer<typeof PlanInputSchema>;

const taskDone = z.strictObject({ id: z.string().min(1).max(40), done: z.boolean() });
const vendorDone = z.strictObject({ category: z.enum(BUDGET_CATEGORIES), done: z.boolean() });
const allocationEdit = z.strictObject({
  category: z.enum(BUDGET_CATEGORIES),
  amountINR: z.number().int().min(0).max(L.budgetMax),
  locked: z.boolean(),
});
const actual = z.strictObject({
  category: z.enum(BUDGET_CATEGORIES),
  actualINR: z.number().int().min(0).max(L.budgetMax).nullable(),
});

/** Validated body for PATCH /api/plan/[id]. Every field is optional; at least one is required. */
export const PlanPatchSchema = z
  .strictObject({
    tasks: z.array(taskDone).max(60).optional(),
    vendors: z.array(vendorDone).max(BUDGET_CATEGORIES.length).optional(),
    allocations: z.array(allocationEdit).max(BUDGET_CATEGORIES.length).optional(),
    actuals: z.array(actual).max(BUDGET_CATEGORIES.length).optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), "Nothing to update");
export type PlanPatch = z.infer<typeof PlanPatchSchema>;

/** Validated body for POST /api/plan/[id]/refine. */
export const RefineSchema = z.strictObject({
  question: z.string().trim().min(2, "Ask a question").max(L.questionMax),
});

/** Validated body for POST /api/vendors. */
export const VendorQuerySchema = z.strictObject({
  city: z.string().trim().min(L.cityMin).max(L.cityMax),
  category: z.enum(BUDGET_CATEGORIES),
  eventType: z.enum(EVENT_TYPES),
});
export type VendorQuery = z.infer<typeof VendorQuerySchema>;
