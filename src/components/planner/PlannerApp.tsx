"use client";

import { useRef } from "react";
import { PlanView } from "@/components/plan/PlanView";
import { maxEventDate } from "@/lib/contracts/dates";
import { addDays } from "@/lib/engine";
import { ErrorSummary } from "./ErrorSummary";
import { PlanForm } from "./PlanForm";
import { PresetChips } from "./PresetChips";
import { StagedProgress } from "./StagedProgress";
import { usePlanner } from "./usePlanner";

/** The single entry point: brief → staged progress → the plan unfolds in place. */
export function PlannerApp() {
  const summaryRef = useRef<HTMLDivElement>(null);
  const p = usePlanner(summaryRef);

  if (p.result) {
    return (
      <div className="flex flex-col gap-6">
        <button type="button" className="btn btn-ghost no-print self-start" onClick={p.reset}>
          <span aria-hidden="true">←</span> Edit the brief
        </button>
        <PlanView plan={p.result.plan} editKey={p.result.editKey} autoFocus />
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-8 p-5 sm:p-8 lg:p-10">
      <PresetChips disabled={p.busy} onPick={p.pickPreset} />
      <ErrorSummary ref={summaryRef} errors={p.errors} serverError={p.serverError} />
      {p.busy ? (
        <StagedProgress />
      ) : (
        <PlanForm
          values={p.values}
          errors={p.errors}
          busy={p.busy}
          minDate={p.today ? addDays(p.today, 1) : undefined}
          maxDate={p.today ? maxEventDate(p.today) : undefined}
          onChange={p.update}
          onSubmit={() => void p.submit(p.values)}
        />
      )}
    </div>
  );
}
