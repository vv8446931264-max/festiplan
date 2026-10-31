import { LIMITS } from "@/lib/contracts/constants";
import { checkEventDate } from "@/lib/contracts/dates";
import type { EventType, Lang, PlanInput } from "@/lib/contracts";

/** Raw values held by the brief form (inputs are strings until validated). */
export type FormValues = {
  eventType: EventType | "";
  title: string;
  eventDate: string;
  city: string;
  guests: string;
  budget: string;
  vibe: string;
  constraints: string[];
  language: Lang;
};

/** Fields that can be invalid; constraints and language always hold an allowed value. */
export type FieldName = Exclude<keyof FormValues, "constraints" | "language">;

/** At most one plain-language message per invalid field. */
export type FieldErrors = Partial<Record<FieldName, string>>;

/** A validation issue as the API reports it (`path` is dot-separated). */
export type ServerIssue = { path: string; message: string };

/** Order used by the error summary, matching the visual order of the form. */
export const FIELD_ORDER: readonly FieldName[] = [
  "eventType",
  "eventDate",
  "city",
  "guests",
  "budget",
  "title",
  "vibe",
];

/** The blank brief the form starts from. */
export const EMPTY_FORM: FormValues = {
  eventType: "",
  title: "",
  eventDate: "",
  city: "",
  guests: "",
  budget: "",
  vibe: "",
  constraints: [],
  language: "en",
};

/** Indian digit grouping (12,00,000) for the budget field and range messages. */
const indianGrouping = new Intl.NumberFormat("en-IN");

/** API issue paths whose name differs from the form field they belong to. */
const ISSUE_PATH_ALIASES: Partial<Record<string, FieldName>> = { budgetINR: "budget" };

/** Parses "12,00,000" or "1200000" into an integer, or NaN. */
export function parseWhole(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function isFieldName(name: string): name is FieldName {
  return FIELD_ORDER.some((field) => field === name);
}

function rangeError(value: number, min: number, max: number, subject: string): string | null {
  if (Number.isNaN(value)) return `Enter ${subject} as a whole number.`;
  if (value >= min && value <= max) return null;
  return `Enter ${subject} between ${indianGrouping.format(min)} and ${indianGrouping.format(max)}.`;
}

function lengthError(text: string, max: number, subject: string): string | null {
  return text.trim().length > max ? `Keep the ${subject} under ${max} characters.` : null;
}

function cityError(city: string): string | null {
  const length = city.trim().length;
  const valid = length >= LIMITS.cityMin && length <= LIMITS.cityMax;
  return valid ? null : "Enter the city where it's happening.";
}

/** Field-by-field validation with plain-language messages, in {@link FIELD_ORDER}. */
export function validateForm(values: FormValues, today: string): FieldErrors {
  const { guestsMin, guestsMax, budgetMin, budgetMax } = LIMITS;
  const messages: Record<FieldName, string | null> = {
    eventType: values.eventType ? null : "Choose what you're celebrating.",
    eventDate: values.eventDate
      ? checkEventDate(values.eventDate, today)
      : "Choose the date of the event.",
    city: cityError(values.city),
    guests: rangeError(parseWhole(values.guests), guestsMin, guestsMax, "the number of guests"),
    budget: rangeError(parseWhole(values.budget), budgetMin, budgetMax, "a budget in rupees"),
    title: lengthError(values.title, LIMITS.titleMax, "name"),
    vibe: lengthError(values.vibe, LIMITS.vibeMax, "description"),
  };
  const errors: FieldErrors = {};
  for (const field of FIELD_ORDER) {
    const message = messages[field];
    if (message !== null) errors[field] = message;
  }
  return errors;
}

/** Converts validated form values into the API request body. */
export function toPlanInput(values: FormValues): PlanInput {
  const title = values.title.trim();
  return {
    eventType: values.eventType || "other",
    ...(title ? { title } : {}),
    eventDate: values.eventDate,
    city: values.city.trim(),
    guests: parseWhole(values.guests),
    budgetINR: parseWhole(values.budget),
    vibe: values.vibe.trim(),
    constraints: values.constraints,
    language: values.language,
  };
}

/** Converts a PlanInput (e.g. a preset) back into form values. */
export function fromPlanInput(input: PlanInput): FormValues {
  return {
    eventType: input.eventType,
    title: input.title ?? "",
    eventDate: input.eventDate,
    city: input.city,
    guests: String(input.guests),
    budget: indianGrouping.format(input.budgetINR),
    vibe: input.vibe,
    constraints: [...input.constraints],
    language: input.language,
  };
}

/** Selects `tag` when it is not selected yet, otherwise deselects it. */
export function toggleConstraint(selected: readonly string[], tag: string): string[] {
  return selected.includes(tag) ? selected.filter((other) => other !== tag) : [...selected, tag];
}

/** Maps API issue paths onto form fields; the first message for a field wins. */
export function issuesToErrors(issues: readonly ServerIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const [head = ""] = issue.path.split(".");
    const name = ISSUE_PATH_ALIASES[head] ?? head;
    if (isFieldName(name)) errors[name] ??= issue.message;
  }
  return errors;
}
