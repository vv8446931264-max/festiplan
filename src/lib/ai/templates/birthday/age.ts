import type { PlanInput } from "@/lib/contracts";
import { briefText } from "../shared";

/** Oldest age the brief parser accepts; larger numbers are treated as noise. */
const MAX_AGE = 110;
/** Up to this age the party is planned as a children's party. */
const KIDS_MAX_AGE = 12;

/** Reads an age from the title or vibe ("7th birthday", "turning 40", "5 years"). */
export function ageFrom(input: PlanInput): number | null {
  const text = briefText(input);
  const match =
    /\bturning\s+(\d{1,3})\b/.exec(text) ??
    /\b(\d{1,3})(?:st|nd|rd|th)\s+(?:birthday|bday)/.exec(text) ??
    /\b(\d{1,3})\s*(?:years?|yrs?)(?:\s+old)?\b/.exec(text);
  if (!match) return null;
  const age = Number(match[1]);
  return age >= 1 && age <= MAX_AGE ? age : null;
}

/** True when the party is for a child (age ≤ 12, or the brief clearly says so). */
export function isKidsParty(input: PlanInput): boolean {
  const age = ageFrom(input);
  if (age !== null) return age <= KIDS_MAX_AGE;
  return /\b(kids?|child|children|son|daughter|toddler|school friends)\b/.test(briefText(input));
}

/** "1st", "2nd", "3rd", "11th", "21st" … */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
