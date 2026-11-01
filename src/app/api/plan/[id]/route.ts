import { LIMITS, PlanPatchSchema } from "@/lib/contracts";
import type { PlanResponse } from "@/lib/contracts";
import {
  json,
  perIpLimit,
  problem,
  readBody,
  runGuards,
  sameOrigin,
  withRoute,
} from "@/lib/server/http";
import type { IdRouteContext } from "@/lib/server/http";
import { PLAN_NOT_FOUND, getPublicPlan, isPlanId, patchPlan } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_READS_PER_MINUTE = 120;
const PLAN_PATCHES_PER_MINUTE = 30;
const readLimit = perIpLimit("plan-read", PLAN_READS_PER_MINUTE);
const patchLimit = perIpLimit("plan-patch", PLAN_PATCHES_PER_MINUTE);

const MISSING_EDIT_KEY =
  "Editing needs the plan's edit key. Open the plan on the device that created it.";

/** GET /api/plan/[id] — the public plan JSON (overdue flags as of today). 200 · 404. */
export const GET = withRoute("GET /api/plan/[id]", async (req: Request, ctx: IdRouteContext) => {
  const blocked = runGuards(req, readLimit);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!isPlanId(id)) return problem(404, PLAN_NOT_FOUND);
  const plan = await getPublicPlan(id, todayIST());
  return plan ? json({ plan } satisfies PlanResponse) : problem(404, PLAN_NOT_FOUND);
});

/**
 * PATCH /api/plan/[id] — owner edits; requires the `x-edit-key` header.
 * 200 `{ plan }` · 400 `{ error, issues }` · 403 · 404 · 413 · 415 · 422 · 429.
 */
export const PATCH = withRoute(
  "PATCH /api/plan/[id]",
  async (req: Request, ctx: IdRouteContext) => {
    const blocked = runGuards(req, sameOrigin, patchLimit);
    if (blocked) return blocked;
    const { id } = await ctx.params;
    if (!isPlanId(id)) return problem(404, PLAN_NOT_FOUND);
    const editKey = req.headers.get("x-edit-key");
    if (!editKey) return problem(403, MISSING_EDIT_KEY);
    const body = await readBody(req, LIMITS.patchBodyBytes, PlanPatchSchema);
    if (!body.ok) return body.response;
    const result = await patchPlan(id, editKey, body.data, todayIST());
    if (!result.ok) return problem(result.status, result.error);
    return json({ plan: result.plan } satisfies PlanResponse);
  },
);
