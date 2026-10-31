import { CATEGORY_LABELS } from "@/lib/contracts";
import type { Allocation, Plan, PlanPatch, ScheduledTask, VendorItem } from "@/lib/contracts";
import { applyEdits, setActual, setTaskDone, setVendorDone } from "@/lib/engine";

/** An edit that doesn't fit the stored plan: 422 with a plain-language reason. */
export type PatchRejection = { ok: false; status: 422; error: string };

/** Result of `applyPatch`: the edited plan, or why the edits were refused. */
export type PatchOutcome = { ok: true; plan: Plan } | PatchRejection;

type Step<T> = { ok: true; value: T } | PatchRejection;

const reject = (error: string): PatchRejection => ({ ok: false, status: 422, error });

function patchBudget(plan: Plan, patch: PlanPatch): Step<Allocation[]> {
  let budget = plan.budget;
  if (patch.allocations) {
    const edited = applyEdits(budget, patch.allocations, {
      totalINR: plan.input.budgetINR,
      guests: plan.input.guests,
    });
    if (!edited) {
      return reject(
        "Those budget changes don't add up: include every category once, and keep the same total.",
      );
    }
    budget = edited;
  }
  for (const actual of patch.actuals ?? []) {
    if (!budget.some((line) => line.category === actual.category)) {
      return reject(`This budget has no ${CATEGORY_LABELS[actual.category]} line.`);
    }
    budget = setActual(budget, actual.category, actual.actualINR);
  }
  return { ok: true, value: budget };
}

function patchTimeline(plan: Plan, patch: PlanPatch): Step<ScheduledTask[]> {
  let timeline = plan.timeline;
  for (const tick of patch.tasks ?? []) {
    if (!timeline.some((task) => task.id === tick.id)) {
      return reject("One of those tasks isn't in this plan. Refresh the page and try again.");
    }
    timeline = setTaskDone(timeline, tick.id, tick.done);
  }
  return { ok: true, value: timeline };
}

function patchVendors(plan: Plan, patch: PlanPatch): Step<VendorItem[]> {
  let vendors = plan.vendors;
  for (const tick of patch.vendors ?? []) {
    if (!vendors.some((vendor) => vendor.category === tick.category)) {
      return reject(`This checklist has no ${CATEGORY_LABELS[tick.category]} vendor.`);
    }
    vendors = setVendorDone(vendors, tick.category, tick.done);
  }
  return { ok: true, value: vendors };
}

/**
 * Applies an owner's edits — balanced budget lines, actual spend, task and vendor ticks — to a
 * stored plan, or explains the first edit that doesn't fit (422). Pure: the caller checks the
 * edit key, stamps `updatedAt` and persists the result.
 */
export function applyPatch(plan: Plan, patch: PlanPatch): PatchOutcome {
  const budget = patchBudget(plan, patch);
  if (!budget.ok) return budget;
  const timeline = patchTimeline(plan, patch);
  if (!timeline.ok) return timeline;
  const vendors = patchVendors(plan, patch);
  if (!vendors.ok) return vendors;
  return {
    ok: true,
    plan: { ...plan, budget: budget.value, timeline: timeline.value, vendors: vendors.value },
  };
}
