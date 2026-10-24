"use client";

import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { PublicPlan, ScheduledTask } from "@/lib/contracts";
import { formatDate, formatDateShort, googleCalendarUrl, planTitle } from "@/lib/engine";

type Props = {
  task: ScheduledTask;
  input: PublicPlan["input"];
  editable: boolean;
  lang?: string;
  onToggle: (id: string, done: boolean) => void;
};

/** One compact timeline row: tick box, title, category and dates, calendar button. */
export function TaskRow({ task: t, input, editable, lang, onToggle }: Props) {
  const id = `task-${t.id}`;
  const calendar = googleCalendarUrl({
    title: `${t.title} — ${planTitle(input)}`,
    date: t.due,
    details: `Start ${formatDate(t.start)}. Event on ${formatDate(input.eventDate)}.`,
    location: input.city,
  });
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      {editable ? (
        <input id={id} type="checkbox" checked={t.done} onChange={(e) => onToggle(t.id, e.target.checked)} className="mt-0.5 size-6" />
      ) : (
        <span aria-hidden="true" className="mt-0.5 inline-flex size-6 items-center justify-center text-gold">{t.done ? "✓" : "○"}</span>
      )}
      <div className="min-w-0">
        <label htmlFor={editable ? id : undefined}
          className={`font-semibold leading-snug ${t.done ? "text-muted line-through decoration-gold" : ""}`}>
          <span lang={lang}>{t.title}</span>
          {!editable && <>{" "}<span className="sr-only">{t.done ? "(done)" : "(not done)"}</span></>}
        </label>
        <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{CATEGORY_LABELS[t.category]}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDateShort(t.start)} → {formatDateShort(t.due)}</span>
          {t.overdue && <span className="eyebrow rounded-full border border-ember-bright px-2 text-ember-bright">Overdue</span>}
        </p>
      </div>
      <a href={calendar} target="_blank" rel="noopener noreferrer"
        aria-label={`Add “${t.title}” to Google Calendar (opens in a new tab)`}
        className="no-print inline-flex size-11 items-center justify-center rounded-full border border-line text-cream no-underline hover:border-cream">
        <CalendarIcon />
      </a>
    </li>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" strokeLinecap="round" />
    </svg>
  );
}
