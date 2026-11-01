"use client";

import { setAnimationPaused, useAnimationPaused } from "./animation-pause";

/**
 * "Pause animation" (WCAG 2.2.2 Pause, Stop, Hide): a toggle button that stops the lantern
 * sky behind every page and shows its static poster instead; pressing it again brings the
 * live scene back. The label never changes — aria-pressed and the filled dot carry the
 * state. Below md only "Pause" is visible; the accessible name is always "Pause animation"
 * (the separating space sits outside the visually hidden span, so no engine trims it away).
 */
export function PauseAnimationToggle() {
  const paused = useAnimationPaused();
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setAnimationPaused(!paused)}
      className="eyebrow no-print inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-full border border-line px-3 text-cream transition-colors hover:border-cream aria-pressed:border-gold aria-pressed:text-gold"
    >
      <span aria-hidden="true">{paused ? "●" : "○"}</span>
      <span>
        Pause <span className="max-md:sr-only">animation</span>
      </span>
    </button>
  );
}
