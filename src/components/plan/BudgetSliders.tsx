"use client";

import { CATEGORY_COLORS, CATEGORY_PATTERNS } from "@/lib/category-style";
import { CATEGORY_LABELS, type Allocation, type BudgetCategory } from "@/lib/contracts";
import { formatINR, formatPercent } from "@/lib/engine";

type Shared = {
  editable: boolean;
  highlight: BudgetCategory | null;
  onHighlight: (c: BudgetCategory | null) => void;
  onMove: (category: BudgetCategory, amountINR: number) => void;
  onLock: (category: BudgetCategory, locked: boolean) => void;
};
type Props = Shared & { allocations: Allocation[]; totalINR: number };

/** Slider granularity that keeps drags smooth at any budget size. */
export function sliderStep(totalINR: number): number {
  if (totalINR >= 1_000_000) return 1000;
  if (totalINR >= 100_000) return 500;
  if (totalINR >= 10_000) return 100;
  return 10;
}

/** One native range input per category; owners can lock lines they've already booked. */
export function BudgetSliders({ allocations, totalINR, ...shared }: Props) {
  const distributable = allocations.reduce((s, a) => s + a.amountINR, 0);
  const lockedTotal = allocations.filter((a) => a.locked).reduce((s, a) => s + a.amountINR, 0);
  return (
    <ul className="flex flex-col gap-1" aria-label="Budget by category">
      {allocations.map((a) => (
        <SliderRow
          key={a.category}
          allocation={a}
          max={distributable - lockedTotal + (a.locked ? a.amountINR : 0)}
          distributable={distributable}
          step={sliderStep(totalINR)}
          {...shared}
        />
      ))}
    </ul>
  );
}

type RowProps = Shared & { allocation: Allocation; max: number; distributable: number; step: number };

function SliderRow({ allocation: a, max, distributable, step, editable, highlight, onHighlight, onMove, onLock }: RowProps) {
  const id = `slider-${a.category}`;
  const label = CATEGORY_LABELS[a.category];
  return (
    <li data-category={a.category} data-amount={a.amountINR}
      onPointerEnter={() => onHighlight(a.category)} onPointerLeave={() => onHighlight(null)}
      className={`rounded-2xl px-4 py-2 transition-colors ${highlight === a.category ? "bg-brown" : ""}`}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="size-4 shrink-0 rounded-sm"
          style={{ backgroundColor: CATEGORY_COLORS[a.category], backgroundImage: CATEGORY_PATTERNS[a.category] }} />
        <label htmlFor={id} className="font-semibold">{label}</label>
        <span className="tabular ml-auto font-bold">{formatINR(a.amountINR)}</span>
        <span className="tabular w-14 text-right text-sm text-muted">{formatPercent(a.percent)}</span>
      </div>
      {editable ? (
        <div className="flex items-center gap-3">
          <input id={id} type="range" min={0} max={max} step={step} value={a.amountINR}
            disabled={a.locked} aria-valuetext={formatINR(a.amountINR)}
            onFocus={() => onHighlight(a.category)} onBlur={() => onHighlight(null)}
            onChange={(e) => onMove(a.category, Number(e.target.value))} />
          <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={a.locked} onChange={(e) => onLock(a.category, e.target.checked)} />
            Lock{" "}<span className="sr-only">{label}</span>
          </label>
        </div>
      ) : (
        <meter id={id} min={0} max={distributable} value={a.amountINR} className="meter mt-2" />
      )}
    </li>
  );
}
