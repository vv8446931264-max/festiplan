import { LIMITS, PlanPatchSchema } from "@/lib/contracts";
import { readJson } from "@/lib/security/body";
import { invalid, json, perIpLimit, problem, runGuards, sameOrigin, toIssues, withRoute } from "@/lib/server/http";
import { getPublicPlan, isPlanId, patchPlan } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "We couldn't find that plan. It may have expired or the link may be incomplete.";
const readLimit = perIpLimit("plan-read", 120);
const patchLimit = perIpLimit("plan-patch", 30);

/** GET /api/plan/[id] — the public plan JSON (overdue flags as of today). 200 · 404. */
export const GET = withRoute("GET /api/plan/[id]", async (req: Request, ctx: Ctx) => {
  const blocked = runGuards(req, readLimit);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!isPlanId(id)) return problem(404, NOT_FOUND);
  const plan = await getPublicPlan(id, todayIST());
  return plan ? json({ plan }) : problem(404, NOT_FOUND);
});

/**
 * PATCH /api/plan/[id] — owner edits; requires the `x-edit-key` header.
 * 200 `{ plan }` · 400 `{ error, issues }` · 403 · 404 · 413 · 415 · 422 · 429.
 */
export const PATCH = withRoute("PATCH /api/plan/[id]", async (req: Request, ctx: Ctx) => {
  const blocked = runGuards(req, sameOrigin, patchLimit);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!isPlanId(id)) return problem(404, NOT_FOUND);
  const editKey = req.headers.get("x-edit-key");
  if (!editKey) return problem(403, "Editing needs the plan's edit key. Open the plan on the device that created it.");
  const body = await readJson(req, LIMITS.patchBodyBytes);
  if (!body.ok) return problem(body.status, body.error);
  const parsed = PlanPatchSchema.safeParse(body.data);
  if (!parsed.success) return invalid(toIssues(parsed.error));
  const result = await patchPlan(id, editKey, parsed.data, todayIST());
  return result.ok ? json({ plan: result.plan }) : problem(result.status, result.error);
});
