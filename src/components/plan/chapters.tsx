"use client";

import type { ReactNode } from "react";
import { AskSection } from "./AskSection";
import { BudgetSection } from "./BudgetSection";
import { IdeasSection } from "./IdeasSection";
import { PlanOverview } from "./PlanOverview";
import { ShareSection } from "./ShareSection";
import type { TabId } from "./tabs";
import { TimelineSection } from "./TimelineSection";
import type { PlanState } from "./usePlanState";
import { VendorsSection } from "./VendorsSection";

/** Everything a chapter may draw on: live plan state, the AI text language, tab switching. */
export type ChapterContext = {
  planState: PlanState;
  lang?: string;
  openTab: (id: TabId) => void;
};

/**
 * The content behind each workspace tab. Each chapter receives only its slice of the
 * plan, so the memoised sections re-render only when their own data changes.
 */
const CHAPTERS: Record<TabId, (context: ChapterContext) => ReactNode> = {
  overview: ({ planState, lang, openTab }) => (
    <PlanOverview plan={planState.plan} lang={lang} onOpen={openTab} />
  ),
  ideas: ({ planState, lang }) => <IdeasSection ideas={planState.plan.ai.ideas} lang={lang} />,
  budget: ({ planState }) => (
    <BudgetSection
      input={planState.plan.input}
      budget={planState.plan.budget}
      contingencyINR={planState.plan.contingencyINR}
      editable={planState.editable}
      onMove={planState.moveBudget}
      onLock={planState.lockBudget}
      onActual={planState.recordActual}
    />
  ),
  timeline: ({ planState, lang }) => (
    <TimelineSection
      planId={planState.plan.id}
      input={planState.plan.input}
      timeline={planState.plan.timeline}
      aiTasks={planState.plan.ai.tasks}
      today={planState.plan.today}
      editable={planState.editable}
      onToggle={planState.toggleTask}
      lang={lang}
    />
  ),
  vendors: ({ planState, lang }) => (
    <VendorsSection
      planId={planState.plan.id}
      input={planState.plan.input}
      vendors={planState.plan.vendors}
      editable={planState.editable}
      onToggle={planState.toggleVendor}
      lang={lang}
    />
  ),
  ask: ({ planState, lang }) => <AskSection planId={planState.plan.id} lang={lang} />,
  share: ({ planState }) => <ShareSection planId={planState.plan.id} editKey={planState.editKey} />,
};

/** Renders the chapter shown behind one workspace tab. */
export function renderChapter(id: TabId, context: ChapterContext): ReactNode {
  return CHAPTERS[id](context);
}
