import {
  AI_COUNTS,
  AI_RANGES,
  AI_TEXT_MAX,
  BUDGET_CATEGORIES,
  TASK_CATEGORIES,
  TIP_KINDS,
  rangeText,
} from "@/lib/contracts";
import type { Bounds } from "@/lib/contracts";

const textField = (description: string) => ({ type: "string", description }) as const;

const textList = (description: string, { min, max }: Bounds) =>
  ({
    type: "array",
    description,
    minItems: min,
    maxItems: max,
    items: { type: "string" },
  }) as const;

const integerField = (description: string, { min, max }: Bounds) =>
  ({ type: "integer", description, minimum: min, maximum: max }) as const;

const enumField = (values: readonly string[]) => ({ type: "string", enum: [...values] });

/** An array of `items` sized by `size`, with a `description` only when there is one to give. */
const objectList = (items: object, { min, max }: Bounds, description?: string) => ({
  type: "array",
  ...(description === undefined ? {} : { description }),
  minItems: min,
  maxItems: max,
  items,
});

/** An object schema that requires every listed property and allows no others. */
const closedObject = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

const idea = closedObject({
  name: textField(`Short evocative concept name, at most ${AI_TEXT_MAX.ideaName} characters`),
  concept: textField(
    `Two or three sentences describing the concept, at most ${AI_TEXT_MAX.concept} characters`,
  ),
  palette: textList(
    `${rangeText(AI_COUNTS.palette)} colours as #RRGGBB hex codes`,
    AI_COUNTS.palette,
  ),
  decor: textList(`${rangeText(AI_COUNTS.decor)} décor ideas`, AI_COUNTS.decor),
  food: textList(`${rangeText(AI_COUNTS.food)} food and drink ideas`, AI_COUNTS.food),
  music: textField("Music and entertainment direction"),
  signatureMoment: textField("One memorable signature moment"),
});

const budgetWeight = closedObject({
  category: enumField(BUDGET_CATEGORIES),
  weight: integerField(
    `Relative priority ${AI_RANGES.weight.min}-${AI_RANGES.weight.max}. Not rupees, not a percentage.`,
    AI_RANGES.weight,
  ),
  rationale: textField(
    `Why this category matters for this event, at most ${AI_TEXT_MAX.rationale} characters`,
  ),
});

const task = closedObject({
  id: textField("Unique kebab-case id, lowercase letters, digits and hyphens, e.g. book-venue"),
  title: textField(`Task title, at most ${AI_TEXT_MAX.taskTitle} characters`),
  category: enumField(TASK_CATEGORIES),
  leadWeeks: integerField("Weeks before the event to start this task", AI_RANGES.leadWeeks),
  durationDays: integerField("Days the task takes", AI_RANGES.durationDays),
  dependsOn: textList(
    "Ids of other tasks in this list that must finish first",
    AI_COUNTS.dependsOn,
  ),
});

const vendor = closedObject({
  category: enumField(BUDGET_CATEGORIES),
  bookByWeeks: integerField(
    "Book this vendor at least this many weeks before the event",
    AI_RANGES.bookByWeeks,
  ),
  questions: textList(
    `${rangeText(AI_COUNTS.questions)} questions to ask this kind of vendor`,
    AI_COUNTS.questions,
  ),
  redFlags: textList(`${rangeText(AI_COUNTS.redFlags)} red flags to watch for`, AI_COUNTS.redFlags),
});

const tip = closedObject({
  kind: enumField(TIP_KINDS),
  text: textField(`A practical tip, at most ${AI_TEXT_MAX.tip} characters`),
});

/**
 * JSON Schema handed to Gemini as `config.responseJsonSchema`. It mirrors `AiPlanSchema`
 * (the Zod schema stays the authority — every response is re-validated with Zod); both read
 * their limits from `AI_COUNTS`, `AI_TEXT_MAX` and `AI_RANGES`.
 * Only widely supported keywords are used: type, properties, required, items,
 * enum, minItems, maxItems, minimum, maximum, description, additionalProperties.
 */
export const AI_PLAN_JSON_SCHEMA = closedObject({
  summary: textField(
    `One or two sentence overview of the plan, at most ${AI_TEXT_MAX.summary} characters`,
  ),
  ideas: objectList(idea, AI_COUNTS.ideas),
  budgetWeights: objectList(
    budgetWeight,
    AI_COUNTS.budgetWeights,
    "One entry per relevant budget category, each category at most once",
  ),
  tasks: objectList(task, AI_COUNTS.tasks),
  vendors: objectList(
    vendor,
    AI_COUNTS.vendors,
    "Guidance per vendor category, each category at most once",
  ),
  tips: objectList(tip, AI_COUNTS.tips),
});
