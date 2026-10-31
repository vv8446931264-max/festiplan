import { z } from "zod";
import { BUDGET_CATEGORIES, TASK_CATEGORIES, TIP_KINDS } from "./constants";

const text = (max: number) => z.string().trim().min(1).max(max);
const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "palette colours are #RRGGBB");

/** One celebration concept: name, story, palette, décor, food, music and a signature moment. */
export const IdeaSchema = z.object({
  name: text(60),
  concept: text(400),
  palette: z.array(hexColour).min(3).max(5),
  decor: z.array(text(140)).min(2).max(6),
  food: z.array(text(140)).min(2).max(6),
  music: text(200),
  signatureMoment: text(300),
});
/** A validated {@link IdeaSchema} value. */
export type Idea = z.infer<typeof IdeaSchema>;

/** How much one budget category matters (1–100) — a priority, never rupees. */
export const BudgetWeightSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  weight: z.number().int().min(1).max(100),
  rationale: text(200),
});
/** A validated {@link BudgetWeightSchema} value. */
export type BudgetWeight = z.infer<typeof BudgetWeightSchema>;

/** One planning task with its ideal lead time, duration and prerequisites. */
export const AiTaskSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/, "task ids are kebab-case"),
  title: text(100),
  category: z.enum(TASK_CATEGORIES),
  leadWeeks: z.number().int().min(0).max(156),
  durationDays: z.number().int().min(1).max(90),
  dependsOn: z.array(z.string().max(40)).max(5),
});
/** A validated {@link AiTaskSchema} value. */
export type AiTask = z.infer<typeof AiTaskSchema>;

/** What to ask one kind of vendor, the red flags, and how far ahead to book. */
export const VendorGuideSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  bookByWeeks: z.number().int().min(0).max(104),
  questions: z.array(text(160)).min(2).max(5),
  redFlags: z.array(text(160)).min(1).max(4),
});
/** A validated {@link VendorGuideSchema} value. */
export type VendorGuide = z.infer<typeof VendorGuideSchema>;

/** One practical tip (sustainability, accessibility, culture or savings). */
export const TipSchema = z.object({ kind: z.enum(TIP_KINDS), text: text(240) });
/** A validated {@link TipSchema} value. */
export type Tip = z.infer<typeof TipSchema>;

const unique = <T>(items: T[], key: (item: T) => string) =>
  new Set(items.map(key)).size === items.length;

/**
 * The ONLY thing the model returns. It never contains totals, rupee amounts or
 * dates — those are computed in `src/lib/engine`.
 */
export const AiPlanSchema = z.object({
  summary: text(320),
  ideas: z.array(IdeaSchema).length(3),
  budgetWeights: z
    .array(BudgetWeightSchema)
    .min(4)
    .max(BUDGET_CATEGORIES.length)
    .refine(
      (weights) => unique(weights, (weight) => weight.category),
      "budgetWeights categories must be unique",
    ),
  tasks: z
    .array(AiTaskSchema)
    .min(12)
    .max(30)
    .refine((tasks) => unique(tasks, (task) => task.id), "task ids must be unique"),
  vendors: z
    .array(VendorGuideSchema)
    .min(3)
    .max(BUDGET_CATEGORIES.length)
    .refine(
      (vendors) => unique(vendors, (vendor) => vendor.category),
      "vendor categories must be unique",
    ),
  tips: z.array(TipSchema).min(2).max(8),
});
/** A validated {@link AiPlanSchema} value. */
export type AiPlan = z.infer<typeof AiPlanSchema>;
