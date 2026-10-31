"use client";

import { useEffect, useRef, useState } from "react";

/** The five stages of the plan request, shown while the server works. */
export const STAGES = [
  "Reading the vibe",
  "Drafting concepts",
  "Balancing ₹",
  "Counting back from the date",
  "Listing who to book",
] as const;

const STAGE_INTERVAL_MS = 1800;

type StageStatus = "done" | "in progress" | "waiting";

function statusOf(index: number, current: number): StageStatus {
  if (index < current) return "done";
  return index === current ? "in progress" : "waiting";
}

/** Advances one stage per interval and stops on the last one (it waits for the response). */
function useAdvancingStage(stageCount: number): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStage((current) => Math.min(current + 1, stageCount - 1)),
      STAGE_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [stageCount]);
  return stage;
}

/**
 * Staged progress line. Stages advance on a timer while the single request is in
 * flight and never claim completion: the last stage waits for the real response.
 * The panel takes focus when it appears, because the form the user was in is gone.
 */
export function StagedProgress() {
  const stage = useAdvancingStage(STAGES.length);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => panel.current?.focus(), []);

  return (
    <div
      ref={panel}
      tabIndex={-1}
      aria-label="Planning in progress"
      className="panel p-6 outline-none sm:p-8"
    >
      <p role="status" aria-live="polite" className="h3">
        <span className="accent text-gold">{STAGES[stage]}</span>
        <span aria-hidden="true" className="inline-block w-8 animate-pulse">
          …
        </span>
      </p>
      <ol className="mt-6 grid gap-2 sm:grid-cols-5" aria-label="Planning stages">
        {STAGES.map((label, index) => (
          <StageItem key={label} label={label} status={statusOf(index, stage)} />
        ))}
      </ol>
    </div>
  );
}

function StageItem({ label, status }: { label: string; status: StageStatus }) {
  const reached = status !== "waiting";
  return (
    <li className="flex flex-col gap-2">
      <span
        aria-hidden="true"
        className={`h-1 rounded-full transition-colors duration-500 ${reached ? "bg-gold" : "bg-line"}`}
      />
      <span className={`eyebrow ${reached ? "text-cream" : ""}`}>
        {label}
        <span className="sr-only"> — {status}</span>
      </span>
    </li>
  );
}
