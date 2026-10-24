"use client";

import { useState } from "react";
import { LazyBudgetFlow } from "@/components/three/lazy";
import type { BudgetCategory, PublicPlan } from "@/lib/contracts";
import { formatINR } from "@/lib/engine";
import { BudgetSliders } from "./BudgetSliders";
import { BudgetTable } from "./BudgetTable";
import { SectionHead } from "./SectionHead";

type Props = {
  plan: PublicPlan;
  editable: boolean;
  onMove: (category: BudgetCategory, amountINR: number) => void;
  onLock: (category: BudgetCategory, locked: boolean) => void;
  onActual: (category: BudgetCategory, actualINR: number | null) => void;
};

/** Budget chapter: the flow simulation, live sliders and the exact table. */
export function BudgetSection({ plan, editable, onMove, onLock, onActual }: Props) {
  const [highlight, setHighlight] = useState<BudgetCategory | null>(null);
  const total = plan.input.budgetINR;
  const allocated = plan.budget.reduce((sum, a) => sum + a.amountINR, 0) + plan.contingencyINR;

  return (
    <section id="budget" aria-labelledby="budget-title" className="scroll-mt-20">
      <SectionHead id="budget" number="02" kicker="Budget"
        title={<>{formatINR(total)}, accounted for <span className="accent">down to the last rupee</span>.</>}>
        Gemini suggests the weights; plain arithmetic does the split.{" "}
        {editable ? "Drag a slider — the others re-balance instantly, locked lines stay put." : "Open the edit link to adjust it."}
      </SectionHead>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="panel overflow-hidden p-3">
          <LazyBudgetFlow allocations={plan.budget} highlight={highlight} onHighlight={setHighlight} className="aspect-[4/3] w-full" />
        </div>
        <BudgetSliders
          allocations={plan.budget}
          totalINR={total}
          editable={editable}
          highlight={highlight}
          onHighlight={setHighlight}
          onMove={onMove}
          onLock={onLock}
        />
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <span data-contingency={plan.contingencyINR} className="rounded-full border border-gold px-3 py-1 font-semibold text-gold">
          Contingency {formatINR(plan.contingencyINR)} held back
        </span>
        <span className="text-muted">
          {allocated === total ? `✓ Lines plus contingency add up to ${formatINR(total)} exactly.` : `Allocated ${formatINR(allocated)} of ${formatINR(total)}.`}
        </span>
      </p>
      <BudgetTable plan={plan} editable={editable} highlight={highlight} onHighlight={setHighlight} onActual={onActual} />
    </section>
  );
}
