"use client";

import { memo, useMemo } from "react";
import type { AiTask, PublicPlan, ScheduledTask } from "@/lib/contracts";
import { formatDate, scheduleCompression, type ScheduleCompression } from "@/lib/engine";
import { PhaseList } from "./PhaseList";
import { SectionHead } from "./SectionHead";
import { TimelineSummary } from "./TimelineSummary";

const DAYS_PER_WEEK = 7;

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
  const compression = useMemo(
    () => scheduleCompression(aiTasks, input.eventDate, today),
    [aiTasks, input.eventDate, today],
  );
  return (
    <section id="timeline" aria-labelledby="timeline-title">
      <TimelineHead eventDate={input.eventDate} />
      {compression.compressed && <CompressionNote compression={compression} />}
      <TimelineSummary planId={planId} timeline={timeline} lang={lang} />
      <PhaseList
        timeline={timeline}
        input={input}
        editable={editable}
        lang={lang}
        onToggle={onToggle}
      />
    </section>
  );
});

function TimelineHead({ eventDate }: { eventDate: string }) {
  return (
    <SectionHead
      id="timeline"
      number="03"
      kicker="Timeline"
      title={
        <>
          Counting back from <span className="accent">{formatDate(eventDate)}</span>.
        </>
      }
    >
      Every date is computed from your event date and each task&apos;s lead time — dependencies
      first.
    </SectionHead>
  );
}

/** One plain explanation when the ideal lead times do not fit the days left. */
function CompressionNote({ compression }: { compression: ScheduleCompression }) {
  const { availableDays, idealDays } = compression;
  return (
    <p role="note" className="mb-6 rounded-2xl border border-gold px-5 py-4">
      <strong className="text-gold">Short on time, not on order.</strong> You have {availableDays}{" "}
      {availableDays === 1 ? "day" : "days"}; this plan ideally starts{" "}
      {Math.round(idealDays / DAYS_PER_WEEK)} weeks out, so every step is compressed proportionally
      and keeps its sequence.
    </p>
  );
}
