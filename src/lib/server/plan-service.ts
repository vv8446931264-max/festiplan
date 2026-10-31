import { randomBytes } from "node:crypto";
import { CATEGORY_LABELS, PLAN_ID_RE, PLAN_TTL_DAYS } from "@/lib/contracts";
import type {
  Allocation,
  Plan,
  PlanInput,
  PlanPatch,
  PublicPlan,
  ScheduledTask,
  VendorItem,
} from "@/lib/contracts";
import type { AiHandle } from "@/lib/ai/client";
import { generateAiPlan } from "@/lib/ai/plan";
import {
  allocateBudget,
  applyEdits,
  refreshStatus,
  refreshVendorStatus,
  scheduleTimeline,
  scheduleVendors,
  setActual,
  setTaskDone,
  setVendorDone,
} from "@/lib/engine";
import { hashEditKey, newEditKey, verifyEditKey } from "@/lib/security/edit-key";
import { getStore } from "@/lib/store";
import type { PlanStore } from "@/lib/store";
import { DAY_MS } from "@/lib/time";

/** Injectable dependencies; omitted fields use the process store, env AI client and real clock. */
export type ServiceDeps = { store?: PlanStore; ai?: AiHandle | null; now?: Date };

/** Result of `patchPlan`. */
export type PatchResult =
  { ok: true; plan: PublicPlan } | { ok: false; status: 403 | 404 | 422; error: string };

/** The one plain-language message every route uses for a missing, expired or malformed plan id (404). */
export const PLAN_NOT_FOUND =
  "We couldn't find that plan. It may have expired or the link may be incomplete.";

const NOT_FOUND = { ok: false, status: 404, error: PLAN_NOT_FOUND } as const;
const FORBIDDEN = {
  ok: false,
  status: 403,
  error:
    "This link can view the plan but not change it. Open it on the device that created the plan.",
} as const;

/** True when `id` has the shape of a plan id; checked before the store is touched. */
export function isPlanId(id: string): boolean {
  return PLAN_ID_RE.test(id);
}

/** A new plan id: 9 random bytes, base64url → 12 URL-safe characters. */
export function newPlanId(): string {
  return randomBytes(9).toString("base64url");
}

/** What leaves the server: the edit-key hash is removed and `expireAt` becomes an ISO string. */
export function toPublic(plan: Plan): PublicPlan {
  const { editKeyHash: _hash, expireAt, ...rest } = plan;
  return { ...rest, expireAt: expireAt.toISOString() };
}

/**
 * Generates and stores a plan: AI (or template) ideas → exact budget → dated timeline →
 * vendor checklist. Returns the public plan and the edit key (shown to the owner once).
 */
export async function createPlan(
  input: PlanInput,
  today: string,
  deps: ServiceDeps = {},
): Promise<{ plan: PublicPlan; editKey: string }> {
  const now = deps.now ?? new Date();
  const result = await generateAiPlan(input, { ai: deps.ai, today });
  const { contingencyINR, allocations } = allocateBudget({
    totalINR: input.budgetINR,
    weights: result.ai.budgetWeights,
    guests: input.guests,
  });
  const editKey = newEditKey();
  const plan: Plan = {
    id: newPlanId(),
    input,
    ai: result.ai,
    budget: allocations,
    contingencyINR,
    timeline: scheduleTimeline(result.ai.tasks, input.eventDate, today),
    vendors: scheduleVendors(result.ai.vendors, input.eventDate, today),
    source: result.source,
    model: result.model,
    today,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expireAt: new Date(now.getTime() + PLAN_TTL_DAYS * DAY_MS),
    editKeyHash: hashEditKey(editKey),
  };
  await (deps.store ?? getStore()).create(plan);
  return { plan: toPublic(plan), editKey };
}

function withStatus(plan: Plan, today: string): Plan {
  return {
    ...plan,
    timeline: refreshStatus(plan.timeline, today),
    vendors: refreshVendorStatus(plan.vendors, today),
  };
}

