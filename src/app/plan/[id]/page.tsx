import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
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

/** Shareable, server-rendered, read-only plan (owners with the edit key can edit). */
export default async function PlanPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="shell py-10 outline-none sm:py-16">
        <Suspense fallback={<p className="lead text-muted">Unfolding the plan…</p>}>
          <PlanLoader id={id} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function PlanLoader({ id }: { id: string }) {
  const plan = await loadPlan(id);
  if (!plan) notFound();
  return <PlanView plan={plan} editKey={null} />;
}
