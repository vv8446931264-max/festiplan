"use client";

import type { PublicPlan } from "@/lib/contracts";
import { AskSection } from "./AskSection";
import { BudgetSection } from "./BudgetSection";
import { IdeasSection } from "./IdeasSection";
import { PlanHeader } from "./PlanHeader";
import { aiLang } from "./SectionHead";
import { ShareSection } from "./ShareSection";
import { TimelineSection } from "./TimelineSection";
import { TipsSection } from "./TipsSection";
import { usePlanState } from "./usePlanState";
import { VendorsSection } from "./VendorsSection";

const NAV = [
  ["ideas", "Ideas"],
  ["budget", "Budget"],
  ["timeline", "Timeline"],
  ["vendors", "Vendors"],
  ["ask", "Ask"],
  ["share", "Share"],
] as const;

type Props = {
  plan: PublicPlan;
  editKey: string | null;
  autoFocus?: boolean;
  /** "h1" on the standalone share page. */
  titleAs?: "h1" | "h2";
};

/**
 * The whole plan: ideas, budget, timeline, vendors, tips, Ask FestiPlan and sharing.
 * Server-renderable — browser-only work happens in effects.
 */
export function PlanView({ plan: initial, editKey, autoFocus, titleAs }: Props) {
  const s = usePlanState(initial, editKey);
  const { plan } = s;
  const lang = aiLang(plan);

  return (
    <article aria-labelledby="plan-title" className="flex flex-col gap-20 sm:gap-28">
      <PlanHeader plan={plan} saveState={s.saveState} editable={s.editable} autoFocus={autoFocus} titleAs={titleAs} />
      <nav aria-label="Plan sections" className="no-print sticky top-0 z-20 -mx-[var(--pad)] overflow-x-auto bg-espresso/85 px-[var(--pad)] py-3 backdrop-blur">
        <ul className="flex gap-2">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="eyebrow inline-flex min-h-11 items-center rounded-full border border-line px-4 text-cream no-underline hover:border-cream">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <IdeasSection ideas={plan.ai.ideas} lang={lang} />
      <BudgetSection input={plan.input} budget={plan.budget} contingencyINR={plan.contingencyINR}
        editable={s.editable} onMove={s.moveBudget} onLock={s.lockBudget} onActual={s.recordActual} />
      <TimelineSection planId={plan.id} input={plan.input} timeline={plan.timeline}
        editable={s.editable} onToggle={s.toggleTask} lang={lang} />
      <VendorsSection planId={plan.id} input={plan.input} vendors={plan.vendors}
        editable={s.editable} onToggle={s.toggleVendor} lang={lang} />
      <TipsSection tips={plan.ai.tips} lang={lang} />
      <AskSection planId={plan.id} lang={lang} />
      <ShareSection planId={plan.id} editKey={s.editKey} />
    </article>
  );
}
