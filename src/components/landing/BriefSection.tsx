import { PlannerApp } from "@/components/planner/PlannerApp";

/** Chapter 2: the brief. The planner below it unfolds into the finished plan in place. */
export function BriefSection() {
  return (
    <section id="plan" aria-labelledby="brief-title" className="shell scroll-mt-4 py-16 sm:py-24">
      <div className="legible mb-10 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <p className="eyebrow">Nº 02 — The brief</p>
        <div className="flex flex-col gap-4">
          <h2 id="brief-title" tabIndex={-1} className="h2 outline-none">
            Tell us about <span className="accent text-gold">the day</span>.
          </h2>
          <p className="lead max-w-2xl text-muted">
            Four numbers and a feeling. That&apos;s all it takes to get concepts, a budget, a
            timeline and a vendor checklist.
          </p>
        </div>
      </div>
      <PlannerApp />
    </section>
  );
}
