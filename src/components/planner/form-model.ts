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

export type FieldName = Exclude<keyof FormValues, "constraints" | "language">;
export type FieldErrors = Partial<Record<FieldName, string>>;

/** Order used by the error summary, matching the visual order of the form. */
export const FIELD_ORDER: FieldName[] = [
  "eventType",
  "eventDate",
  "city",
  "guests",
  "budget",
  "title",
  "vibe",
];

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

const inr = new Intl.NumberFormat("en-IN");

/** Parses "12,00,000" or "1200000" into an integer, or NaN. */
export function parseWhole(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function numberError(n: number, min: number, max: number, what: string): string | null {
  if (Number.isNaN(n)) return `Enter ${what} as a whole number.`;
  if (n < min || n > max) return `Enter ${what} between ${inr.format(min)} and ${inr.format(max)}.`;
  return null;
}

/** Field-by-field validation with plain-language messages. */
export function validateForm(v: FormValues, today: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!v.eventType) errors.eventType = "Choose what you're celebrating.";
  errors.eventDate = v.eventDate ? (checkEventDate(v.eventDate, today) ?? undefined) : "Choose the date of the event.";
  const city = v.city.trim();
  if (city.length < LIMITS.cityMin || city.length > LIMITS.cityMax) errors.city = "Enter the city where it's happening.";
  errors.guests = numberError(parseWhole(v.guests), LIMITS.guestsMin, LIMITS.guestsMax, "the number of guests") ?? undefined;
  errors.budget = numberError(parseWhole(v.budget), LIMITS.budgetMin, LIMITS.budgetMax, "a budget in rupees") ?? undefined;
  if (v.title.trim().length > LIMITS.titleMax) errors.title = `Keep the name under ${LIMITS.titleMax} characters.`;
  if (v.vibe.trim().length > LIMITS.vibeMax) errors.vibe = `Keep the description under ${LIMITS.vibeMax} characters.`;
  for (const key of FIELD_ORDER) if (errors[key] === undefined) delete errors[key];
  return errors;
}

/** Converts validated form values into the API request body. */
export function toPlanInput(v: FormValues): PlanInput {
  const title = v.title.trim();
  return {
    eventType: v.eventType || "other",
    ...(title ? { title } : {}),
    eventDate: v.eventDate,
    city: v.city.trim(),
    guests: parseWhole(v.guests),
    budgetINR: parseWhole(v.budget),
    vibe: v.vibe.trim(),
    constraints: v.constraints,
    language: v.language,
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
    budget: inr.format(input.budgetINR),
    vibe: input.vibe,
    constraints: [...input.constraints],
    language: input.language,
  };
}

/** Maps server-side Zod issue paths onto form fields. */
export function issuesToErrors(issues: { path: string; message: string }[]): FieldErrors {
  const map: Record<string, FieldName> = { budgetINR: "budget" };
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const head = issue.path.split(".")[0] ?? "";
    const field = (map[head] ?? head) as FieldName;
    if (FIELD_ORDER.includes(field) && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
