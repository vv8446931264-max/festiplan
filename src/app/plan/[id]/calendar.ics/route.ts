import { buildIcs, planTitle } from "@/lib/engine";
import { perIpLimit, problem, runGuards, withRoute } from "@/lib/server/http";
import { PLAN_NOT_FOUND, getPublicPlan, isPlanId } from "@/lib/server/plan-service";
import { dtstamp, todayIST } from "@/lib/time";

/** Node.js runtime: the plan store (Firestore) needs it. */
export const runtime = "nodejs";
/** Always rendered per request: the timeline changes as tasks are ticked off. */
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ICS_DOWNLOADS_PER_MINUTE = 60;
const rateLimit = perIpLimit("plan-ics", ICS_DOWNLOADS_PER_MINUTE);

/** GET /plan/[id]/calendar.ics — the timeline as an RFC 5545 download. 200 · 404 · 429. */
export const GET = withRoute(
  "GET /plan/[id]/calendar.ics",
  async (req: Request, context: RouteContext) => {
    const blocked = runGuards(req, rateLimit);
    if (blocked) return blocked;
    const { id } = await context.params;
    if (!isPlanId(id)) return problem(404, PLAN_NOT_FOUND);
    const plan = await getPublicPlan(id, todayIST());
    if (!plan) return problem(404, PLAN_NOT_FOUND);
    const ics = buildIcs({
      planId: plan.id,
      title: planTitle(plan.input),
      eventDate: plan.input.eventDate,
      city: plan.input.city,
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
  },
);
