import { BUDGET_CATEGORIES, TASK_CATEGORIES, TIP_KINDS } from "@/lib/contracts";

/**
 * JSON Schema handed to Gemini as `responseJsonSchema`. It mirrors `AiPlanSchema`
 * (the Zod schema stays the authority — every response is re-validated with Zod).
 * Only widely supported keywords are used: type, properties, required, items,
 * enum, minItems, maxItems, minimum, maximum, description, additionalProperties.
 */

const str = (description: string) => ({ type: "string", description }) as const;

const strList = (description: string, minItems: number, maxItems: number) =>
  ({ type: "array", description, minItems, maxItems, items: { type: "string" } }) as const;

const int = (description: string, minimum: number, maximum: number) =>
  ({ type: "integer", description, minimum, maximum }) as const;

const obj = (properties: Record<string, object>) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

const idea = obj({
  name: str("Short evocative concept name, at most 60 characters"),
  concept: str("Two or three sentences describing the concept, at most 400 characters"),
  palette: strList("3 to 5 colours as #RRGGBB hex codes", 3, 5),
  decor: strList("2 to 6 décor ideas", 2, 6),
  food: strList("2 to 6 food and drink ideas", 2, 6),
  music: str("Music and entertainment direction"),
  signatureMoment: str("One memorable signature moment"),
});

const budgetWeight = obj({
  category: { type: "string", enum: [...BUDGET_CATEGORIES] },
  weight: int("Relative priority 1-100. Not rupees, not a percentage.", 1, 100),
  rationale: str("Why this category matters for this event, at most 200 characters"),
});

const task = obj({
  id: str("Unique kebab-case id, lowercase letters, digits and hyphens, e.g. book-venue"),
  title: str("Task title, at most 100 characters"),
  category: { type: "string", enum: [...TASK_CATEGORIES] },
  leadWeeks: int("Weeks before the event to start this task", 0, 156),
  durationDays: int("Days the task takes", 1, 90),
  dependsOn: strList("Ids of other tasks in this list that must finish first", 0, 5),
});

const vendor = obj({
  category: { type: "string", enum: [...BUDGET_CATEGORIES] },
  bookByWeeks: int("Book this vendor at least this many weeks before the event", 0, 104),
  questions: strList("2 to 5 questions to ask this kind of vendor", 2, 5),
  redFlags: strList("1 to 4 red flags to watch for", 1, 4),
});

const tip = obj({
  kind: { type: "string", enum: [...TIP_KINDS] },
  text: str("A practical tip, at most 240 characters"),
});

/** The response schema object for `config.responseJsonSchema`. */
export const AI_PLAN_JSON_SCHEMA = obj({
  summary: str("One or two sentence overview of the plan, at most 320 characters"),
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
