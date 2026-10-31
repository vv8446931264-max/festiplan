import { LIMITS, PlanInputSchema, checkEventDate } from "@/lib/contracts";
import {
  aiGlobalLimit,
  invalid,
  json,
  perIpLimit,
  readBody,
  runGuards,
  sameOrigin,
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
  const body = await readBody(req, LIMITS.planBodyBytes, PlanInputSchema);
  if (!body.ok) return body.response;
  const today = todayIST();
  const dateError = checkEventDate(body.data.eventDate, today);
  if (dateError) return invalid([{ path: "eventDate", message: dateError }], dateError);
  // Spend the instance-wide AI budget only on requests that passed every cheaper check.
  const busy = aiGlobalLimit(req);
  if (busy) return busy;
  const { plan, editKey } = await createPlan(body.data, today);
  return json({ plan, editKey }, { status: 201, headers: { Location: `/plan/${plan.id}` } });
});
