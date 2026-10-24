"use client";

import { useEffect, useState } from "react";

/** The five stages of the plan request, shown while the server works. */
export const STAGES = [
  "Reading the vibe",
  "Drafting concepts",
  "Balancing ₹",
  "Counting back from the date",
  "Finding vendors",
] as const;

const STEP_MS = 1800;

/**
 * Staged progress line. Stages advance on a timer while the single request is in
 * flight and never claim completion: the last stage waits for the real response.
 */
export function StagedProgress({ city }: { city: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const label = stage === STAGES.length - 1 && city ? `Finding vendors in ${city}` : STAGES[stage];

  return (
    <div className="panel p-6 sm:p-8">
      <p role="status" aria-live="polite" className="h3">
        <span className="accent text-gold">{label}</span>
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
