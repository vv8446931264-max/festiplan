"use client";

import { CATEGORY_LABELS, type BudgetCategory, type PublicPlan, type VendorItem } from "@/lib/contracts";
import { formatDate, progress } from "@/lib/engine";
import { SectionHead } from "./SectionHead";
import { VendorFinder } from "./VendorFinder";

type Props = { plan: PublicPlan; editable: boolean; lang?: string; onToggle: (c: BudgetCategory, done: boolean) => void };

/** Vendor checklist: book-by dates, questions, red flags and real nearby places. */
export function VendorsSection({ plan, editable, lang, onToggle }: Props) {
  const stats = progress(plan.vendors);
  return (
    <section id="vendors" aria-labelledby="vendors-title" className="scroll-mt-20">
      <SectionHead id="vendors" number="04" kicker="Vendors"
        title={<>Who to book, <span className="accent">and what to ask</span>.</>}>
        {stats.done} of {stats.total} booked. Real places come from Google Maps — FestiPlan never invents a vendor name.
      </SectionHead>
      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plan.vendors.map((v) => (
          <li key={v.category} className="reveal">
            <VendorCard item={v} plan={plan} editable={editable} lang={lang} onToggle={onToggle} />
          </li>
        ))}
      </ul>
    </section>
  );
}

type CardProps = { item: VendorItem; plan: PublicPlan; editable: boolean; lang?: string; onToggle: Props["onToggle"] };

function VendorCard({ item: v, plan, editable, lang, onToggle }: CardProps) {
  const label = CATEGORY_LABELS[v.category];
  const id = `vendor-${v.category}`;
  return (
    <article aria-labelledby={`${id}-title`} className={`panel flex h-full flex-col gap-4 p-6 ${v.done ? "border-gold" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id={`${id}-title`} className="text-2xl font-bold tracking-tight">{label}</h4>
          <p className="tabular text-sm text-muted">
            Book by <strong className={v.overdue && !v.done ? "text-ember-bright" : "text-gold"}>{formatDate(v.bookBy)}</strong>
          </p>
        </div>
        {editable ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5" checked={v.done} onChange={(e) => onToggle(v.category, e.target.checked)} />
            Booked{" "}<span className="sr-only">{label}</span>
          </label>
        ) : (
          <span className="eyebrow">{v.done ? "Booked" : "Not booked"}</span>
        )}
      </div>
      <div>
        <p className="eyebrow mb-2">Ask them</p>
        <ul lang={lang} className="flex list-disc flex-col gap-1 pl-5">
          {v.questions.map((q) => <li key={q}>{q}</li>)}
        </ul>
      </div>
      <div>
        <p className="eyebrow mb-2 text-ember-bright">Red flags</p>
        <ul lang={lang} className="flex list-disc flex-col gap-1 pl-5 text-muted">
          {v.redFlags.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>
      <VendorFinder category={v.category} city={plan.input.city} eventType={plan.input.eventType} />
    </article>
  );
}
