"use client";

import { useState, type ReactNode } from "react";
import { PHASE_LABELS } from "@/lib/contracts/constants";
import type { Phase, PublicPlan, ScheduledTask } from "@/lib/contracts";
import { formatDateShort, groupByPhase, progress } from "@/lib/engine";
import { TaskRow } from "./TaskRow";

type Props = {
  timeline: ScheduledTask[];
  input: PublicPlan["input"];
  editable: boolean;
  lang?: string;
  onToggle: (id: string, done: boolean) => void;
};

/** One collapsible group per phase; only the phase holding the next open task starts unfolded. */
export function PhaseList({ timeline, input, editable, lang, onToggle }: Props) {
  const phases = groupByPhase(timeline);
  // Chosen once, on first render; afterwards the reader decides what stays open.
  const [openPhase] = useState<Phase | undefined>(
    () => phases.find((group) => group.tasks.some((task) => !task.done))?.phase,
  );
  return (
    <div className="mt-6 flex flex-col gap-3">
      {phases.map(({ phase, tasks }) => (
        <PhaseGroup key={phase} phase={phase} tasks={tasks} open={phase === openPhase}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              input={input}
              editable={editable}
              lang={lang}
              onToggle={onToggle}
            />
          ))}
        </PhaseGroup>
      ))}
    </div>
  );
}

type GroupProps = { phase: Phase; tasks: ScheduledTask[]; open: boolean; children: ReactNode };

/** A native disclosure: phase name, how many are done and the dates it spans. */
function PhaseGroup({ phase, tasks, open, children }: GroupProps) {
  const stats = progress(tasks);
  const first = tasks.at(0);
  const last = tasks.at(-1);
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
