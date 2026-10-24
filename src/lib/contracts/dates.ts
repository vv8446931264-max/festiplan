import { LIMITS as L } from "./constants";

/** The latest allowed event date: `maxYearsAhead` calendar years after `today` (ISO). */
export function maxEventDate(today: string): string {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCFullYear(limit.getUTCFullYear() + L.maxYearsAhead);
  return limit.toISOString().slice(0, 10);
}

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
  if (eventDate > maxEventDate(today)) return `Pick a date within ${L.maxYearsAhead} years.`;
  return null;
}
