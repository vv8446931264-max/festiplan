"use client";

import { memo } from "react";
import { CATEGORY_LABELS, PHASE_LABELS } from "@/lib/contracts/constants";
import type { PublicPlan, ScheduledTask } from "@/lib/contracts";
import { formatDate, googleCalendarUrl, groupByPhase, nextActions, planTitle, progress } from "@/lib/engine";
import { SectionHead } from "./SectionHead";

type Props = {
  planId: string;
  input: PublicPlan["input"];
  timeline: ScheduledTask[];
  editable: boolean;
  lang?: string;
  onToggle: (id: string, done: boolean) => void;
};

/** Timeline chapter: progress, next actions and a horizontal rail of phases. */
export const TimelineSection = memo(function TimelineSection({ planId, input, timeline, editable, lang, onToggle }: Props) {
  return (
    <section id="timeline" aria-labelledby="timeline-title" className="scroll-mt-20">
      <SectionHead id="timeline" number="03" kicker="Timeline"
        title={<>Counting back from <span className="accent">{formatDate(input.eventDate)}</span>.</>}>
        Every date is computed from your event date and each task&apos;s lead time — dependencies first.
      </SectionHead>
      <TimelineSummary planId={planId} timeline={timeline} lang={lang} />
      <div role="region" aria-label="Timeline by phase" tabIndex={0}
        className="-mx-[var(--pad)] mt-6 flex snap-x snap-mandatory scroll-px-[var(--pad)] gap-4 overflow-x-auto px-[var(--pad)] pb-4">
        {groupByPhase(timeline).map(({ phase, tasks }) => (
          <section key={phase} aria-labelledby={`phase-${phase}`} className="panel w-[min(85vw,380px)] shrink-0 snap-start p-5">
            <h4 id={`phase-${phase}`} className="eyebrow mb-4 text-cream">{PHASE_LABELS[phase]}</h4>
            <ol className="flex flex-col gap-3">
              {tasks.map((t) => (
                <TaskItem key={t.id} task={t} input={input} editable={editable} lang={lang} onToggle={onToggle} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
});

function TimelineSummary({ planId, timeline, lang }: { planId: string; timeline: ScheduledTask[]; lang?: string }) {
  const stats = progress(timeline);
  const next = nextActions(timeline, 3);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
      <div className="panel flex flex-col gap-3 p-6">
        <p className="eyebrow">Progress</p>
        <p className="h3 tabular">{stats.done} of {stats.total} done</p>
        <progress max={stats.total} value={stats.done} aria-label="Tasks done" className="meter" />
        <a href={`/plan/${planId}/calendar.ics`} className="btn btn-ghost no-print mt-2 self-start text-sm" download>
          Download all dates (.ics)
        </a>
      </div>
      <div className="panel p-6">
        <p className="eyebrow mb-3">Next up</p>
        {next.length === 0 ? <p>Everything is ticked off. Go enjoy it.</p> : (
          <ol lang={lang} className="flex flex-col gap-2">
            {next.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="tabular font-mono text-sm text-gold">{formatDate(t.due)}</span>
                <span className="font-semibold">{t.title}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

type ItemProps = { task: ScheduledTask; input: PublicPlan["input"]; editable: boolean; lang?: string; onToggle: Props["onToggle"] };

function TaskItem({ task: t, input, editable, lang, onToggle }: ItemProps) {
  const calendar = googleCalendarUrl({
    title: `${t.title} — ${planTitle(input)}`,
    date: t.due,
    details: `Start ${formatDate(t.start)}. Event on ${formatDate(input.eventDate)}.`,
    location: input.city,
  });
  const id = `task-${t.id}`;
  return (
    <li className={`rounded-2xl border p-3 ${t.done ? "border-gold/50 bg-espresso/60" : "border-line/60"}`}>
      <div className="flex items-start gap-3">
        {editable ? (
          <input id={id} type="checkbox" checked={t.done} onChange={(e) => onToggle(t.id, e.target.checked)} className="mt-0.5 size-6 shrink-0" />
        ) : (
          <span aria-hidden="true" className="mt-0.5 text-gold">{t.done ? "✓" : "○"}</span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={editable ? id : undefined} className={`font-semibold ${t.done ? "text-muted line-through decoration-gold" : ""}`}>
            <span lang={lang}>{t.title}</span>
            {!editable && <>{" "}<span className="sr-only">{t.done ? "(done)" : "(not done)"}</span></>}
          </label>
          <span className="tabular text-sm text-muted">
            {CATEGORY_LABELS[t.category]} · {formatDate(t.start)} → {formatDate(t.due)}
          </span>
          <span className="flex flex-wrap gap-2">
            {t.overdue && <Badge tone="ember">Overdue</Badge>}
            {t.crunch && !t.overdue && <Badge tone="gold">Crunch — start now</Badge>}
          </span>
          <a href={calendar} target="_blank" rel="noopener noreferrer" className="no-print inline-flex min-h-8 items-center self-start text-sm">
            Add to Google Calendar<span className="sr-only">{`: ${t.title} (opens in a new tab)`}</span>
          </a>
        </div>
      </div>
    </li>
  );
}

function Badge({ tone, children }: { tone: "ember" | "gold"; children: React.ReactNode }) {
  const cls = tone === "ember" ? "border-ember-bright text-ember-bright" : "border-gold text-gold";
  return <span className={`eyebrow rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}
