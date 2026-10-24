"use client";

import { useState } from "react";
import { CATEGORY_LABELS, type Allocation, type BudgetCategory, type PublicPlan } from "@/lib/contracts";
import { budgetVariance, formatINR, formatPercent, overspendAlerts, type OverspendAlert } from "@/lib/engine";

type Props = {
  plan: PublicPlan;
  editable: boolean;
  highlight: BudgetCategory | null;
  onHighlight: (c: BudgetCategory | null) => void;
  onActual: (category: BudgetCategory, actualINR: number | null) => void;
};

const signed = (n: number) => (n > 0 ? `+${formatINR(n)}` : formatINR(n));

/** The accessible source of truth: planned vs actual per category, with totals. */
export function BudgetTable({ plan, editable, highlight, onHighlight, onActual }: Props) {
  const variance = budgetVariance(plan.budget);
  const alerts = overspendAlerts(plan.budget, plan.contingencyINR);
  return (
    <div className="mt-10">
      <div className="panel overflow-x-auto" role="region" aria-labelledby="budget-table-caption" tabIndex={0}>
        <table className="tabular w-full min-w-[640px] border-collapse text-left">
          <caption id="budget-table-caption" className="eyebrow p-5 text-left">
            Planned vs actual · {plan.input.guests} guests
          </caption>
          <thead className="text-sm text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-semibold">Category</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Planned</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Share</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Per guest</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Spent so far</th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">Difference</th>
            </tr>
          </thead>
          <tbody>
            {plan.budget.map((a, i) => (
              <Row key={a.category} a={a} variance={variance.rows[i]?.varianceINR ?? null} editable={editable}
                active={highlight === a.category} onHighlight={onHighlight} onActual={onActual} />
            ))}
          </tbody>
          <Totals plan={plan} actualINR={variance.actualINR} varianceINR={variance.varianceINR} />
        </table>
      </div>
      <Alerts alerts={alerts} />
    </div>
  );
}

function Totals({ plan, actualINR, varianceINR }: { plan: PublicPlan; actualINR: number; varianceINR: number }) {
  const { budgetINR, guests } = plan.input;
  return (
    <tfoot className="font-bold">
      <tr className="border-t border-line">
        <th scope="row" className="px-5 py-3">Contingency</th>
        <td className="px-3 py-3 text-right">{formatINR(plan.contingencyINR)}</td>
        <td className="px-3 py-3 text-right">{formatPercent((plan.contingencyINR / budgetINR) * 100)}</td>
        <td colSpan={3} />
      </tr>
      <tr className="border-t border-line text-gold">
        <th scope="row" className="px-5 py-3">Total</th>
        <td className="px-3 py-3 text-right">{formatINR(budgetINR)}</td>
        <td className="px-3 py-3 text-right">100%</td>
        <td className="px-3 py-3 text-right">{formatINR(Math.round(budgetINR / guests))}</td>
        <td className="px-3 py-3 text-right">{actualINR > 0 ? formatINR(actualINR) : "—"}</td>
        <td className="px-5 py-3 text-right">{actualINR > 0 ? signed(varianceINR) : "—"}</td>
      </tr>
    </tfoot>
  );
}

function Alerts({ alerts }: { alerts: OverspendAlert[] }) {
  return (
    <div role="status" aria-live="polite">
      {alerts.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {alerts.map((al) => (
            <li key={al.category} className="rounded-2xl border border-ember-bright px-4 py-3">
              <strong>{CATEGORY_LABELS[al.category]}</strong> is {formatINR(al.overByINR)} over plan —{" "}
              {al.coveredByContingency ? "the contingency still covers it." : "that's more than the contingency left."}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type RowProps = {
  a: Allocation;
  variance: number | null;
  editable: boolean;
  active: boolean;
  onHighlight: (c: BudgetCategory | null) => void;
  onActual: (category: BudgetCategory, actualINR: number | null) => void;
};

function Row({ a, variance, editable, active, onHighlight, onActual }: RowProps) {
  const label = CATEGORY_LABELS[a.category];
  return (
    <tr onPointerEnter={() => onHighlight(a.category)} onPointerLeave={() => onHighlight(null)}
      className={`border-b border-line/50 transition-colors ${active ? "bg-brown" : ""}`}>
      <th scope="row" className="px-5 py-3 font-semibold">
        {label}
        <span className="block text-xs font-normal text-muted">{a.rationale}</span>
      </th>
      <td className="px-3 py-3 text-right font-bold">{formatINR(a.amountINR)}</td>
      <td className="px-3 py-3 text-right">{formatPercent(a.percent)}</td>
      <td className="px-3 py-3 text-right">{formatINR(a.perGuestINR)}</td>
      <td className="px-3 py-3 text-right">
        {editable ? <ActualInput label={label} value={a.actualINR} onCommit={(v) => onActual(a.category, v)} /> : a.actualINR === null ? "—" : formatINR(a.actualINR)}
      </td>
      <td className={`px-5 py-3 text-right ${variance !== null && variance > 0 ? "text-ember-bright" : ""}`}>
        {variance === null ? "—" : signed(variance)}
      </td>
    </tr>
  );
}

function ActualInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const commit = () => {
    const cleaned = draft.replace(/[₹,\s]/g, "");
    if (cleaned === "") return onCommit(null);
    if (/^\d{1,9}$/.test(cleaned)) onCommit(Number(cleaned));
  };
  return (
    <input aria-label={`Spent so far on ${label}, in rupees`} inputMode="numeric" value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="field ml-auto w-32 min-h-11 py-1 text-right" placeholder="₹0" />
  );
}
