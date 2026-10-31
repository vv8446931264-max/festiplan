import type { ScheduledTask } from "@/lib/contracts";
import { addDays } from "./dates";
import { formatDate } from "./format";
import { toBasicDate } from "./shared";

const CRLF = "\r\n";
/** RFC 5545 §3.1: content lines are folded so none exceeds 75 octets. */
const MAX_LINE_OCTETS = 75;
const UTF8 = new TextEncoder();

/**
 * Escapes text for an iCalendar TEXT value: backslash, semicolon and comma are
 * backslash-escaped and line breaks become a literal `\n`.
 * @param text Raw text.
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line per RFC 5545: no line longer than 75 octets (UTF-8 bytes,
 * continuation space included), continuation lines start with one space, and a multi-byte
 * character is never split.
 * @param line One unfolded content line (no line break).
 * @returns The line with `CRLF + space` inserted at each fold.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let usedOctets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const size = UTF8.encode(char).length;
    if (usedOctets + size > limit) {
      parts.push(current);
      current = "";
      usedOctets = 0;
      limit = MAX_LINE_OCTETS - 1; // the leading continuation space counts too
    }
    current += char;
    usedOctets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** What `buildIcs` needs. `dtstamp` is pre-formatted, e.g. `20261024T000000Z`. */
export type IcsInput = {
  planId: string;
  title: string;
  eventDate: string;
  city: string;
  tasks: ScheduledTask[];
  url: string;
  dtstamp: string;
};

/** One all-day VEVENT: identity, its date and any extra content lines. */
type AllDayEvent = { uid: string; dtstamp: string; date: string; lines: string[] };

/** Removes line breaks from values that must stay on one content line (ids, stamps, URLs). */
const stripLineBreaks = (value: string): string => value.replace(/[\r\n]+/g, "");

function allDayEvent(event: AllDayEvent): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${stripLineBreaks(event.uid)}`,
    `DTSTAMP:${stripLineBreaks(event.dtstamp)}`,
    `DTSTART;VALUE=DATE:${toBasicDate(event.date)}`,
    `DTEND;VALUE=DATE:${toBasicDate(addDays(event.date, 1))}`,
    ...event.lines,
    "END:VEVENT",
  ];
}

function taskEvent(input: IcsInput, task: ScheduledTask): string[] {
  const description = `Start: ${formatDate(task.start)}\n${input.url}`;
  return allDayEvent({
    uid: `${input.planId}-${task.id}@festiplan`,
    dtstamp: input.dtstamp,
    date: task.due,
    lines: [`SUMMARY:${escapeIcsText(task.title)}`, `DESCRIPTION:${escapeIcsText(description)}`],
  });
}

/**
 * Builds an RFC 5545 calendar: one all-day event for the celebration itself and one
 * all-day event per task on its due date. Lines are folded and CRLF-terminated.
 * @param input Plan id, title, event date, city, tasks, share URL and a formatted DTSTAMP.
 * @returns The `.ics` file contents.
 */
export function buildIcs(input: IcsInput): string {
  const celebration = allDayEvent({
    uid: `${input.planId}@festiplan`,
    dtstamp: input.dtstamp,
    date: input.eventDate,
    lines: [
      `SUMMARY:${escapeIcsText(input.title)}`,
      `LOCATION:${escapeIcsText(input.city)}`,
      `URL:${stripLineBreaks(input.url)}`,
    ],
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FestiPlan//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.title)}`,
    ...celebration,
    ...input.tasks.flatMap((task) => taskEvent(input, task)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
