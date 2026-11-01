// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseAiPlan } from "@/lib/ai/plan";
import { templatePlan } from "@/lib/ai/templates";
import {
  AI_COUNTS,
  AI_RANGES,
  AI_TEXT_MAX,
  AiPlanSchema,
  BUDGET_CATEGORIES,
  PlanPatchSchema,
  rangeText,
} from "@/lib/contracts";
import { sampleInput } from "../server/fixtures";

/*
 * `AI_COUNTS`, `AI_TEXT_MAX` and `AI_RANGES` are the only place these numbers are written. Each
 * table below must have one entry per key (the `Record` types insist), and every entry is checked
 * at the edge of its limit: the limit itself passes, one step past it fails.
 */

const base = templatePlan(sampleInput());
const accepts = (plan: unknown): boolean => AiPlanSchema.safeParse(plan).success;
const keysOf = <T extends object>(table: T) => Object.keys(table) as (keyof T)[];
const build = <T>(n: number, make: (index: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(i));
const pick = <T>(items: readonly T[], index: number): T => items[index % items.length];

const withIdeas = (change: object) => ({
  ...base,
  ideas: base.ideas.map((idea) => ({ ...idea, ...change })),
});
const withTasks = (change: object) => ({
  ...base,
  tasks: base.tasks.map((task) => ({ ...task, ...change })),
});
const withVendors = (change: object) => ({
  ...base,
  vendors: base.vendors.map((vendor) => ({ ...vendor, ...change })),
});
const withWeights = (change: object) => ({
  ...base,
  budgetWeights: base.budgetWeights.map((entry) => ({ ...entry, ...change })),
});

/** A plan whose list `key` holds `n` items, everything else valid. */
const COUNT_CASES: Record<keyof typeof AI_COUNTS, (n: number) => unknown> = {
  ideas: (n) => ({ ...base, ideas: build(n, (i) => pick(base.ideas, i)) }),
  palette: (n) => withIdeas({ palette: build(n, (i) => pick(base.ideas[0].palette, i)) }),
  decor: (n) => withIdeas({ decor: build(n, () => "Marigold arches") }),
  food: (n) => withIdeas({ food: build(n, () => "Dal baati") }),
  budgetWeights: (n) => ({
    ...base,
    budgetWeights: build(n, (i) => ({
      ...base.budgetWeights[0],
      category: pick(BUDGET_CATEGORIES, i),
    })),
  }),
  tasks: (n) => ({
    ...base,
    tasks: build(n, (i) => ({ ...base.tasks[0], id: `task-${i}`, dependsOn: [] })),
  }),
  dependsOn: (n) => withTasks({ dependsOn: build(n, (i) => `task-${i}`) }),
  vendors: (n) => ({
    ...base,
    vendors: build(n, (i) => ({ ...base.vendors[0], category: pick(BUDGET_CATEGORIES, i) })),
  }),
  questions: (n) => withVendors({ questions: build(n, (i) => `Question ${i}?`) }),
  redFlags: (n) => withVendors({ redFlags: build(n, (i) => `Flag ${i}`) }),
  tips: (n) => ({ ...base, tips: build(n, () => base.tips[0]) }),
};

/** A plan whose string `key` is `text`, everything else valid. */
const TEXT_CASES: Record<keyof typeof AI_TEXT_MAX, (text: string) => unknown> = {
  summary: (text) => ({ ...base, summary: text }),
  ideaName: (name) => withIdeas({ name }),
  concept: (concept) => withIdeas({ concept }),
  decorItem: (text) => withIdeas({ decor: [text, text] }),
  foodItem: (text) => withIdeas({ food: [text, text] }),
  music: (music) => withIdeas({ music }),
  signatureMoment: (signatureMoment) => withIdeas({ signatureMoment }),
  rationale: (rationale) => withWeights({ rationale }),
  taskId: (id) => ({ ...base, tasks: [{ ...base.tasks[0], id }, ...base.tasks.slice(1)] }),
  taskTitle: (title) => withTasks({ title }),
  question: (text) => withVendors({ questions: [text, text] }),
  redFlag: (text) => withVendors({ redFlags: [text] }),
  tip: (text) => ({ ...base, tips: base.tips.map((tip) => ({ ...tip, text })) }),
};

/** A plan whose whole-number field `key` is `value`, everything else valid. */
const RANGE_CASES: Record<keyof typeof AI_RANGES, (value: number) => unknown> = {
  weight: (weight) => withWeights({ weight }),
  leadWeeks: (leadWeeks) => withTasks({ leadWeeks }),
  durationDays: (durationDays) => withTasks({ durationDays }),
  bookByWeeks: (bookByWeeks) => withVendors({ bookByWeeks }),
};

describe("AI_COUNTS", () => {
  it("is valid as the template plan has it", () => {
    expect(accepts(base)).toBe(true);
  });

  it.each(keysOf(AI_COUNTS))("%s: its own sizes pass, one more or one fewer fails", (key) => {
    const { min, max } = AI_COUNTS[key];
    const withSize = COUNT_CASES[key];
    expect(accepts(withSize(min))).toBe(true);
    expect(accepts(withSize(max))).toBe(true);
    expect(accepts(withSize(max + 1))).toBe(false);
    if (min > 0) expect(accepts(withSize(min - 1))).toBe(false);
  });
});

describe("AI_TEXT_MAX", () => {
  it.each(keysOf(AI_TEXT_MAX))("%s: the longest text passes, one more or none fails", (key) => {
    const max = AI_TEXT_MAX[key];
    const withText = TEXT_CASES[key];
    expect(accepts(withText("a".repeat(max)))).toBe(true);
    expect(accepts(withText("a".repeat(max + 1)))).toBe(false);
    expect(accepts(withText(""))).toBe(false);
  });

  it("also caps the ids a task depends on", () => {
    expect(accepts(withTasks({ dependsOn: ["a".repeat(AI_TEXT_MAX.taskId)] }))).toBe(true);
    expect(accepts(withTasks({ dependsOn: ["a".repeat(AI_TEXT_MAX.taskId + 1)] }))).toBe(false);
  });
});

describe("AI_RANGES", () => {
  it.each(keysOf(AI_RANGES))("%s: both ends pass, anything beyond or fractional fails", (key) => {
    const { min, max } = AI_RANGES[key];
    const withValue = RANGE_CASES[key];
    expect(accepts(withValue(min))).toBe(true);
    expect(accepts(withValue(max))).toBe(true);
    expect(accepts(withValue(min - 1))).toBe(false);
    expect(accepts(withValue(max + 1))).toBe(false);
    expect(accepts(withValue(min + 0.5))).toBe(false);
  });
});

describe("PlanPatchSchema", () => {
  const ticks = (n: number, id = "task") => ({ tasks: build(n, () => ({ id, done: true })) });
  const accepted = (patch: unknown) => PlanPatchSchema.safeParse(patch).success;

  it("accepts task ids as long as the model may write them, and no longer", () => {
    expect(accepted(ticks(1, "a".repeat(AI_TEXT_MAX.taskId)))).toBe(true);
    expect(accepted(ticks(1, "a".repeat(AI_TEXT_MAX.taskId + 1)))).toBe(false);
  });

  it("accepts twice as many task ticks as a plan has tasks, and no more", () => {
    expect(accepted(ticks(2 * AI_COUNTS.tasks.max))).toBe(true);
    expect(accepted(ticks(2 * AI_COUNTS.tasks.max + 1))).toBe(false);
  });
});

describe("rangeText", () => {
  it("words a range as 'min to max', and equal bounds as 'exactly N'", () => {
    expect(rangeText({ min: 3, max: 5 })).toBe("3 to 5");
    expect(rangeText({ min: 0, max: 5 })).toBe("0 to 5");
    expect(rangeText({ min: 3, max: 3 })).toBe("exactly 3");
  });
});

describe("the correction the model gets", () => {
  const errorOf = (plan: unknown): string => {
    const parsed = parseAiPlan(JSON.stringify(plan));
    return parsed.ok ? "" : parsed.error;
  };

  it("calls a wrong idea count an exact size, and a wrong task count a bound", () => {
    const fewIdeas = errorOf({ ...base, ideas: base.ideas.slice(0, 2) });
    const fewTasks = errorOf({ ...base, tasks: base.tasks.slice(0, AI_COUNTS.tasks.min - 1) });
    expect(fewIdeas).toMatch(new RegExp(`^ideas: .*exactly ${AI_COUNTS.ideas.min} items`));
    expect(fewTasks).toMatch(new RegExp(`^tasks: .*>=${AI_COUNTS.tasks.min} items`));
  });
});
