"use client";

import { useId, useState } from "react";
import { CATEGORY_LABELS, LIMITS } from "@/lib/contracts/constants";
import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { formatINR, formatPercent } from "@/lib/engine";

/** Shown in place of a figure that has not been recorded yet. */
export const NOT_RECORDED = "—";

/** A rupee difference with an explicit plus sign for overspend. */
export function formatSignedINR(amountINR: number): string {
  return amountINR > 0 ? `+${formatINR(amountINR)}` : formatINR(amountINR);
}

type OnActual = (category: BudgetCategory, actualINR: number | null) => void;

type Props = {
  allocation: Allocation;
  /** Actual minus planned spend, or null until something has been spent. */
  varianceINR: number | null;
  editable: boolean;
  highlight: BudgetCategory | null;
  onHighlight: (category: BudgetCategory | null) => void;
  onActual: OnActual;
};

/** One category: planned amount, share, per guest, spend so far and the difference. */
export function BudgetRow({ allocation, varianceINR, highlight, onHighlight, ...spend }: Props) {
  const { category } = allocation;
  const overspent = varianceINR !== null && varianceINR > 0;
  return (
    <tr
      onPointerEnter={() => onHighlight(category)}
      onPointerLeave={() => onHighlight(null)}
      className={`border-b border-line/50 transition-colors ${highlight === category ? "bg-brown" : ""}`}
    >
      <th scope="row" className="px-5 py-3 font-semibold">
        {CATEGORY_LABELS[category]}
        <span className="block text-xs font-normal text-muted">{allocation.rationale}</span>
      </th>
      <td className="px-3 py-3 text-right font-bold">{formatINR(allocation.amountINR)}</td>
      <td className="px-3 py-3 text-right">{formatPercent(allocation.percent)}</td>
      <td className="px-3 py-3 text-right">{formatINR(allocation.perGuestINR)}</td>
      <ActualCell allocation={allocation} {...spend} />
      <td className={`px-5 py-3 text-right ${overspent ? "text-ember-bright" : ""}`}>
        {varianceINR === null ? NOT_RECORDED : formatSignedINR(varianceINR)}
      </td>
    </tr>
  );
}

type CellProps = { allocation: Allocation; editable: boolean; onActual: OnActual };

/** "Spent so far": an input for owners, plain text for everyone else. */
function ActualCell({ allocation, editable, onActual }: CellProps) {
  const { category, actualINR } = allocation;
  if (!editable) {
    return (
      <td className="px-3 py-3 text-right">
        {actualINR === null ? NOT_RECORDED : formatINR(actualINR)}
      </td>
    );
  }
  return (
    <td className="px-3 py-3 text-right">
      <ActualInput
        label={CATEGORY_LABELS[category]}
        value={actualINR}
        onCommit={(amountINR) => onActual(category, amountINR)}
      />
    </td>
  );
}

type ParsedSpend = { valid: true; amountINR: number | null } | { valid: false };

/** Reads a typed spend: blank clears it, otherwise whole rupees (₹ and commas allowed) up to the cap. */
function parseSpend(draft: string): ParsedSpend {
  const digits = draft.replace(/[₹,\s]/g, "");
  if (digits === "") return { valid: true, amountINR: null };
  const amountINR = Number(digits);
  const wholeRupees = /^\d+$/.test(digits) && Number.isSafeInteger(amountINR);
  return wholeRupees && amountINR <= LIMITS.budgetMax
    ? { valid: true, amountINR }
    : { valid: false };
}

type InputProps = {
  label: string;
  value: number | null;
  onCommit: (amountINR: number | null) => void;
};

/** "Spent so far" for owners: validates on blur or Enter, shows an inline error, saves real changes only. */
function ActualInput({ label, value, onCommit }: InputProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const commit = () => {
    const parsed = parseSpend(draft);
    if (!parsed.valid) {
      setError(`Enter whole rupees, up to ${formatINR(LIMITS.budgetMax)}.`);
      return;
    }
    setError(null);
    if (parsed.amountINR !== value) onCommit(parsed.amountINR);
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <input
        aria-label={`Spent so far on ${label}, in rupees`}
        inputMode="numeric"
        value={draft}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className="field min-h-11 w-32 py-1 text-right"
        placeholder="₹0"
      />
      {error && (
        <p id={errorId} className="max-w-48 text-right text-xs font-semibold text-ember-bright">
          {error}
        </p>
      )}
    </div>
  );
}
