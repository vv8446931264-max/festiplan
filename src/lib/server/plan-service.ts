import { randomBytes } from "node:crypto";
import { PLAN_ID_RE, PLAN_TTL_DAYS } from "@/lib/contracts";
import type { CreatedPlan, Plan, PlanInput, PlanPatch, PublicPlan } from "@/lib/contracts";
import type { AiHandle } from "@/lib/ai/client";
import { generateAiPlan } from "@/lib/ai/plan";
import {
  allocateBudget,
  refreshStatus,
  refreshVendorStatus,
  scheduleTimeline,
  scheduleVendors,
} from "@/lib/engine";
import { hashEditKey, newEditKey, verifyEditKey } from "@/lib/security/edit-key";
import { getStore } from "@/lib/store";
import type { PlanStore } from "@/lib/store";
import { DAY_MS } from "@/lib/time";
import { applyPatch } from "./plan-patch";

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

/** Random bytes per plan id: 9 bytes encode to exactly 12 URL-safe base64url characters. */
const PLAN_ID_BYTES = 9;

/** True when `id` has the shape of a plan id; checked before the store is touched. */
export function isPlanId(id: string): boolean {
  return PLAN_ID_RE.test(id);
}

/** A new random plan id of 12 URL-safe characters. */
export function newPlanId(): string {
  return randomBytes(PLAN_ID_BYTES).toString("base64url");
}

/** What leaves the server: the edit-key hash is removed and `expireAt` becomes an ISO string. */
export function toPublic(plan: Plan): PublicPlan {
  const { editKeyHash: _hash, expireAt, ...rest } = plan;
  return { ...rest, expireAt: expireAt.toISOString() };
}

/** The plan with overdue flags recomputed for `today`. */
function withStatus(plan: Plan, today: string): Plan {
  return {
    ...plan,
    timeline: refreshStatus(plan.timeline, today),
    vendors: refreshVendorStatus(plan.vendors, today),
  };
}

/**
 * Generates and stores a plan: AI (or template) ideas → exact budget → dated timeline →
 * vendor checklist. Returns the public plan and the edit key (shown to the owner once).
 */
export async function createPlan(
  input: PlanInput,
  today: string,
  deps: ServiceDeps = {},
): Promise<CreatedPlan> {
  const now = deps.now ?? new Date();
  const { ai, source, model } = await generateAiPlan(input, { ai: deps.ai, today });
  const { contingencyINR, allocations } = allocateBudget({
    totalINR: input.budgetINR,
    weights: ai.budgetWeights,
    guests: input.guests,
  });
  const editKey = newEditKey();
  const plan: Plan = {
    id: newPlanId(),
    input,
    ai,
    budget: allocations,
    contingencyINR,
    timeline: scheduleTimeline(ai.tasks, input.eventDate, today),
    vendors: scheduleVendors(ai.vendors, input.eventDate, today),
    source,
    model,
    today,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expireAt: new Date(now.getTime() + PLAN_TTL_DAYS * DAY_MS),
    editKeyHash: hashEditKey(editKey),
  };
  await (deps.store ?? getStore()).create(plan);
  return { plan: toPublic(plan), editKey };
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

/** What one atomic edit decides: the plan to write (null writes nothing) and the reply. */
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
  const edited = applyPatch(plan, patch);
  if (!edited.ok) return { next: null, result: edited };
  const next = withStatus({ ...edited.plan, updatedAt: now.toISOString() }, today);
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
