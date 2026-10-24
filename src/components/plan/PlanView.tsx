"use client";

import type { PublicPlan } from "@/lib/contracts";
import { AskSection } from "./AskSection";
import { BudgetSection } from "./BudgetSection";
import { IdeasSection } from "./IdeasSection";
import { PlanHeader } from "./PlanHeader";
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

type Props = { plan: PublicPlan; editKey: string | null; autoFocus?: boolean };

/**
 * The whole plan: ideas, budget, timeline, vendors, tips, Ask FestiPlan and sharing.
 * Server-renderable — browser-only work happens in effects.
 */
export function PlanView({ plan: initial, editKey, autoFocus }: Props) {
  const s = usePlanState(initial, editKey);
  const lang = s.plan.input.language === "en" ? undefined : s.plan.input.language;

  return (
    <article aria-labelledby="plan-title" className="flex flex-col gap-20 sm:gap-28">
      <PlanHeader plan={s.plan} saveState={s.saveState} editable={s.editable} autoFocus={autoFocus} />
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
      <IdeasSection ideas={s.plan.ai.ideas} lang={lang} />
      <BudgetSection plan={s.plan} editable={s.editable} onMove={s.moveBudget} onLock={s.lockBudget} onActual={s.recordActual} />
      <TimelineSection plan={s.plan} editable={s.editable} onToggle={s.toggleTask} lang={lang} />
      <VendorsSection plan={s.plan} editable={s.editable} onToggle={s.toggleVendor} lang={lang} />
      <TipsSection tips={s.plan.ai.tips} lang={lang} />
      <AskSection planId={s.plan.id} lang={lang} />
      <ShareSection planId={s.plan.id} editKey={s.editKey} />
    </article>
  );
}
