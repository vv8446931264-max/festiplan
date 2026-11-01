import type { PlanInput } from "@/lib/contracts";
import { briefText } from "@/lib/ai/templates/shared";

/** Festivals a community brief may name, in matching priority. */
const FESTIVALS = [
  "diwali",
  "holi",
  "ganesh",
  "navratri",
  "durga puja",
  "onam",
  "pongal",
  "eid",
  "christmas",
  "lohri",
  "bihu",
  "janmashtami",
];

/** The festival named in the brief, title-cased, or null. */
export function festivalFrom(input: PlanInput): string | null {
  const text = briefText(input);
  const found = FESTIVALS.find((festival) => text.includes(festival));
  return found ? found.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;
}
