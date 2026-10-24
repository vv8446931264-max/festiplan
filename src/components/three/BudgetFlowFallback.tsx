import type { BudgetCategory } from "@/lib/contracts";
import { CATEGORY_COLORS } from "@/lib/category-style";

/** One budget line as the flow visual needs it. */
export type FlowAllocation = { category: BudgetCategory; amountINR: number };

type Props = {
  allocations: readonly FlowAllocation[];
  highlight: BudgetCategory | null;
  /** Fade out once the WebGL canvas has its first frame. */
  hidden: boolean;
  onHighlight?: (category: BudgetCategory | null) => void;
};

const FLOOR = 68;
const MAX_H = 60;

type BarProps = { category: BudgetCategory; x: number; width: number; height: number; state: "normal" | "lit" | "dim"; onHighlight?: Props["onHighlight"] };

/** One glass-shaded bar: category fill, cylinder shading overlay, cream lip. */
function Bar({ category, x, width, height, state, onHighlight }: BarProps) {
  const y = FLOOR - height;
  return (
    <g
      data-category={category}
      opacity={state === "dim" ? 0.38 : 1}
      onPointerEnter={() => onHighlight?.(category)}
      onPointerLeave={() => onHighlight?.(null)}
    >
      <rect x={x} y={y} width={width} height={height} rx={1.4} fill={CATEGORY_COLORS[category]} fillOpacity={0.78} />
      <rect x={x} y={y} width={width} height={height} rx={1.4} fill="url(#festiplan-flow-glass)" />
      <rect x={x} y={y} width={width} height={0.9} rx={0.45} fill="#ffedd7" fillOpacity={state === "lit" ? 0.9 : 0.35} />
    </g>
  );
}

const GLASS = (
  <linearGradient id="festiplan-flow-glass" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stopColor="#100904" stopOpacity="0.45" />
    <stop offset="0.35" stopColor="#ffedd7" stopOpacity="0.18" />
    <stop offset="0.6" stopColor="#ffedd7" stopOpacity="0.04" />
    <stop offset="1" stopColor="#100904" stopOpacity="0.5" />
  </linearGradient>
);

/**
 * Static SVG rendering of the same shares (tier "off", and the placeholder while
 * the WebGL chunk loads): glass-shaded bars in CATEGORY_COLORS, heights scaled
 * exactly like the 3D columns (the tallest of 40 % or the largest share fills the
 * frame). Decorative — the parent is aria-hidden; the table is the source of truth.
 */
export function BudgetFlowFallback({ allocations, highlight, hidden, onHighlight }: Props) {
  const amounts = allocations.map((a) => (Number.isFinite(a.amountINR) && a.amountINR > 0 ? a.amountINR : 0));
  const total = amounts.reduce((s, a) => s + a, 0);
  const shares = amounts.map((a) => (total > 0 ? a / total : 0));
  const scale = Math.max(0.4, ...shares);
  const slot = 100 / Math.max(allocations.length, 1);
  const width = slot * 0.58;
  const style = { position: "absolute", inset: 0, opacity: hidden ? 0 : 1, transition: "opacity 600ms ease" } as const;
  return (
    <svg viewBox="0 0 100 75" width="100%" height="100%" focusable="false" data-flow-fallback="" style={style}>
      <defs>{GLASS}</defs>
      {allocations.map((a, i) => (
        <Bar
          key={a.category}
          category={a.category}
          x={i * slot + (slot - width) / 2}
          width={width}
          height={Math.max((shares[i] / scale) * MAX_H, 0.8)}
          state={highlight === a.category ? "lit" : highlight === null ? "normal" : "dim"}
          onHighlight={onHighlight}
        />
      ))}
      <line x1="2" x2="98" y1={FLOOR + 0.4} y2={FLOOR + 0.4} stroke="#6c5f51" strokeWidth="0.3" />
    </svg>
  );
}
