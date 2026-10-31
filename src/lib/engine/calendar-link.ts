import { addDays } from "./dates";
import { toBasicDate } from "./shared";

/** Fields of an all-day Google Calendar "TEMPLATE" link. Dates are ISO `YYYY-MM-DD`. */
export type CalendarLinkInput = {
  title: string;
  date: string;
  /**
   * Exclusive end date, as Google expects (the day after the last day).
   * Defaults to the day after `date`.
   */
  endDate?: string;
  details?: string;
  location?: string;
};

/**
 * Builds a Google Calendar "add event" URL for an all-day entry.
 * The end of the `dates` range is exclusive: `endDate` when given, else the day after `date`.
 * `details` and `location` are omitted when absent.
 * @param input Title, start date and optional end date, details and location.
 * @returns An https://calendar.google.com/calendar/render URL.
 */
export function googleCalendarUrl(input: CalendarLinkInput): string {
  const end = input.endDate ?? addDays(input.date, 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toBasicDate(input.date)}/${toBasicDate(end)}`,
  });
  if (input.details !== undefined) params.set("details", input.details);
  if (input.location !== undefined) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
