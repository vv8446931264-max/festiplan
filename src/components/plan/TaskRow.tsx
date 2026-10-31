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
export function TaskRow({ task, input, editable, lang, onToggle }: Props) {
  const checkboxId = editable ? `task-${task.id}` : undefined;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      {checkboxId ? (
        <input
          id={checkboxId}
          type="checkbox"
          checked={task.done}
          onChange={(event) => onToggle(task.id, event.target.checked)}
          className="mt-0.5 size-6"
        />
      ) : (
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex size-6 items-center justify-center text-gold"
        >
          {task.done ? "✓" : "○"}
        </span>
      )}
      <div className="min-w-0">
        <TaskTitle task={task} lang={lang} checkboxId={checkboxId} />
        <TaskMeta task={task} />
      </div>
      <CalendarLink task={task} input={input} />
    </li>
  );
}

type TitleProps = { task: ScheduledTask; lang?: string; checkboxId?: string };

/** Labels the owner's checkbox; without one (read-only), it states the status in words. */
function TaskTitle({ task, lang, checkboxId }: TitleProps) {
  return (
    <label
      htmlFor={checkboxId}
      className={`leading-snug font-semibold ${task.done ? "text-muted line-through decoration-gold" : ""}`}
    >
      <span lang={lang}>{task.title}</span>
      {checkboxId === undefined && (
        <>
          {" "}
          <span className="sr-only">{task.done ? "(done)" : "(not done)"}</span>
        </>
      )}
    </label>
  );
}

/** Category, start → due dates, and an overdue flag. */
function TaskMeta({ task }: { task: ScheduledTask }) {
  return (
    <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
      <span>{CATEGORY_LABELS[task.category]}</span>
      <span aria-hidden="true">·</span>
      <span>
        {formatDateShort(task.start)} → {formatDateShort(task.due)}
      </span>
      {task.overdue && (
        <span className="eyebrow rounded-full border border-ember-bright px-2 text-ember-bright">
          Overdue
        </span>
      )}
    </p>
  );
}

/** Opens Google Calendar with this task prefilled on its due date. */
function CalendarLink({ task, input }: { task: ScheduledTask; input: PublicPlan["input"] }) {
  const href = googleCalendarUrl({
    title: `${task.title} — ${planTitle(input)}`,
    date: task.due,
    details: `Start ${formatDate(task.start)}. Event on ${formatDate(input.eventDate)}.`,
    location: input.city,
  });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Add “${task.title}” to Google Calendar (opens in a new tab)`}
      className="no-print inline-flex size-11 items-center justify-center rounded-full border border-line text-cream no-underline hover:border-cream"
    >
      <CalendarIcon />
    </a>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" strokeLinecap="round" />
    </svg>
  );
}
