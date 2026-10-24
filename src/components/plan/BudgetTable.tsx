"use client";

import { useId, useState } from "react";
import { CATEGORY_LABELS, LIMITS } from "@/lib/contracts/constants";
import type { Allocation, BudgetCategory, PublicPlan } from "@/lib/contracts";
import { budgetVariance, formatINR, formatPercent, overspendAlerts, type OverspendAlert } from "@/lib/engine";

type Props = {
  input: PublicPlan["input"];
  budget: Allocation[];
  contingencyINR: number;
  editable: boolean;
  highlight: BudgetCategory | null;
  onHighlight: (c: BudgetCategory | null) => void;
  onActual: (category: BudgetCategory, actualINR: number | null) => void;
};

const signed = (n: number) => (n > 0 ? `+${formatINR(n)}` : formatINR(n));

/** The accessible source of truth: planned vs actual per category, with totals. */
export function BudgetTable({ input, budget, contingencyINR, editable, highlight, onHighlight, onActual }: Props) {
  const variance = budgetVariance(budget);
  const alerts = overspendAlerts(budget, contingencyINR);
  return (
    <div className="mt-10">
      <div className="panel overflow-x-auto" role="region" aria-labelledby="budget-table-caption" tabIndex={0}>
        <table className="tabular w-full min-w-[640px] border-collapse text-left">
          <caption id="budget-table-caption" className="eyebrow p-5 text-left">
            Planned vs actual · {input.guests} guests
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
            {budget.map((a, i) => (
              <Row key={a.category} a={a} variance={variance.rows[i]?.varianceINR ?? null} editable={editable}
                active={highlight === a.category} onHighlight={onHighlight} onActual={onActual} />
            ))}
          </tbody>
          <Totals input={input} contingencyINR={contingencyINR} actualINR={variance.actualINR} varianceINR={variance.varianceINR} />
        </table>
      </div>
      <Alerts alerts={alerts} />
    </div>
  );
}

type TotalsProps = { input: PublicPlan["input"]; contingencyINR: number; actualINR: number; varianceINR: number };

function Totals({ input, contingencyINR, actualINR, varianceINR }: TotalsProps) {
  const { budgetINR, guests } = input;
  return (
    <tfoot className="font-bold">
      <tr className="border-t border-line">
        <th scope="row" className="px-5 py-3">Contingency</th>
        <td className="px-3 py-3 text-right">{formatINR(contingencyINR)}</td>
        <td className="px-3 py-3 text-right">{formatPercent((contingencyINR / budgetINR) * 100)}</td>
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

type ActualProps = { label: string; value: number | null; onCommit: (v: number | null) => void };

/** "Spent so far": whole rupees up to the budget cap, inline error, saves only real changes. */
function ActualInput({ label, value, onCommit }: ActualProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const commit = () => {
    const cleaned = draft.replace(/[₹,\s]/g, "");
    const n = cleaned === "" ? null : /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
    if (n !== null && (!Number.isSafeInteger(n) || n > LIMITS.budgetMax)) {
      return setError(`Enter whole rupees, up to ${formatINR(LIMITS.budgetMax)}.`);
    }
    setError(null);
    if (n !== value) onCommit(n);
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <input aria-label={`Spent so far on ${label}, in rupees`} inputMode="numeric" value={draft}
        aria-invalid={error !== null} aria-describedby={error ? errorId : undefined}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="field w-32 min-h-11 py-1 text-right" placeholder="₹0" />
      {error && <p id={errorId} className="max-w-48 text-right text-xs font-semibold text-ember-bright">{error}</p>}
    </div>
  );
}
