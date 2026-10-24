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

/** Builds a template task. Keeps template files compact and readable. */
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

/** Builds a template budget weight (a relative priority, never rupees). */
export function weight(category: BudgetCategory, w: number, rationale: string): BudgetWeight {
  return { category, weight: w, rationale };
}

/** Builds a template vendor guide. */
export function vendor(
  category: BudgetCategory,
  bookByWeeks: number,
  questions: string[],
  redFlags: string[],
): VendorGuide {
  return { category, bookByWeeks, questions, redFlags };
}

/** Builds a template tip. */
export function tip(kind: TipKind, text: string): Tip {
  return { kind, text };
}

/** Builds a template idea. */
export function idea(
  name: string,
  concept: string,
  palette: string[],
  decor: string[],
  food: string[],
  music: string,
  signatureMoment: string,
): Idea {
  return { name, concept, palette, decor, food, music, signatureMoment };
}

/** Lower-cased brief text (title, vibe, constraints) used for keyword checks. */
export function briefText(input: PlanInput): string {
  return [input.title ?? "", input.vibe, ...input.constraints].join(" ").toLowerCase();
}

/** True when any keyword appears in the brief. */
export function mentions(input: PlanInput, ...words: string[]): boolean {
  const text = briefText(input);
  return words.some((w) => text.includes(w));
}

/** True when the brief asks for vegetarian, vegan or Jain food. */
export function isVegetarian(input: PlanInput): boolean {
  const text = briefText(input);
  if (/\bno (?:meat|non[- ]?veg)/.test(text)) return true;
  return /(?<!non[- ]?)\b(?:veg|vegetarian|vegan|jain|satvik|sattvic)\b/.test(text);
}

/** Shortens text to `max` characters on a word boundary, adding an ellipsis if cut. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Tips triggered by constraints in the brief, so the template still feels personal. */
export function constraintTips(input: PlanInput): Tip[] {
  const tips: Tip[] = [];
  if (mentions(input, "wheelchair", "accessib", "elderly", "senior", "mobility")) {
    tips.push(tip("accessibility", "Ask every venue for step-free entry, an accessible toilet and reserved seating near the stage for guests with limited mobility."));
  }
  if (mentions(input, "eco", "zero waste", "zero-waste", "plastic", "green", "sustainab")) {
    tips.push(tip("sustainability", "Write 'no single-use plastic' into caterer and décor contracts, and arrange segregated bins with a local composting or recycling partner."));
  }
  if (isVegetarian(input)) {
    tips.push(tip("culture", "Confirm in writing that the kitchen keeps vegetarian and Jain preparation separate, and label every counter clearly."));
  }
  return tips;
}

/** Merges base tips with constraint tips, de-duplicated by kind+text and capped at 8. */
export function mergeTips(base: Tip[], extra: Tip[]): Tip[] {
  const seen = new Set<string>();
  return [...extra, ...base]
    .filter((t) => {
      const key = `${t.kind}:${t.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
