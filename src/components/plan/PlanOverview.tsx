"use client";

import type { ReactNode } from "react";
import { CATEGORY_COLORS, CATEGORY_PATTERNS } from "@/lib/category-style";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { PublicPlan } from "@/lib/contracts";
import { formatDateShort, formatINR, formatPercent, nextActions, progress } from "@/lib/engine";
import type { TabId } from "./PlanTabs";
import { TipsSection } from "./TipsSection";

type Props = { plan: PublicPlan; lang?: string; onOpen: (tab: TabId) => void };

/** The plan at a glance: concepts, money, what's next and who to book — one screen, no scrolling marathon. */
export function PlanOverview({ plan, lang, onOpen }: Props) {
  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-10">
      <h3 id="overview-title" className="sr-only">
        Plan overview
      </h3>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Three concepts" action="See the ideas" onOpen={() => onOpen("ideas")}>
          <ConceptList plan={plan} lang={lang} />
        </Card>
        <Card title="The money" action="Adjust the budget" onOpen={() => onOpen("budget")}>
          <MoneyGlance plan={plan} />
        </Card>
        <Card title="What's next" action="Open the timeline" onOpen={() => onOpen("timeline")}>
          <NextGlance plan={plan} lang={lang} />
        </Card>
        <Card
          title="Who to book first"
          action="Open the vendor checklist"
          onOpen={() => onOpen("vendors")}
        >
          <VendorGlance plan={plan} />
        </Card>
      </div>
      <TipsSection tips={plan.ai.tips} lang={lang} />
    </section>
  );
}

function Card({
  title,
  action,
  onOpen,
  children,
}: {
  title: string;
  action: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <article className="panel flex flex-col gap-5 p-6 sm:p-7">
      <h4 className="eyebrow text-cream">{title}</h4>
      <div className="flex-1">{children}</div>
      <button type="button" onClick={onOpen} className="btn btn-ghost no-print self-start text-sm">
        {action} <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function ConceptList({ plan, lang }: { plan: PublicPlan; lang?: string }) {
  return (
    <ol className="flex flex-col gap-4">
      {plan.ai.ideas.map((idea, i) => (
        <li key={i} className="flex items-center gap-4">
          <span aria-hidden="true" data-print-keep="" className="flex shrink-0 -space-x-1.5">
            {idea.palette.slice(0, 4).map((hex, j) => (
              <span
                key={j}
                className="size-5 rounded-full border border-espresso"
                style={{ background: hex }}
              />
            ))}
          </span>
          <span lang={lang} className="text-lg font-bold tracking-tight">
            {idea.name}
          </span>
        </li>
      ))}
    </ol>
  );
}

function MoneyGlance({ plan }: { plan: PublicPlan }) {
  const top = plan.budget.slice(0, 4);
  return (
    <div className="flex flex-col gap-4">
      <p className="h3 tabular">{formatINR(plan.input.budgetINR)}</p>
      <ul className="flex flex-col gap-3">
        {top.map((a) => (
          <li key={a.category} className="flex flex-col gap-1">
            <span className="flex justify-between gap-3 text-sm">
              <span className="font-semibold">{CATEGORY_LABELS[a.category]}</span>
              <span className="tabular">
                {formatINR(a.amountINR)} · {formatPercent(a.percent)}
              </span>
            </span>
            <span aria-hidden="true" className="h-2 rounded-full bg-line/60">
              <span
                data-print-keep=""
                className="block h-full rounded-full"
                style={{
                  width: `${Math.min(100, a.percent)}%`,
                  backgroundColor: CATEGORY_COLORS[a.category],
                  backgroundImage: CATEGORY_PATTERNS[a.category],
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        {formatINR(plan.contingencyINR)} held back as contingency ·{" "}
        {formatINR(Math.round(plan.input.budgetINR / plan.input.guests))} per guest
      </p>
    </div>
  );
}

function NextGlance({ plan, lang }: { plan: PublicPlan; lang?: string }) {
  const stats = progress(plan.timeline);
  const next = nextActions(plan.timeline, 3);
  return (
    <div className="flex flex-col gap-4">
      <p className="tabular font-semibold">
        {stats.done} of {stats.total} tasks done
      </p>
      <progress max={stats.total} value={stats.done} aria-label="Tasks done" className="meter" />
      {next.length === 0 ? (
        <p>Everything is ticked off. Go enjoy it.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {next.map((t) => (
            <li key={t.id} className="flex items-baseline gap-3">
              <span className="tabular w-14 shrink-0 font-mono text-sm text-gold">
                {formatDateShort(t.due)}
              </span>
              <span lang={lang} className="font-semibold">
                {t.title}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function VendorGlance({ plan }: { plan: PublicPlan }) {
  const open = plan.vendors.filter((v) => !v.done).slice(0, 3);
  const stats = progress(plan.vendors);
  return (
    <div className="flex flex-col gap-4">
      <p className="tabular font-semibold">
        {stats.done} of {stats.total} booked
      </p>
      {open.length === 0 ? (
        <p>Every vendor is booked.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {open.map((v) => (
            <li key={v.category} className="flex items-baseline gap-3">
              <span className="tabular w-14 shrink-0 font-mono text-sm text-gold">
                {formatDateShort(v.bookBy)}
              </span>
              <span className="font-semibold">{CATEGORY_LABELS[v.category]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
