import { LIMITS, VendorQuerySchema } from "@/lib/contracts";
import { findVendors } from "@/lib/ai/vendors";
import {
  aiGlobalLimit,
  json,
  perIpLimit,
  problem,
  readBody,
  runGuards,
  sameOrigin,
  withRoute,
} from "@/lib/server/http";
import { PLAN_NOT_FOUND, getPublicPlan } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = perIpLimit("vendors", 10);

/**
 * POST /api/vendors — Maps-grounded vendors for one category of an existing plan.
 * Body `{ planId, category }`; the city and event type come from the stored plan, so the
 * endpoint cannot be used as a free, open-ended Maps search.
 * 200 `VendorResult` · 400 `{ error, issues }` · 403 · 404 · 413 · 415 · 429 · 503 (AI ceiling).
 */
export const POST = withRoute("POST /api/vendors", async (req: Request) => {
  const blocked = runGuards(req, sameOrigin, limit);
  if (blocked) return blocked;
  const body = await readBody(req, LIMITS.vendorBodyBytes, VendorQuerySchema);
  if (!body.ok) return body.response;
  const plan = await getPublicPlan(body.data.planId, todayIST());
  if (!plan) return problem(404, PLAN_NOT_FOUND);
  const busy = aiGlobalLimit(req);
  if (busy) return busy;
  const { city, eventType } = plan.input;
  return json(await findVendors({ city, eventType, category: body.data.category }));
});
