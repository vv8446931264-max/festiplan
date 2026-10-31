"use client";

import { memo } from "react";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { BudgetCategory, PublicPlan, VendorItem } from "@/lib/contracts";
import { formatDate, progress } from "@/lib/engine";
import { SectionHead } from "./SectionHead";
import { VendorFinder } from "./VendorFinder";

type Props = {
  planId: string;
  input: PublicPlan["input"];
  vendors: VendorItem[];
  editable: boolean;
  lang?: string;
  onToggle: (c: BudgetCategory, done: boolean) => void;
};

/** Vendor checklist: book-by dates, questions, red flags and real nearby places. */
export const VendorsSection = memo(function VendorsSection({
  planId,
  input,
  vendors,
  editable,
  lang,
  onToggle,
}: Props) {
  const stats = progress(vendors);
  return (
    <section id="vendors" aria-labelledby="vendors-title" className="scroll-mt-20">
      <SectionHead
        id="vendors"
        number="04"
        kicker="Vendors"
        title={
          <>
            Who to book, <span className="accent">and what to ask</span>.
          </>
        }
      >
        {stats.done} of {stats.total} booked. Real places come from Google Maps — FestiPlan never
        invents a vendor name.
      </SectionHead>
      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {vendors.map((v) => (
          <li key={v.category} className="reveal">
            <VendorCard
              item={v}
              planId={planId}
              city={input.city}
              editable={editable}
              lang={lang}
              onToggle={onToggle}
            />
          </li>
        ))}
      </ul>
    </section>
  );
});

type CardProps = {
  item: VendorItem;
  planId: string;
  city: string;
  editable: boolean;
  lang?: string;
  onToggle: Props["onToggle"];
};

function VendorCard({ item: v, planId, city, editable, lang, onToggle }: CardProps) {
  const label = CATEGORY_LABELS[v.category];
  const id = `vendor-${v.category}`;
  return (
    <article
      aria-labelledby={`${id}-title`}
      className={`panel flex h-full flex-col gap-4 p-5 sm:p-6 ${v.done ? "border-gold" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id={`${id}-title`} className="text-2xl font-bold tracking-tight">
            {label}
          </h4>
          <p className="tabular text-sm text-muted">
            Book by{" "}
            <strong className={v.overdue && !v.done ? "text-ember-bright" : "text-gold"}>
              {formatDate(v.bookBy)}
            </strong>
          </p>
        </div>
        {editable ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-6 shrink-0"
              checked={v.done}
              onChange={(e) => onToggle(v.category, e.target.checked)}
            />
            Booked <span className="sr-only">{label}</span>
          </label>
        ) : (
          <span className="eyebrow">{v.done ? "Booked" : "Not booked"}</span>
        )}
      </div>
      <VendorBrief item={v} lang={lang} />
      <VendorFinder planId={planId} category={v.category} city={city} />
    </article>
  );
}

/** Questions and red flags, folded away until wanted so the checklist stays scannable. */
function VendorBrief({ item: v, lang }: { item: VendorItem; lang?: string }) {
  return (
    <details className="group rounded-2xl border border-line/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>What to ask</span>
        <span className="text-muted">
          {v.questions.length} questions · {v.redFlags.length} red{" "}
          {v.redFlags.length === 1 ? "flag" : "flags"}
          <span
            aria-hidden="true"
            className="ml-2 inline-block text-gold transition-transform group-open:rotate-90"
          >
            ▸
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-line/60 px-4 py-4">
        <ul lang={lang} className="flex list-disc flex-col gap-1 pl-5">
          {v.questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
        <div>
          <p className="eyebrow mb-2 text-ember-bright">Red flags</p>
          <ul lang={lang} className="flex list-disc flex-col gap-1 pl-5 text-muted">
            {v.redFlags.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
