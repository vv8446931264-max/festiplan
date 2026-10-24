import type { ScheduledTask } from "@/lib/contracts";
import { addDays } from "./dates";
import { formatDate } from "./format";

const CRLF = "\r\n";
const MAX_OCTETS = 75;
const UTF8 = new TextEncoder();

/**
 * Escapes text for an iCalendar TEXT value: backslash, semicolon and comma are
 * backslash-escaped and line breaks become a literal `\n`.
 * @param s Raw text.
 */
export function escapeIcsText(s: string): string {
  return s
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
  let used = 0;
  let budget = MAX_OCTETS;
  for (const ch of line) {
    const size = UTF8.encode(ch).length;
    if (used + size > budget) {
      parts.push(current);
      current = "";
      used = 0;
      budget = MAX_OCTETS - 1;
    }
    current += ch;
    used += size;
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

const noBreaks = (s: string): string => s.replace(/[\r\n]+/g, "");
const basic = (iso: string): string => iso.replaceAll("-", "");

function allDayEvent(f: { uid: string; dtstamp: string; date: string; lines: string[] }): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${noBreaks(f.uid)}`,
    `DTSTAMP:${noBreaks(f.dtstamp)}`,
    `DTSTART;VALUE=DATE:${basic(f.date)}`,
    `DTEND;VALUE=DATE:${basic(addDays(f.date, 1))}`,
    ...f.lines,
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
  const event = allDayEvent({
    uid: `${input.planId}@festiplan`,
    dtstamp: input.dtstamp,
    date: input.eventDate,
    lines: [
      `SUMMARY:${escapeIcsText(input.title)}`,
      `LOCATION:${escapeIcsText(input.city)}`,
      `URL:${noBreaks(input.url)}`,
    ],
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FestiPlan//Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.title)}`,
    ...event,
    ...input.tasks.flatMap((task) => taskEvent(input, task)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
