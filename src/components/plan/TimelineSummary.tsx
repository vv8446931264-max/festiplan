"use client";

import type { ScheduledTask } from "@/lib/contracts";
import { formatDate, nextActions, progress } from "@/lib/engine";

/** Shown wherever upcoming tasks are listed once every task is done. */
export const ALL_TASKS_DONE = "Everything is ticked off. Go enjoy it.";

/** How many upcoming tasks the "Next up" panel lists. */
const NEXT_UP_COUNT = 3;

type Props = { planId: string; timeline: ScheduledTask[]; lang?: string };

/** Progress with the calendar export, beside the next few tasks due. */
export function TimelineSummary({ planId, timeline, lang }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
      <ProgressPanel planId={planId} timeline={timeline} />
      <NextUpPanel timeline={timeline} lang={lang} />
    </div>
  );
}

function ProgressPanel({ planId, timeline }: { planId: string; timeline: ScheduledTask[] }) {
  const stats = progress(timeline);
  return (
    <div className="panel flex flex-col gap-3 p-6">
      <p className="eyebrow">Progress</p>
      <p className="h3 tabular">
        {stats.done} of {stats.total} done
      </p>
      <progress max={stats.total} value={stats.done} aria-label="Tasks done" className="meter" />
      <a
        href={`/plan/${planId}/calendar.ics`}
        className="btn btn-ghost no-print mt-2 self-start text-sm"
        download
      >
        Download all dates (.ics)
      </a>
    </div>
  );
}

function NextUpPanel({ timeline, lang }: { timeline: ScheduledTask[]; lang?: string }) {
  const upcoming = nextActions(timeline, NEXT_UP_COUNT);
  return (
    <div className="panel p-6">
      <p className="eyebrow mb-3">Next up</p>
      {upcoming.length === 0 ? (
        <p>{ALL_TASKS_DONE}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {upcoming.map((task) => (
            <li key={task.id} className="flex flex-wrap items-baseline gap-x-3">
              <span className="tabular font-mono text-sm text-gold">{formatDate(task.due)}</span>
              <span lang={lang} className="font-semibold">
                {task.title}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
