"use client";

import { memo } from "react";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { BudgetCategory, PublicPlan, VendorItem } from "@/lib/contracts";
import { formatDate, progress } from "@/lib/engine";
import { SectionHead } from "./SectionHead";
import { VendorFinder } from "./VendorFinder";

type OnToggle = (category: BudgetCategory, done: boolean) => void;

type Props = {
  planId: string;
  input: PublicPlan["input"];
  vendors: VendorItem[];
  editable: boolean;
  lang?: string;
  onToggle: OnToggle;
};

/** Vendor checklist: book-by dates, questions, red flags and real nearby places. */
export const VendorsSection = memo(function VendorsSection(props: Props) {
  const { planId, input, vendors, editable, lang, onToggle } = props;
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
        {vendors.map((item) => (
          <li key={item.category} className="reveal">
            <VendorCard
              item={item}
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
  onToggle: OnToggle;
};

function VendorCard({ item, planId, city, editable, lang, onToggle }: CardProps) {
  const titleId = `vendor-${item.category}-title`;
  const late = item.overdue && !item.done;
  return (
    <article
      aria-labelledby={titleId}
      className={`panel flex h-full flex-col gap-4 p-5 sm:p-6 ${item.done ? "border-gold" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id={titleId} className="text-2xl font-bold tracking-tight">
            {CATEGORY_LABELS[item.category]}
          </h4>
          <p className="tabular text-sm text-muted">
            Book by{" "}
            <strong className={late ? "text-ember-bright" : "text-gold"}>
              {formatDate(item.bookBy)}
            </strong>
          </p>
        </div>
        <BookedStatus item={item} editable={editable} onToggle={onToggle} />
      </div>
      <VendorBrief item={item} lang={lang} />
      <VendorFinder planId={planId} category={item.category} city={city} />
    </article>
  );
}

type StatusProps = { item: VendorItem; editable: boolean; onToggle: OnToggle };

/** A "Booked" checkbox for owners; a plain status for everyone else. */
function BookedStatus({ item, editable, onToggle }: StatusProps) {
  if (!editable) return <span className="eyebrow">{item.done ? "Booked" : "Not booked"}</span>;
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        className="size-6 shrink-0"
        checked={item.done}
        onChange={(event) => onToggle(item.category, event.target.checked)}
      />
      Booked <span className="sr-only">{CATEGORY_LABELS[item.category]}</span>
    </label>
  );
}

/** Questions and red flags, folded away until wanted so the checklist stays scannable. */
function VendorBrief({ item, lang }: { item: VendorItem; lang?: string }) {
  const { questions, redFlags } = item;
  return (
    <details className="group rounded-2xl border border-line/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>What to ask</span>
        <span className="text-muted">
          {questions.length} questions · {redFlags.length} red{" "}
          {redFlags.length === 1 ? "flag" : "flags"}
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
          {questions.map((question, index) => (
            <li key={index}>{question}</li>
          ))}
        </ul>
        <div>
          <p className="eyebrow mb-2 text-ember-bright">Red flags</p>
          <ul lang={lang} className="flex list-disc flex-col gap-1 pl-5 text-muted">
            {redFlags.map((flag, index) => (
              <li key={index}>{flag}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
