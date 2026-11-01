import { z } from "zod";
import { AI_COUNTS, AI_RANGES, AI_TEXT_MAX } from "./ai-limits";
import type { Bounds } from "./ai-limits";
import { BUDGET_CATEGORIES, TASK_CATEGORIES, TIP_KINDS } from "./constants";

const text = (max: number) => z.string().trim().min(1).max(max);
const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "palette colours are #RRGGBB");
const taskId = new RegExp(`^[a-z0-9-]{1,${AI_TEXT_MAX.taskId}}$`);

/** A whole number within `bounds`. */
const whole = ({ min, max }: Bounds) => z.number().int().min(min).max(max);

/** A list of `item`s within `bounds`; an exact size uses `.length`, so the message says "exactly N". */
const list = <T extends z.ZodType>(item: T, { min, max }: Bounds) =>
  min === max ? z.array(item).length(min) : z.array(item).min(min).max(max);

/** One celebration concept: name, story, palette, décor, food, music and a signature moment. */
const IdeaSchema = z.object({
  name: text(AI_TEXT_MAX.ideaName),
  concept: text(AI_TEXT_MAX.concept),
  palette: list(hexColour, AI_COUNTS.palette),
  decor: list(text(AI_TEXT_MAX.decorItem), AI_COUNTS.decor),
  food: list(text(AI_TEXT_MAX.foodItem), AI_COUNTS.food),
  music: text(AI_TEXT_MAX.music),
  signatureMoment: text(AI_TEXT_MAX.signatureMoment),
});
/** A validated {@link IdeaSchema} value. */
export type Idea = z.infer<typeof IdeaSchema>;

/** How much one budget category matters (1–100) — a priority, never rupees. */
const BudgetWeightSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  weight: whole(AI_RANGES.weight),
  rationale: text(AI_TEXT_MAX.rationale),
});
/** A validated {@link BudgetWeightSchema} value. */
export type BudgetWeight = z.infer<typeof BudgetWeightSchema>;

/** One planning task with its ideal lead time, duration and prerequisites. */
const AiTaskSchema = z.object({
  id: z.string().regex(taskId, "task ids are kebab-case"),
  title: text(AI_TEXT_MAX.taskTitle),
  category: z.enum(TASK_CATEGORIES),
  leadWeeks: whole(AI_RANGES.leadWeeks),
  durationDays: whole(AI_RANGES.durationDays),
  dependsOn: list(z.string().max(AI_TEXT_MAX.taskId), AI_COUNTS.dependsOn),
});
/** A validated {@link AiTaskSchema} value. */
export type AiTask = z.infer<typeof AiTaskSchema>;

/** What to ask one kind of vendor, the red flags, and how far ahead to book. */
const VendorGuideSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  bookByWeeks: whole(AI_RANGES.bookByWeeks),
  questions: list(text(AI_TEXT_MAX.question), AI_COUNTS.questions),
  redFlags: list(text(AI_TEXT_MAX.redFlag), AI_COUNTS.redFlags),
});
/** A validated {@link VendorGuideSchema} value. */
export type VendorGuide = z.infer<typeof VendorGuideSchema>;

/** One practical tip (sustainability, accessibility, culture or savings). */
const TipSchema = z.object({ kind: z.enum(TIP_KINDS), text: text(AI_TEXT_MAX.tip) });
/** A validated {@link TipSchema} value. */
export type Tip = z.infer<typeof TipSchema>;

const unique = <T>(items: T[], key: (item: T) => string) =>
  new Set(items.map(key)).size === items.length;

/**
 * The ONLY thing the model returns. It never contains totals, rupee amounts or
 * dates — those are computed in `src/lib/engine`.
 */
export const AiPlanSchema = z.object({
  summary: text(AI_TEXT_MAX.summary),
  ideas: list(IdeaSchema, AI_COUNTS.ideas),
  budgetWeights: list(BudgetWeightSchema, AI_COUNTS.budgetWeights).refine(
    (weights) => unique(weights, (weight) => weight.category),
    "budgetWeights categories must be unique",
  ),
  tasks: list(AiTaskSchema, AI_COUNTS.tasks).refine(
    (tasks) => unique(tasks, (task) => task.id),
    "task ids must be unique",
  ),
  vendors: list(VendorGuideSchema, AI_COUNTS.vendors).refine(
    (vendors) => unique(vendors, (vendor) => vendor.category),
    "vendor categories must be unique",
  ),
  tips: list(TipSchema, AI_COUNTS.tips),
});
/** A validated {@link AiPlanSchema} value. */
export type AiPlan = z.infer<typeof AiPlanSchema>;
