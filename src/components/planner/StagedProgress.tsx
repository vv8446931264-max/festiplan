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

const STEP_MS = 1800;

/**
 * Staged progress line. Stages advance on a timer while the single request is in
 * flight and never claim completion: the last stage waits for the real response.
 * The panel takes focus when it appears, because the form the user was in is gone.
 */
export function StagedProgress() {
  const [stage, setStage] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => panel.current?.focus(), []);

  useEffect(() => {
    const id = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div ref={panel} tabIndex={-1} aria-label="Planning in progress" className="panel p-6 outline-none sm:p-8">
      <p role="status" aria-live="polite" className="h3">
        <span className="accent text-gold">{STAGES[stage]}</span>
        <span aria-hidden="true" className="inline-block w-8 animate-pulse">
          …
        </span>
      </p>
      <ol className="mt-6 grid gap-2 sm:grid-cols-5" aria-label="Planning stages">
        {STAGES.map((s, i) => (
          <li key={s} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={`h-1 rounded-full transition-colors duration-500 ${i <= stage ? "bg-gold" : "bg-line"}`}
            />
            <span className={`eyebrow ${i <= stage ? "text-cream" : ""}`}>
              {s}
              <span className="sr-only">{i < stage ? " — done" : i === stage ? " — in progress" : " — waiting"}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
