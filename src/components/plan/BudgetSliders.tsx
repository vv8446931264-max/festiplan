"use client";

import { CATEGORY_COLORS, CATEGORY_PATTERNS } from "@/lib/category-style";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import type { Allocation, BudgetCategory } from "@/lib/contracts";
import { formatINR, formatPercent } from "@/lib/engine";

type Handlers = {
  onHighlight: (category: BudgetCategory | null) => void;
  onMove: (category: BudgetCategory, amountINR: number) => void;
  onLock: (category: BudgetCategory, locked: boolean) => void;
};
type Shared = Handlers & { editable: boolean; highlight: BudgetCategory | null };
type Props = Shared & { allocations: Allocation[]; totalINR: number };

/** Slider granularity by budget size (largest first), so drags stay smooth at any budget. */
const SLIDER_STEPS = [
  { fromINR: 1_000_000, stepINR: 1000 },
  { fromINR: 100_000, stepINR: 500 },
  { fromINR: 10_000, stepINR: 100 },
] as const;
const SMALLEST_STEP_INR = 10;

const sliderStep = (totalINR: number) =>
  SLIDER_STEPS.find((tier) => totalINR >= tier.fromINR)?.stepINR ?? SMALLEST_STEP_INR;

const sumOf = (lines: Allocation[]) => lines.reduce((sum, line) => sum + line.amountINR, 0);

/** One native range input per category; owners can lock lines they've already booked. */
export function BudgetSliders({ allocations, totalINR, ...shared }: Props) {
  const distributableINR = sumOf(allocations);
  const lockedINR = sumOf(allocations.filter((line) => line.locked));
  return (
    <ul className="flex flex-col gap-1" aria-label="Budget by category">
      {allocations.map((allocation) => (
        <SliderRow
          key={allocation.category}
          allocation={allocation}
          // A line can grow until every other unlocked line is down to zero.
          max={distributableINR - lockedINR + (allocation.locked ? allocation.amountINR : 0)}
          distributableINR={distributableINR}
          step={sliderStep(totalINR)}
          {...shared}
        />
      ))}
    </ul>
  );
}

type RowProps = Shared & {
  allocation: Allocation;
  max: number;
  distributableINR: number;
  step: number;
};

function SliderRow({
  allocation,
  editable,
  highlight,
  distributableINR,
  onHighlight,
  ...controls
}: RowProps) {
  const { category, amountINR } = allocation;
  const inputId = `slider-${category}`;
  return (
    <li
      data-category={category}
      data-amount={amountINR}
      onPointerEnter={() => onHighlight(category)}
      onPointerLeave={() => onHighlight(null)}
      className={`rounded-2xl px-4 py-2 transition-colors ${highlight === category ? "bg-brown" : ""}`}
    >
      <SliderLabel allocation={allocation} inputId={inputId} />
      {editable ? (
        <SliderControls
          allocation={allocation}
          inputId={inputId}
          onHighlight={onHighlight}
          {...controls}
        />
      ) : (
        <meter
          id={inputId}
          min={0}
          max={distributableINR}
          value={amountINR}
          className="meter mt-2"
        />
      )}
    </li>
  );
}

/** Colour swatch with its pattern (readable without colour), label, amount and share. */
function SliderLabel({ allocation, inputId }: { allocation: Allocation; inputId: string }) {
  const { category } = allocation;
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        data-print-keep=""
        className="size-4 shrink-0 rounded-sm"
        style={{
          backgroundColor: CATEGORY_COLORS[category],
          backgroundImage: CATEGORY_PATTERNS[category],
        }}
      />
      <label htmlFor={inputId} className="font-semibold">
        {CATEGORY_LABELS[category]}
      </label>
      <span className="tabular ml-auto font-bold">{formatINR(allocation.amountINR)}</span>
      <span className="tabular w-14 text-right text-sm text-muted">
        {formatPercent(allocation.percent)}
      </span>
    </div>
  );
}

type ControlProps = Handlers & {
  allocation: Allocation;
  inputId: string;
  max: number;
  step: number;
};

/** The owner's range input, plus a lock for lines that are already booked. */
function SliderControls({ allocation, inputId, max, step, ...handlers }: ControlProps) {
  const { category, amountINR, locked } = allocation;
  return (
    <div className="flex items-center gap-3">
      <input
        id={inputId}
        type="range"
        min={0}
        max={max}
        step={step}
        value={amountINR}
        disabled={locked}
        aria-valuetext={formatINR(amountINR)}
        onFocus={() => handlers.onHighlight(category)}
        onBlur={() => handlers.onHighlight(null)}
        onChange={(event) => handlers.onMove(category, Number(event.target.value))}
      />
      <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-6 shrink-0"
          checked={locked}
          onChange={(event) => handlers.onLock(category, event.target.checked)}
        />
        Lock <span className="sr-only">{CATEGORY_LABELS[category]}</span>
      </label>
    </div>
  );
}
