import { BUDGET_CATEGORIES, TASK_CATEGORIES, TIP_KINDS } from "@/lib/contracts";

const textField = (description: string) => ({ type: "string", description }) as const;

const textList = (description: string, minItems: number, maxItems: number) =>
  ({ type: "array", description, minItems, maxItems, items: { type: "string" } }) as const;

const integerField = (description: string, minimum: number, maximum: number) =>
  ({ type: "integer", description, minimum, maximum }) as const;

const enumField = (values: readonly string[]) => ({ type: "string", enum: [...values] });

/** An object schema that requires every listed property and allows no others. */
const closedObject = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

const idea = closedObject({
  name: textField("Short evocative concept name, at most 60 characters"),
  concept: textField("Two or three sentences describing the concept, at most 400 characters"),
  palette: textList("3 to 5 colours as #RRGGBB hex codes", 3, 5),
  decor: textList("2 to 6 décor ideas", 2, 6),
  food: textList("2 to 6 food and drink ideas", 2, 6),
  music: textField("Music and entertainment direction"),
  signatureMoment: textField("One memorable signature moment"),
});

const budgetWeight = closedObject({
  category: enumField(BUDGET_CATEGORIES),
  weight: integerField("Relative priority 1-100. Not rupees, not a percentage.", 1, 100),
  rationale: textField("Why this category matters for this event, at most 200 characters"),
});

const task = closedObject({
  id: textField("Unique kebab-case id, lowercase letters, digits and hyphens, e.g. book-venue"),
  title: textField("Task title, at most 100 characters"),
  category: enumField(TASK_CATEGORIES),
  leadWeeks: integerField("Weeks before the event to start this task", 0, 156),
  durationDays: integerField("Days the task takes", 1, 90),
  dependsOn: textList("Ids of other tasks in this list that must finish first", 0, 5),
});

const vendor = closedObject({
  category: enumField(BUDGET_CATEGORIES),
  bookByWeeks: integerField("Book this vendor at least this many weeks before the event", 0, 104),
  questions: textList("2 to 5 questions to ask this kind of vendor", 2, 5),
  redFlags: textList("1 to 4 red flags to watch for", 1, 4),
});

const tip = closedObject({
  kind: enumField(TIP_KINDS),
  text: textField("A practical tip, at most 240 characters"),
});

/**
 * JSON Schema handed to Gemini as `config.responseJsonSchema`. It mirrors `AiPlanSchema`
 * (the Zod schema stays the authority — every response is re-validated with Zod).
 * Only widely supported keywords are used: type, properties, required, items,
 * enum, minItems, maxItems, minimum, maximum, description, additionalProperties.
 */
export const AI_PLAN_JSON_SCHEMA = closedObject({
  summary: textField("One or two sentence overview of the plan, at most 320 characters"),
  ideas: { type: "array", minItems: 3, maxItems: 3, items: idea },
  budgetWeights: {
    type: "array",
    description: "One entry per relevant budget category, each category at most once",
    minItems: 4,
    maxItems: BUDGET_CATEGORIES.length,
    items: budgetWeight,
  },
  tasks: { type: "array", minItems: 12, maxItems: 30, items: task },
  vendors: {
    type: "array",
    description: "Guidance per vendor category, each category at most once",
    minItems: 3,
    maxItems: BUDGET_CATEGORIES.length,
    items: vendor,
  },
  tips: { type: "array", minItems: 2, maxItems: 8, items: tip },
});
