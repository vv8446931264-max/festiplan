import { AI_COUNTS } from "@/lib/contracts";
import type {
  AiTask,
  BudgetCategory,
  BudgetWeight,
  Idea,
  PlanInput,
  TaskCategory,
  Tip,
  TipKind,
  VendorGuide,
} from "@/lib/contracts";

/** An idea without its menu: the menu is filled in per brief, because it follows dietary needs. */
export type Concept = Omit<Idea, "food">;

/**
 * A template task: it starts `leadWeeks` before the event, takes `durationDays`, and waits for
 * the tasks named in `dependsOn`. Positional, so each template's task list reads like a table.
 */
export function task(
  id: string,
  title: string,
  category: TaskCategory,
  leadWeeks: number,
  durationDays: number,
  dependsOn: string[] = [],
): AiTask {
  return { id, title, category, leadWeeks, durationDays, dependsOn };
}

/** A template budget weight: a relative priority (never rupees) and why it matters. */
export function weight(
  category: BudgetCategory,
  priority: number,
  rationale: string,
): BudgetWeight {
  return { category, weight: priority, rationale };
}

/** Template guidance for one kind of vendor: how early to book, what to ask, what to avoid. */
export function vendor(
  category: BudgetCategory,
  bookByWeeks: number,
  questions: string[],
  redFlags: string[],
): VendorGuide {
  return { category, bookByWeeks, questions, redFlags };
}

/** A template tip. */
export function tip(kind: TipKind, text: string): Tip {
  return { kind, text };
}

/** Lower-cased brief text (title, vibe, constraints) used for keyword checks. */
export function briefText(input: PlanInput): string {
  return [input.title ?? "", input.vibe, ...input.constraints].join(" ").toLowerCase();
}

/** True when any keyword appears in the brief. */
export function mentions(input: PlanInput, ...words: string[]): boolean {
  const text = briefText(input);
  return words.some((word) => text.includes(word));
}

/** True when the brief asks for vegetarian, vegan or Jain food. */
export function isVegetarian(input: PlanInput): boolean {
  const text = briefText(input);
  if (/\bno (?:meat|non[- ]?veg)/.test(text)) return true;
  return /(?<!non[- ]?)\b(?:veg|vegetarian|vegan|jain|satvik|sattvic)\b/.test(text);
}

/** Shortens text to `max` characters on a word boundary, adding an ellipsis if cut. */
export function clip(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}

/** A tip that applies when the brief mentions any of the keywords (or matches a custom test). */
type ConstraintTip = { applies: (input: PlanInput) => boolean; tip: Tip };

const CONSTRAINT_TIPS: ConstraintTip[] = [
  {
    applies: (input) => mentions(input, "wheelchair", "accessib", "elderly", "senior", "mobility"),
    tip: tip(
      "accessibility",
      "Ask every venue for step-free entry, an accessible toilet and reserved seating near the stage for guests with limited mobility.",
    ),
  },
  {
    applies: (input) =>
      mentions(input, "eco", "zero waste", "zero-waste", "plastic", "green", "sustainab"),
    tip: tip(
      "sustainability",
      "Write 'no single-use plastic' into caterer and décor contracts, and arrange segregated bins with a local composting or recycling partner.",
    ),
  },
  {
    applies: isVegetarian,
    tip: tip(
      "culture",
      "Confirm in writing that the kitchen keeps vegetarian and Jain preparation separate, and label every counter clearly.",
    ),
  },
];

/** Tips triggered by constraints in the brief, so the template still feels personal. */
export function constraintTips(input: PlanInput): Tip[] {
  return CONSTRAINT_TIPS.filter((rule) => rule.applies(input)).map((rule) => rule.tip);
}

/** Merges base tips with constraint tips (constraint tips first), de-duplicated and capped. */
export function mergeTips(base: Tip[], extra: Tip[]): Tip[] {
  const seen = new Set<string>();
  return [...extra, ...base]
    .filter((entry) => {
      const key = `${entry.kind}:${entry.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, AI_COUNTS.tips.max);
}
