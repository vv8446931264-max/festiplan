import { LIMITS, RefineSchema } from "@/lib/contracts";
import { refineStream } from "@/lib/ai/refine";
import { readJson } from "@/lib/security/body";
import { invalid, perIpLimit, problem, runGuards, sameOrigin, toIssues, withRoute } from "@/lib/server/http";
import { getPublicPlan, isPlanId } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "We couldn't find that plan. It may have expired or the link may be incomplete.";
const limit = perIpLimit("plan-refine", 10);

/**
 * POST /api/plan/[id]/refine — "Ask FestiPlan". Body `{ question }`.
 * 200 streams `text/plain; charset=utf-8` · 400 · 403 · 404 · 413 · 415 · 429.
 */
export const POST = withRoute("POST /api/plan/[id]/refine", async (req: Request, ctx: Ctx) => {
  const blocked = runGuards(req, sameOrigin, limit);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!isPlanId(id)) return problem(404, NOT_FOUND);
  const body = await readJson(req, LIMITS.refineBodyBytes);
  if (!body.ok) return problem(body.status, body.error);
  const parsed = RefineSchema.safeParse(body.data);
  if (!parsed.success) return invalid(toIssues(parsed.error));
  const plan = await getPublicPlan(id, todayIST());
  if (!plan) return problem(404, NOT_FOUND);
  return new Response(refineStream(plan, parsed.data.question), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
