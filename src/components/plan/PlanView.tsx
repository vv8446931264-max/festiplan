"use client";

import type { PublicPlan } from "@/lib/contracts";
import { renderChapter } from "./chapters";
import { PlanHeadingLevel } from "./Heading";
import { PlanHeader } from "./PlanHeader";
import { PlanTabs, TabPanel } from "./PlanTabs";
import { aiLang } from "./SectionHead";
import { TABS } from "./tabs";
import { useActiveTab } from "./useActiveTab";
import { usePlanState } from "./usePlanState";
import { useUnfoldForPrint } from "./useUnfoldForPrint";

type Props = {
  plan: PublicPlan;
  editKey: string | null;
  /** Focus the plan title on mount (set when a plan has just been generated). */
  focusOnMount?: boolean;
  /** "h1" on the standalone share page; chapter headings then start at h2 instead of h3. */
  titleAs?: "h1" | "h2";
};

/**
 * The plan as a workspace: the header stays put and a sticky tab bar switches between
 * Overview, Ideas, Budget, Timeline, Vendors, Ask and Share — one screen at a time
 * instead of one endless page. Server-renderable; browser-only work happens in effects.
 * Chapter headings rank from the title's level, so the outline never skips one.
 */
export function PlanView({ plan: initialPlan, editKey, focusOnMount, titleAs = "h2" }: Props) {
  const planState = usePlanState(initialPlan, editKey);
  const [activeTab, selectTab] = useActiveTab();
  useUnfoldForPrint();
  const context = { planState, lang: aiLang(planState.plan), openTab: selectTab };

  return (
    <PlanHeadingLevel level={titleAs === "h1" ? 1 : 2}>
      <article aria-labelledby="plan-title" className="flex flex-col gap-8 sm:gap-10">
        <PlanHeader
          plan={planState.plan}
          saveState={planState.saveState}
          editable={planState.editable}
          focusOnMount={focusOnMount}
          titleAs={titleAs}
        />
        <PlanTabs active={activeTab} onSelect={selectTab} />
        {TABS.map(({ id }) => (
          <TabPanel key={id} id={id} active={id === activeTab}>
            {renderChapter(id, context)}
          </TabPanel>
        ))}
      </article>
    </PlanHeadingLevel>
  );
}
