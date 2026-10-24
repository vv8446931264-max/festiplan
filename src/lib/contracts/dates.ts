import { LIMITS as L } from "./constants";

/**
 * Checks that an ISO event date lies between tomorrow and `maxYearsAhead` years
 * from `today` (both ISO dates). Returns a plain-language error or null.
 */
export function checkEventDate(eventDate: string, today: string): string | null {
  const event = Date.parse(`${eventDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(event) || new Date(event).toISOString().slice(0, 10) !== eventDate) {
    return "That date doesn't exist — pick one from the calendar.";
  }
  if (event <= now) return "Pick a date from tomorrow onwards.";
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() + L.maxYearsAhead);
  if (event > limit.getTime()) return `Pick a date within ${L.maxYearsAhead} years.`;
  return null;
}
