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
  stalled:
    "Couldn't save your changes. They're kept in this tab, and saving resumes when you're back online or make another change.",
  rejected: "That change couldn't be saved. Refresh the page to see the latest plan.",
  forbidden: "This link can't save changes. Ask the organiser for the edit link.",
};

/** The short, human-readable plan number is the id's first characters. */
const PLAN_NUMBER_LENGTH = 6;

type Props = {
  plan: PublicPlan;
  saveState: SaveState;
  editable: boolean;
  /** Move focus to the title once mounted, so a just-generated plan is announced. */
  focusOnMount?: boolean;
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
export function PlanHeader({
  plan,
  saveState,
  editable,
  focusOnMount,
  titleAs: Title = "h2",
}: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const today = useToday() || plan.today;
  const lang = aiLang(plan);

  useEffect(() => {
    if (!focusOnMount) return;
    titleRef.current?.focus({ preventScroll: true });
    titleRef.current?.scrollIntoView({ block: "start" });
  }, [focusOnMount]);

  return (
    <header className="legible flex flex-col gap-6">
      <PlanBadges plan={plan} editable={editable} />
      {/* scroll-mt-7 + the 4.25rem scroll padding on <html> (layout.tsx) = the 6rem scroll-mt-24 gave. */}
      <Title ref={titleRef} id="plan-title" tabIndex={-1} className="h2 scroll-mt-7 outline-none">
        {planTitle(plan.input)}
      </Title>
      <PlanFacts input={plan.input} today={today} />
      <p lang={lang} className="lead max-w-4xl text-cream">
        {plan.ai.summary}
      </p>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-muted">
        {SAVE_TEXT[saveState]}
      </p>
    </header>
  );
}

/** Plan number, where the ideas came from, and whether this link can edit. */
function PlanBadges({ plan, editable }: { plan: PublicPlan; editable: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow">Plan Nº {plan.id.slice(0, PLAN_NUMBER_LENGTH).toUpperCase()}</span>
      <SourceBadge source={plan.source} model={plan.model} />
      {!editable && (
        <span className="eyebrow rounded-full border border-line px-3 py-1">Read-only</span>
      )}
    </div>
  );
}

/** The brief at a glance: when, where, how many, how much, and how long until the day. */
function PlanFacts({ input, today }: { input: PublicPlan["input"]; today: string }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
      <Fact term="When" value={formatDate(input.eventDate)} />
      <Fact term="Where" value={input.city} />
      <Fact term="Guests" value={String(input.guests)} />
      <Fact term="Budget" value={formatINR(input.budgetINR)} />
      <Fact term="Countdown" value={countdownLabel(diffDays(today, input.eventDate))} />
    </dl>
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
function SourceBadge({ source, model }: { source: PublicPlan["source"]; model: string }) {
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
