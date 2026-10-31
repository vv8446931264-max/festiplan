"use client";

import { memo, useMemo, useState } from "react";
import { PHASE_LABELS } from "@/lib/contracts/constants";
import type { AiTask, Phase, PublicPlan, ScheduledTask } from "@/lib/contracts";
import {
  formatDate,
  formatDateShort,
  groupByPhase,
  nextActions,
  progress,
  scheduleCompression,
} from "@/lib/engine";
import { SectionHead } from "./SectionHead";
import { TaskRow } from "./TaskRow";

/** How much the schedule had to be squeezed to fit the time left (from the engine). */
export type Compression = { compressed: boolean; availableDays: number; idealDays: number };

type Props = {
  planId: string;
  input: PublicPlan["input"];
  timeline: ScheduledTask[];
  /** The model's task list and the day the plan was scheduled, to explain any compression. */
  aiTasks: AiTask[];
  today: string;
  editable: boolean;
  lang?: string;
  onToggle: (id: string, done: boolean) => void;
};

/** Timeline chapter: progress, next actions and one collapsible group per phase. */
export const TimelineSection = memo(function TimelineSection(props: Props) {
  const { planId, input, timeline, aiTasks, today, editable, lang, onToggle } = props;
  const phases = groupByPhase(timeline);
  const compression = useMemo(
    () => scheduleCompression(aiTasks, input.eventDate, today),
    [aiTasks, input.eventDate, today],
  );
  // Open the phase holding the next undone task once; afterwards the reader decides.
  const [openPhase] = useState<Phase | undefined>(
    () => phases.find((p) => p.tasks.some((t) => !t.done))?.phase,
  );
  return (
    <section id="timeline" aria-labelledby="timeline-title">
      <SectionHead
        id="timeline"
        number="03"
        kicker="Timeline"
        title={
          <>
            Counting back from <span className="accent">{formatDate(input.eventDate)}</span>.
          </>
        }
      >
        Every date is computed from your event date and each task&apos;s lead time — dependencies
        first.
      </SectionHead>
      {compression.compressed && <CompressionNote compression={compression} />}
      <TimelineSummary planId={planId} timeline={timeline} lang={lang} />
      <div className="mt-6 flex flex-col gap-3">
        {phases.map(({ phase, tasks }) => (
          <PhaseGroup key={phase} phase={phase} tasks={tasks} open={phase === openPhase}>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                input={input}
                editable={editable}
                lang={lang}
                onToggle={onToggle}
              />
            ))}
          </PhaseGroup>
        ))}
      </div>
    </section>
  );
});

function CompressionNote({ compression }: { compression: Compression }) {
  const ideal = Math.round(compression.idealDays / 7);
  return (
    <p role="note" className="mb-6 rounded-2xl border border-gold px-5 py-4">
      <strong className="text-gold">Short on time, not on order.</strong> You have{" "}
      {compression.availableDays} {compression.availableDays === 1 ? "day" : "days"}; this plan
      ideally starts {ideal} weeks out, so every step is compressed proportionally and keeps its
      sequence.
    </p>
  );
}

type GroupProps = {
  phase: Phase;
  tasks: ScheduledTask[];
  open: boolean;
  children: React.ReactNode;
};

function PhaseGroup({ phase, tasks, open, children }: GroupProps) {
  const stats = progress(tasks);
  const first = tasks[0];
  const last = tasks[tasks.length - 1];
  return (
    <details open={open} className="panel group overflow-hidden">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="text-gold transition-transform group-open:rotate-90">
            ▸
          </span>
          <span className="font-bold">{PHASE_LABELS[phase]}</span>
        </span>
        <span className="tabular text-right text-sm text-muted">
          {stats.done}/{stats.total} done
          {first && last && (
            <span className="hidden sm:inline">
              {" "}
              · {formatDateShort(first.start)} – {formatDateShort(last.due)}
            </span>
          )}
        </span>
      </summary>
      <ol className="divide-y divide-line/50 border-t border-line/60">{children}</ol>
    </details>
  );
}

function TimelineSummary({
  planId,
  timeline,
  lang,
}: {
  planId: string;
  timeline: ScheduledTask[];
  lang?: string;
}) {
  const stats = progress(timeline);
  const next = nextActions(timeline, 3);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
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
      <div className="panel p-6">
        <p className="eyebrow mb-3">Next up</p>
        {next.length === 0 ? (
          <p>Everything is ticked off. Go enjoy it.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {next.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="tabular font-mono text-sm text-gold">{formatDate(t.due)}</span>
                <span lang={lang} className="font-semibold">
                  {t.title}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
