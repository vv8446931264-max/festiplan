"use client";

import type { ReactNode } from "react";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { Allocation, BudgetCategory, PublicPlan } from "@/lib/contracts";
import {
  budgetVariance,
  formatINR,
  formatPercent,
  overspendAlerts,
  type OverspendAlert,
} from "@/lib/engine";
import { BudgetRow, formatSignedINR, NOT_RECORDED } from "./BudgetRow";

type Props = {
  input: PublicPlan["input"];
  budget: Allocation[];
  contingencyINR: number;
  editable: boolean;
  highlight: BudgetCategory | null;
  onHighlight: (category: BudgetCategory | null) => void;
  onActual: (category: BudgetCategory, actualINR: number | null) => void;
};

const CAPTION_ID = "budget-table-caption";
const NUMERIC_COLUMNS = ["Planned", "Share", "Per guest", "Spent so far"];

/** The accessible source of truth: planned vs actual per category, with totals. */
export function BudgetTable({ input, budget, contingencyINR, ...rowProps }: Props) {
  const variance = budgetVariance(budget);
  return (
    <div className="mt-10">
      <ScrollableTable caption={`Planned vs actual · ${input.guests} guests`}>
        <TableHead />
        <tbody>
          {budget.map((allocation, index) => (
            <BudgetRow
              key={allocation.category}
              allocation={allocation}
              varianceINR={variance.rows[index]?.varianceINR ?? null}
              {...rowProps}
            />
          ))}
        </tbody>
        <Totals
          input={input}
          contingencyINR={contingencyINR}
          actualINR={variance.actualINR}
          varianceINR={variance.varianceINR}
        />
      </ScrollableTable>
      <OverspendAlerts alerts={overspendAlerts(budget, contingencyINR)} />
    </div>
  );
}

/** A focusable, labelled scroll region, so keyboard users can scroll the wide table. */
function ScrollableTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="panel overflow-x-auto" role="region" aria-labelledby={CAPTION_ID} tabIndex={0}>
      <table className="tabular w-full min-w-[640px] border-collapse text-left">
        <caption id={CAPTION_ID} className="eyebrow p-5 text-left">
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

function TableHead() {
  return (
    <thead className="text-sm text-muted">
      <tr className="border-b border-line">
        <th scope="col" className="px-5 py-3 font-semibold">
          Category
        </th>
        {NUMERIC_COLUMNS.map((column) => (
          <th key={column} scope="col" className="px-3 py-3 text-right font-semibold">
            {column}
          </th>
        ))}
        <th scope="col" className="px-5 py-3 text-right font-semibold">
          Difference
        </th>
      </tr>
    </thead>
  );
}

type TotalsProps = {
  input: PublicPlan["input"];
  contingencyINR: number;
  actualINR: number;
  varianceINR: number;
};

/** Contingency and grand-total rows; spend columns stay empty until something is spent. */
function Totals({ input, contingencyINR, actualINR, varianceINR }: TotalsProps) {
  const { budgetINR, guests } = input;
  const spent = actualINR > 0;
  return (
    <tfoot className="font-bold">
      <tr className="border-t border-line">
        <th scope="row" className="px-5 py-3">
          Contingency
        </th>
        <td className="px-3 py-3 text-right">{formatINR(contingencyINR)}</td>
        <td className="px-3 py-3 text-right">
          {formatPercent((contingencyINR / budgetINR) * 100)}
        </td>
        <td colSpan={3} />
      </tr>
      <tr className="border-t border-line text-gold">
        <th scope="row" className="px-5 py-3">
          Total
        </th>
        <td className="px-3 py-3 text-right">{formatINR(budgetINR)}</td>
        <td className="px-3 py-3 text-right">100%</td>
        <td className="px-3 py-3 text-right">{formatINR(Math.round(budgetINR / guests))}</td>
        <td className="px-3 py-3 text-right">{spent ? formatINR(actualINR) : NOT_RECORDED}</td>
        <td className="px-5 py-3 text-right">
          {spent ? formatSignedINR(varianceINR) : NOT_RECORDED}
        </td>
      </tr>
    </tfoot>
  );
}

/** Lines that are over plan, and whether the contingency still covers them. */
function OverspendAlerts({ alerts }: { alerts: OverspendAlert[] }) {
  return (
    <div role="status" aria-live="polite">
      {alerts.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {alerts.map((alert) => (
            <li key={alert.category} className="rounded-2xl border border-ember-bright px-4 py-3">
              <strong>{CATEGORY_LABELS[alert.category]}</strong> is {formatINR(alert.overByINR)}{" "}
              over plan —{" "}
              {alert.coveredByContingency
                ? "the contingency still covers it."
                : "that's more than the contingency left."}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
