"use client";

import { useEffect, useRef } from "react";
import { useToday } from "@/lib/client/browser";
import type { PublicPlan } from "@/lib/contracts";
import { diffDays, formatDate, formatINR, planTitle } from "@/lib/engine";
import { aiLang } from "./SectionHead";
import type { SaveState } from "./usePlanState";

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "All changes saved",
  retrying: "Couldn't save yet — retrying in a moment. Your changes are kept in this tab.",
  rejected: "That change couldn't be saved. Refresh the page to see the latest plan.",
  forbidden: "This link can't save changes. Ask the organiser for the edit link.",
};

type Props = {
  plan: PublicPlan;
  saveState: SaveState;
  editable: boolean;
  autoFocus?: boolean;
  /** h1 on the standalone share page, h2 when the plan unfolds inside the landing page. */
  titleAs?: "h1" | "h2";
};

/** Human countdown for whole days until the event (negative once it has passed). */
export function countdownLabel(days: number): string {
  if (days > 1) return `${days} days`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return "Celebrated";
}

/** Title, the brief's key facts, the AI-source label and the summary. */
export function PlanHeader({ plan, saveState, editable, autoFocus, titleAs: Title = "h2" }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { input } = plan;
  const today = useToday() || plan.today;
  const lang = aiLang(plan);

  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "start" });
  }, [autoFocus]);

  return (
    <header className="legible flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">Plan Nº {plan.id.slice(0, 6).toUpperCase()}</span>
        <SourceBadge source={plan.source} model={plan.model} />
        {!editable && <span className="eyebrow rounded-full border border-line px-3 py-1">Read-only</span>}
      </div>
      <Title ref={ref} id="plan-title" tabIndex={-1} className="h2 scroll-mt-24 outline-none">
        {planTitle(input)}
      </Title>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        <Fact term="When" value={formatDate(input.eventDate)} />
        <Fact term="Where" value={input.city} />
        <Fact term="Guests" value={String(input.guests)} />
        <Fact term="Budget" value={formatINR(input.budgetINR)} />
        <Fact term="Countdown" value={countdownLabel(diffDays(today, input.eventDate))} />
      </dl>
      <p lang={lang} className="lead max-w-4xl text-cream">
        {plan.ai.summary}
      </p>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-muted">
        {SAVE_TEXT[saveState]}
      </p>
    </header>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="eyebrow">{term}</dt>
      <dd className="tabular mt-1 text-lg font-bold sm:text-xl">{value}</dd>
    </div>
  );
}

/** Honest label for where the ideas came from. */
export function SourceBadge({ source, model }: { source: PublicPlan["source"]; model: string }) {
  if (source === "template") {
    return (
      <span className="eyebrow rounded-full border border-gold px-3 py-1 text-gold">
        Template plan — AI unavailable
      </span>
    );
  }
  return (
    <span className="eyebrow rounded-full border border-line px-3 py-1">
      Ideas by Gemini · {model}
    </span>
  );
}
