"use client";

import { PlanView } from "@/components/plan/PlanView";
import { addDays } from "@/lib/engine";
import { ErrorSummary } from "./ErrorSummary";
import { PlanForm } from "./PlanForm";
import { PresetChips } from "./PresetChips";
import { StagedProgress } from "./StagedProgress";
import { usePlanner } from "./usePlanner";

/** The single entry point: brief → staged progress → the plan unfolds in place. */
export function PlannerApp() {
  const p = usePlanner();

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
      <ErrorSummary ref={p.summaryRef} errors={p.errors} serverError={p.serverError} />
      {p.busy ? (
        <StagedProgress city={p.values.city.trim()} />
      ) : (
        <PlanForm
          values={p.values}
          errors={p.errors}
          busy={p.busy}
          minDate={addDays(p.today, 1)}
          maxDate={addDays(p.today, 365 * 3)}
          onChange={p.update}
          onSubmit={() => void p.submit(p.values)}
        />
      )}
    </div>
  );
}
