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
  const planner = usePlanner(summaryRef);

  if (planner.result) {
    return (
      <div className="flex flex-col gap-6">
        <button type="button" className="btn btn-ghost no-print self-start" onClick={planner.reset}>
          <span aria-hidden="true">←</span> Edit the brief
        </button>
        <PlanView plan={planner.result.plan} editKey={planner.result.editKey} focusOnMount />
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-8 p-5 sm:p-8 lg:p-10">
      <PresetChips disabled={planner.busy} onPick={planner.pickPreset} />
      <ErrorSummary ref={summaryRef} errors={planner.errors} serverError={planner.serverError} />
      {planner.busy ? (
        <StagedProgress />
      ) : (
        <PlanForm
          values={planner.values}
          errors={planner.errors}
          minDate={planner.today ? addDays(planner.today, 1) : undefined}
          maxDate={planner.today ? maxEventDate(planner.today) : undefined}
          onChange={planner.update}
          onSubmit={() => void planner.submit(planner.values)}
        />
      )}
    </div>
  );
}
