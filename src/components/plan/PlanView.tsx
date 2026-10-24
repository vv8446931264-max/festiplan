"use client";

import type { PublicPlan } from "@/lib/contracts";
import { AskSection } from "./AskSection";
import { BudgetSection } from "./BudgetSection";
import { IdeasSection } from "./IdeasSection";
import { PlanHeader } from "./PlanHeader";
import { PlanOverview } from "./PlanOverview";
import { PlanTabs, TabPanel, useActiveTab, useUnfoldForPrint } from "./PlanTabs";
import { aiLang } from "./SectionHead";
import { ShareSection } from "./ShareSection";
import { TimelineSection } from "./TimelineSection";
import { usePlanState } from "./usePlanState";
import { VendorsSection } from "./VendorsSection";

type Props = {
  plan: PublicPlan;
  editKey: string | null;
  autoFocus?: boolean;
  /** "h1" on the standalone share page. */
  titleAs?: "h1" | "h2";
};

/**
 * The plan as a workspace: the header stays put and a sticky tab bar switches between
 * Overview, Ideas, Budget, Timeline, Vendors, Ask and Share — one screen at a time
 * instead of one endless page. Server-renderable; browser-only work happens in effects.
 */
export function PlanView({ plan: initial, editKey, autoFocus, titleAs }: Props) {
  const s = usePlanState(initial, editKey);
  const { plan } = s;
  const lang = aiLang(plan);
  const [tab, setTab] = useActiveTab();
  useUnfoldForPrint();

  return (
    <article aria-labelledby="plan-title" className="flex flex-col gap-8 sm:gap-10">
      <PlanHeader plan={plan} saveState={s.saveState} editable={s.editable} autoFocus={autoFocus} titleAs={titleAs} />
      <PlanTabs active={tab} onSelect={setTab} />
      <TabPanel id="overview" active={tab === "overview"}>
        <PlanOverview plan={plan} lang={lang} onOpen={setTab} />
      </TabPanel>
      <TabPanel id="ideas" active={tab === "ideas"}>
        <IdeasSection ideas={plan.ai.ideas} lang={lang} />
      </TabPanel>
      <TabPanel id="budget" active={tab === "budget"}>
        <BudgetSection input={plan.input} budget={plan.budget} contingencyINR={plan.contingencyINR}
          editable={s.editable} onMove={s.moveBudget} onLock={s.lockBudget} onActual={s.recordActual} />
      </TabPanel>
      <TabPanel id="timeline" active={tab === "timeline"}>
        <TimelineSection planId={plan.id} input={plan.input} timeline={plan.timeline} aiTasks={plan.ai.tasks} today={plan.today}
          editable={s.editable} onToggle={s.toggleTask} lang={lang} />
      </TabPanel>
      <TabPanel id="vendors" active={tab === "vendors"}>
        <VendorsSection planId={plan.id} input={plan.input} vendors={plan.vendors}
          editable={s.editable} onToggle={s.toggleVendor} lang={lang} />
      </TabPanel>
      <TabPanel id="ask" active={tab === "ask"}>
        <AskSection planId={plan.id} lang={lang} />
      </TabPanel>
      <TabPanel id="share" active={tab === "share"}>
        <ShareSection planId={plan.id} editKey={s.editKey} />
      </TabPanel>
    </article>
  );
}
