import { BUDGET_CATEGORIES } from "./constants";

/*
 * Size limits of an `AiPlan`, written once. The Zod schema (`ai.ts`), the Gemini JSON Schema
 * (`src/lib/ai/schema.ts`), the prompts, the template fallback and the patch schema all read
 * these numbers, so they cannot drift apart. Zod-free: any layer may import this module.
 */

/** Inclusive bounds on a list's length or on a whole-number field. */
export type Bounds = { readonly min: number; readonly max: number };

/** How many items each list in an `AiPlan` holds. */
export const AI_COUNTS = {
  /** Exactly three distinct concepts. */
  ideas: { min: 3, max: 3 },
  /** Hex colours in one idea's palette. */
  palette: { min: 3, max: 5 },
  /** Décor ideas in one concept. */
  decor: { min: 2, max: 6 },
  /** Food and drink ideas in one concept. */
  food: { min: 2, max: 6 },
  /** At most one weight per budget category. */
  budgetWeights: { min: 4, max: BUDGET_CATEGORIES.length },
  tasks: { min: 12, max: 30 },
  /** Prerequisites listed on one task. */
  dependsOn: { min: 0, max: 5 },
  /** At most one guide per budget category. */
  vendors: { min: 3, max: BUDGET_CATEGORIES.length },
  /** Questions to ask one kind of vendor. */
  questions: { min: 2, max: 5 },
  /** Red flags to watch for in one kind of vendor. */
  redFlags: { min: 1, max: 4 },
  tips: { min: 2, max: 8 },
} as const satisfies Record<string, Bounds>;

/** Longest text, in characters, of each string in an `AiPlan`; every string has at least one. */
export const AI_TEXT_MAX = {
  summary: 320,
  ideaName: 60,
  concept: 400,
  decorItem: 140,
  foodItem: 140,
  music: 200,
  signatureMoment: 300,
  /** Why one budget category matters. */
  rationale: 200,
  /** Task ids, and the ids a task depends on. */
  taskId: 40,
  taskTitle: 100,
  question: 160,
  redFlag: 160,
  tip: 240,
} as const;

/** Bounds of each whole-number field in an `AiPlan`. */
export const AI_RANGES = {
  /** Relative priority of a budget category — a weight, never rupees. */
  weight: { min: 1, max: 100 },
  /** Weeks before the event that a task starts. */
  leadWeeks: { min: 0, max: 156 },
  /** Days a task takes. */
  durationDays: { min: 1, max: 90 },
  /** Weeks before the event to book a vendor by. */
  bookByWeeks: { min: 0, max: 104 },
} as const satisfies Record<string, Bounds>;

/**
 * Bounds as prompts and schema descriptions word them: "3 to 5", or "exactly 3" when the
 * bounds meet.
 */
export function rangeText({ min, max }: Bounds): string {
  return min === max ? `exactly ${min}` : `${min} to ${max}`;
}
