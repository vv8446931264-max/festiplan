"use client";

import { useEffect, useRef } from "react";
import { EVENT_TYPE_LABELS } from "@/lib/contracts/constants";
import type { PublicPlan } from "@/lib/contracts";
import { diffDays, formatDate, formatINR } from "@/lib/engine";
import { aiLang } from "./SectionHead";
import type { SaveState } from "./usePlanState";

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Couldn't save — your changes are still here. We'll retry on the next change.",
  forbidden: "This link can't save changes. Ask the organiser for the edit link.",
};

type Props = { plan: PublicPlan; saveState: SaveState; editable: boolean; autoFocus?: boolean };

/** Title, the brief's key facts, the AI-source label and the summary. */
export function PlanHeader({ plan, saveState, editable, autoFocus }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { input } = plan;
  const title = input.title || `${EVENT_TYPE_LABELS[input.eventType]} in ${input.city}`;
  const daysToGo = diffDays(plan.today, input.eventDate);
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
      <h2 ref={ref} id="plan-title" tabIndex={-1} className="h2 scroll-mt-24 outline-none">
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        <Fact term="When" value={formatDate(input.eventDate)} />
        <Fact term="Where" value={input.city} />
        <Fact term="Guests" value={String(input.guests)} />
        <Fact term="Budget" value={formatINR(input.budgetINR)} />
        <Fact term="Countdown" value={daysToGo === 1 ? "Tomorrow" : `${daysToGo} days`} />
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
