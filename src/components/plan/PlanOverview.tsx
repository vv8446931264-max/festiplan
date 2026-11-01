"use client";

import type { ReactNode } from "react";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { PublicPlan } from "@/lib/contracts";
import {
  amountPerGuest,
  formatDateShort,
  formatINR,
  formatPercent,
  nextActions,
  progress,
} from "@/lib/engine";
import { Heading } from "./Heading";
import type { TabId } from "./tabs";
import { ALL_TASKS_DONE } from "./TimelineSummary";
import { TipsSection } from "./TipsSection";

/** How much of each chapter the overview previews. */
const SWATCHES_PER_IDEA = 4;
const TOP_BUDGET_LINES = 4;
const UPCOMING_TASKS = 3;
const VENDORS_TO_BOOK = 3;

type Props = { plan: PublicPlan; lang?: string; onOpen: (tab: TabId) => void };

/** The plan at a glance: concepts, money, what's next and who to book — one screen. */
export function PlanOverview({ plan, lang, onOpen }: Props) {
  return (
    <section aria-labelledby="overview-title" className="flex flex-col gap-10">
      <Heading depth={1} id="overview-title" className="sr-only">
        Plan overview
      </Heading>
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

type CardProps = { title: string; action: string; onOpen: () => void; children: ReactNode };

/** One overview card with a button that opens its chapter. */
function Card({ title, action, onOpen, children }: CardProps) {
  return (
    <article className="panel flex flex-col gap-5 p-6 sm:p-7">
      <Heading depth={2} className="eyebrow text-cream">
        {title}
      </Heading>
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
      {plan.ai.ideas.map((idea, index) => (
        <li key={index} className="flex items-center gap-4">
          <span aria-hidden="true" data-print-keep="" className="flex shrink-0 -space-x-1.5">
            {idea.palette.slice(0, SWATCHES_PER_IDEA).map((hex, swatch) => (
              // A 20 px disc with an espresso rim; the colour is an SVG attribute, not a style.
              <svg key={swatch} viewBox="0 0 20 20" className="size-5">
                <circle cx="10" cy="10" r="9.5" fill={hex} className="stroke-espresso" />
              </svg>
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
  const { budgetINR, guests } = plan.input;
  return (
    <div className="flex flex-col gap-4">
      <p className="h3 tabular">{formatINR(budgetINR)}</p>
      <ul className="flex flex-col gap-3">
        {plan.budget.slice(0, TOP_BUDGET_LINES).map((line) => (
          <li key={line.category} className="flex flex-col gap-1">
            <span className="flex justify-between gap-3 text-sm">
              <span className="font-semibold">{CATEGORY_LABELS[line.category]}</span>
              <span className="tabular">
                {formatINR(line.amountINR)} · {formatPercent(line.percent)}
              </span>
            </span>
            <span aria-hidden="true" className="h-2 rounded-full bg-line/60">
              {/* Width from an attribute, colour and pattern from globals.css: no inline style. */}
              <svg
                data-print-keep=""
                data-category-fill={line.category}
                width={`${Math.min(100, line.percent)}%`}
                className="block h-full rounded-full"
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        {formatINR(plan.contingencyINR)} held back as contingency ·{" "}
        {formatINR(amountPerGuest(budgetINR, guests))} per guest
      </p>
    </div>
  );
}

function NextGlance({ plan, lang }: { plan: PublicPlan; lang?: string }) {
  const stats = progress(plan.timeline);
  const upcoming = nextActions(plan.timeline, UPCOMING_TASKS);
  return (
    <div className="flex flex-col gap-4">
      <p className="tabular font-semibold">
        {stats.done} of {stats.total} tasks done
      </p>
      <progress max={stats.total} value={stats.done} aria-label="Tasks done" className="meter" />
      {upcoming.length === 0 ? (
        <p>{ALL_TASKS_DONE}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {upcoming.map((task) => (
            <li key={task.id} className="flex items-baseline gap-3">
              <span className="tabular w-14 shrink-0 font-mono text-sm text-gold">
                {formatDateShort(task.due)}
              </span>
              <span lang={lang} className="font-semibold">
                {task.title}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function VendorGlance({ plan }: { plan: PublicPlan }) {
  const stats = progress(plan.vendors);
  const toBook = plan.vendors.filter((vendor) => !vendor.done).slice(0, VENDORS_TO_BOOK);
  return (
    <div className="flex flex-col gap-4">
      <p className="tabular font-semibold">
        {stats.done} of {stats.total} booked
      </p>
      {toBook.length === 0 ? (
        <p>Every vendor is booked.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {toBook.map((vendor) => (
            <li key={vendor.category} className="flex items-baseline gap-3">
              <span className="tabular w-14 shrink-0 font-mono text-sm text-gold">
                {formatDateShort(vendor.bookBy)}
              </span>
              <span className="font-semibold">{CATEGORY_LABELS[vendor.category]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
