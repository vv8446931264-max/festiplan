import { LIMITS, PlanInputSchema, checkEventDate } from "@/lib/contracts";
import { readJson } from "@/lib/security/body";
import {
  aiGlobalLimit,
  invalid,
  json,
  perIpLimit,
  problem,
  runGuards,
  sameOrigin,
  toIssues,
  withRoute,
} from "@/lib/server/http";
import { createPlan } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = perIpLimit("plan-create", 5);

/**
 * POST /api/plan — validates a brief, generates and stores a plan.
 * 201 `{ plan, editKey }` · 400 `{ error, issues }` · 403 · 413 · 415 · 429 (Retry-After) ·
 * 503 `{ error }` (Retry-After) when the instance-wide AI ceiling is reached.
 */
export const POST = withRoute("POST /api/plan", async (req: Request) => {
  const blocked = runGuards(req, sameOrigin, limit);
  if (blocked) return blocked;
  const body = await readJson(req, LIMITS.planBodyBytes);
  if (!body.ok) return problem(body.status, body.error);
  const parsed = PlanInputSchema.safeParse(body.data);
  if (!parsed.success) return invalid(toIssues(parsed.error));
  const today = todayIST();
  const dateError = checkEventDate(parsed.data.eventDate, today);
  if (dateError) return invalid([{ path: "eventDate", message: dateError }], dateError);
  const busy = aiGlobalLimit(req);
  if (busy) return busy;
  const { plan, editKey } = await createPlan(parsed.data, today);
  return json({ plan, editKey }, { status: 201, headers: { Location: `/plan/${plan.id}` } });
});
