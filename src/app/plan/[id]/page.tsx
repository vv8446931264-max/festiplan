import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PlanView } from "@/components/plan/PlanView";
import { EVENT_TYPE_LABELS } from "@/lib/contracts";
import { getPublicPlan } from "@/lib/server/plan-service";
import { todayIST } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const ID = /^[A-Za-z0-9_-]{6,32}$/;

/** One store read per request, shared by metadata and the page. */
const loadPlan = cache(async (id: string) => (ID.test(id) ? getPublicPlan(id, todayIST()) : null));

/** Per-plan title; unknown ids 404 before streaming starts. Plans are never indexed. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const plan = await loadPlan(id);
  if (!plan) notFound();
  const { input } = plan;
  const title = input.title || `${EVENT_TYPE_LABELS[input.eventType]} in ${input.city}`;
  return {
    title,
    description: plan.ai.summary,
    robots: { index: false, follow: false },
  };
}

/**
 * Shareable, server-rendered plan: the full plan is in the HTML. The plan is loaded
 * before anything streams, so an unknown or expired id is a real HTTP 404.
 * Read-only unless this browser holds the edit key.
 */
export default async function PlanPage({ params }: Props) {
  const { id } = await params;
  const plan = await loadPlan(id);
  if (!plan) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="shell py-10 outline-none sm:py-16">
        <PlanView plan={plan} editKey={null} />
      </main>
      <SiteFooter />
    </>
  );
}
