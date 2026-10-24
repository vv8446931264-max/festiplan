import { EVENT_TYPE_LABELS } from "@/lib/contracts";
import { buildIcs } from "@/lib/engine";
import { perIpLimit, problem, runGuards, withRoute } from "@/lib/server/http";
import { PLAN_NOT_FOUND, getPublicPlan, isPlanId } from "@/lib/server/plan-service";
import { dtstamp, todayIST } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const limit = perIpLimit("plan-ics", 60);

/** GET /plan/[id]/calendar.ics — the timeline as an RFC 5545 download. 200 · 404 · 429. */
export const GET = withRoute("GET /plan/[id]/calendar.ics", async (req: Request, ctx: Ctx) => {
  const blocked = runGuards(req, limit);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  if (!isPlanId(id)) return problem(404, PLAN_NOT_FOUND);
  const plan = await getPublicPlan(id, todayIST());
  if (!plan) return problem(404, PLAN_NOT_FOUND);
  const { input } = plan;
  const ics = buildIcs({
    planId: plan.id,
    title: input.title?.trim() || `${EVENT_TYPE_LABELS[input.eventType]} in ${input.city}`,
    eventDate: input.eventDate,
    city: input.city,
    tasks: plan.timeline,
    url: new URL(`/plan/${plan.id}`, req.url).toString(),
    dtstamp: dtstamp(),
  });
  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="festiplan-${plan.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
