import { LIMITS, RefineSchema } from "@/lib/contracts";
import { refineStream } from "@/lib/ai/refine";
import {
  aiGlobalLimit,
  perIpLimit,
  problem,
  readBody,
  runGuards,
  sameOrigin,
  withRoute,
} from "@/lib/server/http";
import type { IdRouteContext } from "@/lib/server/http";
import { PLAN_NOT_FOUND, getPublicPlan, isPlanId } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFINES_PER_MINUTE = 10;
const limit = perIpLimit("plan-refine", REFINES_PER_MINUTE);

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * POST /api/plan/[id]/refine — "Ask FestiPlan". Body `{ question }`.
 * 200 streams `text/plain; charset=utf-8` · 400 · 403 · 404 · 413 · 415 · 429 · 503 (AI ceiling).
 */
export const POST = withRoute(
  "POST /api/plan/[id]/refine",
  async (req: Request, ctx: IdRouteContext) => {
    const blocked = runGuards(req, sameOrigin, limit);
    if (blocked) return blocked;
    const { id } = await ctx.params;
    if (!isPlanId(id)) return problem(404, PLAN_NOT_FOUND);
    const body = await readBody(req, LIMITS.refineBodyBytes, RefineSchema);
    if (!body.ok) return body.response;
    const plan = await getPublicPlan(id, todayIST());
    if (!plan) return problem(404, PLAN_NOT_FOUND);
    const busy = aiGlobalLimit(req);
    if (busy) return busy;
    const stream = refineStream(plan, body.data.question);
    return new Response(stream, { status: 200, headers: STREAM_HEADERS });
  },
);
