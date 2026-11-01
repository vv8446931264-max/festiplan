"use client";

import { memo, useState } from "react";
import { LazyBudgetFlow } from "@/components/three/lazy";
import type { Allocation, BudgetCategory, PublicPlan } from "@/lib/contracts";
import { allocatedTotal, formatINR } from "@/lib/engine";
import { BudgetSliders } from "./BudgetSliders";
import { BudgetTable } from "./BudgetTable";
import { SectionHead } from "./SectionHead";

type Props = {
  input: PublicPlan["input"];
  budget: Allocation[];
  contingencyINR: number;
  editable: boolean;
  onMove: (category: BudgetCategory, amountINR: number) => void;
  onLock: (category: BudgetCategory, locked: boolean) => void;
  onActual: (category: BudgetCategory, actualINR: number | null) => void;
};

/** Budget chapter: the flow simulation, live sliders and the exact table. */
export const BudgetSection = memo(function BudgetSection(props: Props) {
  const { input, budget, contingencyINR, editable, onMove, onLock, onActual } = props;
  // The category under the pointer or in focus, highlighted in the flow, sliders and table.
  const [highlight, setHighlight] = useState<BudgetCategory | null>(null);
  const highlighting = { highlight, onHighlight: setHighlight };

  return (
    <section id="budget" aria-labelledby="budget-title" className="scroll-mt-20">
      <BudgetHead totalINR={input.budgetINR} editable={editable} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="panel self-start overflow-hidden p-3 lg:sticky lg:top-24">
          <LazyBudgetFlow allocations={budget} className="aspect-[4/3] w-full" {...highlighting} />
        </div>
        <BudgetSliders
          allocations={budget}
          totalINR={input.budgetINR}
          editable={editable}
          onMove={onMove}
          onLock={onLock}
          {...highlighting}
        />
      </div>
      <BudgetCheck budget={budget} contingencyINR={contingencyINR} totalINR={input.budgetINR} />
      <BudgetTable
        input={input}
        budget={budget}
        contingencyINR={contingencyINR}
        editable={editable}
        onActual={onActual}
        {...highlighting}
      />
    </section>
  );
});

/** Chapter heading: the total, and how the sliders behave for owners. */
function BudgetHead({ totalINR, editable }: { totalINR: number; editable: boolean }) {
  return (
    <SectionHead
      id="budget"
      number="02"
      kicker="Budget"
      title={
        <>
          {formatINR(totalINR)}, accounted for{" "}
          <span className="accent">down to the last rupee</span>.
        </>
      }
    >
      Gemini suggests the weights; plain arithmetic does the split.{" "}
      {editable
        ? "Drag a slider — the others re-balance instantly, locked lines stay put."
        : "Open the edit link to adjust it."}
    </SectionHead>
  );
}

type CheckProps = { budget: Allocation[]; contingencyINR: number; totalINR: number };

/** The contingency held back, and proof that lines plus contingency add up to the total. */
function BudgetCheck({ budget, contingencyINR, totalINR }: CheckProps) {
  const allocatedINR = allocatedTotal(budget, contingencyINR);
  return (
    <p className="mt-6 flex flex-wrap items-center gap-3 text-sm">
      <span
        data-contingency={contingencyINR}
        className="rounded-full border border-gold px-3 py-1 font-semibold text-gold"
      >
        Contingency {formatINR(contingencyINR)} held back
      </span>
      <span className="text-muted">
        {allocatedINR === totalINR
          ? `✓ Lines plus contingency add up to ${formatINR(totalINR)} exactly.`
          : `Allocated ${formatINR(allocatedINR)} of ${formatINR(totalINR)}.`}
      </span>
    </p>
  );
}