/** The public plan with overdue flags recomputed for `today`, or null when missing. */
export async function getPublicPlan(
  id: string,
  today: string,
  deps: ServiceDeps = {},
): Promise<PublicPlan | null> {
  if (!isPlanId(id)) return null;
  const plan = await (deps.store ?? getStore()).get(id);
  return plan ? toPublic(withStatus(plan, today)) : null;
}

type Step<T> = { ok: true; value: T } | { ok: false; status: 422; error: string };
const fail = (error: string): { ok: false; status: 422; error: string } => ({
  ok: false,
  status: 422,
  error,
});

function patchBudget(plan: Plan, patch: PlanPatch): Step<Allocation[]> {
  let budget = plan.budget;
  if (patch.allocations) {
    const edited = applyEdits(budget, patch.allocations, {
      totalINR: plan.input.budgetINR,
      guests: plan.input.guests,
    });
    if (!edited)
      return fail(
        "Those budget changes don't add up: include every category once, and keep the same total.",
      );
    budget = edited;
  }
  for (const a of patch.actuals ?? []) {
    if (!budget.some((b) => b.category === a.category)) {
      return fail(`This budget has no ${CATEGORY_LABELS[a.category]} line.`);
    }
    budget = setActual(budget, a.category, a.actualINR);
  }
  return { ok: true, value: budget };
}

function patchTimeline(plan: Plan, patch: PlanPatch): Step<ScheduledTask[]> {
  let timeline = plan.timeline;
  for (const t of patch.tasks ?? []) {
    if (!timeline.some((x) => x.id === t.id))
      return fail("One of those tasks isn't in this plan. Refresh the page and try again.");
    timeline = setTaskDone(timeline, t.id, t.done);
  }
  return { ok: true, value: timeline };
}

function patchVendors(plan: Plan, patch: PlanPatch): Step<VendorItem[]> {
  let vendors = plan.vendors;
  for (const v of patch.vendors ?? []) {
    if (!vendors.some((x) => x.category === v.category)) {
      return fail(`This checklist has no ${CATEGORY_LABELS[v.category]} vendor.`);
    }
    vendors = setVendorDone(vendors, v.category, v.done);
  }
  return { ok: true, value: vendors };
}

type Decision = { next: Plan | null; result: PatchResult };

function decidePatch(
  plan: Plan | null,
  editKey: string | null,
  patch: PlanPatch,
  today: string,
  now: Date,
): Decision {
  if (!plan) return { next: null, result: NOT_FOUND };
  if (!verifyEditKey(editKey, plan.editKeyHash)) return { next: null, result: FORBIDDEN };
  const budget = patchBudget(plan, patch);
  if (!budget.ok) return { next: null, result: budget };
  const timeline = patchTimeline(plan, patch);
  if (!timeline.ok) return { next: null, result: timeline };
  const vendors = patchVendors(plan, patch);
  if (!vendors.ok) return { next: null, result: vendors };
  const next = withStatus(
    {
      ...plan,
      budget: budget.value,
      timeline: timeline.value,
      vendors: vendors.value,
      updatedAt: now.toISOString(),
    },
    today,
  );
  return { next, result: { ok: true, plan: toPublic(next) } };
}

/**
 * Applies an owner's edits (checklist ticks, actual spend, budget lines) after a
 * timing-safe edit-key check, as one atomic read-modify-write so concurrent edits
 * from two phones never overwrite each other.
 * 404 unknown plan · 403 wrong key · 422 edits that don't fit.
 */
export async function patchPlan(
  id: string,
  editKey: string | null,
  patch: PlanPatch,
  today: string,
  deps: ServiceDeps = {},
): Promise<PatchResult> {
  if (!isPlanId(id)) return NOT_FOUND;
  const now = deps.now ?? new Date();
  return (deps.store ?? getStore()).mutate(id, (plan) =>
    decidePatch(plan, editKey, patch, today, now),
  );
}
