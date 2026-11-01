import type { BudgetCategory } from "@/lib/contracts";
import { CATEGORY_COLORS } from "@/lib/category-style";
import { BRAND_COLORS } from "@/lib/site";
import { emphasisOf, type Emphasis } from "@/three/emphasis";

/** One budget line as the flow visual needs it. */
export type FlowAllocation = { category: BudgetCategory; amountINR: number };

type Props = {
  allocations: readonly FlowAllocation[];
  highlight: BudgetCategory | null;
  /** Fade out once the WebGL canvas has its first frame. */
  hidden: boolean;
  onHighlight?: (category: BudgetCategory | null) => void;
};

/** SVG geometry in viewBox units. */
const VIEW = { width: 100, height: 75, floorY: 68, maxBarHeight: 60, minBarHeight: 0.8 } as const;
/** A share this large (or the largest share, if bigger) fills the full bar height. */
const FULL_HEIGHT_SHARE = 0.4;
const BAR = {
  /** Bar width as a fraction of its slot; the rest is the gap between bars. */
  widthRatio: 0.58,
  cornerRadius: 1.4,
  fillOpacity: 0.78,
  dimmedOpacity: 0.38,
  /** The cream rim on top of each bar. */
  lipHeight: 0.9,
  lipOpacity: { lit: 0.9, other: 0.35 },
} as const;
const FLOOR_LINE = { inset: 2, drop: 0.4, strokeWidth: 0.3, color: "#6c5f51" } as const;
const GLASS_GRADIENT_ID = "festiplan-flow-glass";

type BarGeometry = { category: BudgetCategory; x: number; width: number; height: number };

/** One bar per allocation, height ∝ share; invalid or negative amounts count as zero. */
function layoutBars(allocations: readonly FlowAllocation[]): BarGeometry[] {
  const amounts = allocations.map(({ amountINR }) =>
    Number.isFinite(amountINR) && amountINR > 0 ? amountINR : 0,
  );
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const shares = amounts.map((amount) => (total > 0 ? amount / total : 0));
  const fullHeightShare = Math.max(FULL_HEIGHT_SHARE, ...shares);
  const slot = VIEW.width / Math.max(allocations.length, 1);
  const width = slot * BAR.widthRatio;
  return allocations.map(({ category }, index) => ({
    category,
    x: index * slot + (slot - width) / 2,
    width,
    height: Math.max((shares[index] / fullHeightShare) * VIEW.maxBarHeight, VIEW.minBarHeight),
  }));
}

type BarProps = BarGeometry & { emphasis: Emphasis; onHighlight?: Props["onHighlight"] };

/** One glass-shaded bar: category fill, cylinder shading overlay, cream lip. */
function Bar({ category, x, width, height, emphasis, onHighlight }: BarProps) {
  const top = VIEW.floorY - height;
  const box = { x, y: top, width, rx: BAR.cornerRadius };
  return (
    <g
      data-category={category}
      opacity={emphasis === "dimmed" ? BAR.dimmedOpacity : 1}
      onPointerEnter={() => onHighlight?.(category)}
      onPointerLeave={() => onHighlight?.(null)}
    >
      <rect
        {...box}
        height={height}
        fill={CATEGORY_COLORS[category]}
        fillOpacity={BAR.fillOpacity}
      />
      <rect {...box} height={height} fill={`url(#${GLASS_GRADIENT_ID})`} />
      <rect
        {...box}
        height={BAR.lipHeight}
        rx={BAR.lipHeight / 2}
        fill={BRAND_COLORS.cream}
        fillOpacity={emphasis === "lit" ? BAR.lipOpacity.lit : BAR.lipOpacity.other}
      />
    </g>
  );
}

/** Dark edges and a soft cream band: reads as light passing through a glass cylinder. */
const GLASS_GRADIENT = (
  <linearGradient id={GLASS_GRADIENT_ID} x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stopColor={BRAND_COLORS.espresso} stopOpacity="0.45" />
    <stop offset="0.35" stopColor={BRAND_COLORS.cream} stopOpacity="0.18" />
    <stop offset="0.6" stopColor={BRAND_COLORS.cream} stopOpacity="0.04" />
    <stop offset="1" stopColor={BRAND_COLORS.espresso} stopOpacity="0.5" />
  </linearGradient>
);

/**
 * Static SVG rendering of the budget shares (tier "off", and the placeholder while the WebGL
 * chunk loads): glass-shaded bars in CATEGORY_COLORS, heights ∝ share. Decorative — the parent
 * is aria-hidden; the table is the source of truth.
 */
export function BudgetFlowFallback({ allocations, highlight, hidden, onHighlight }: Props) {
  const floorLineY = VIEW.floorY + FLOOR_LINE.drop;
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      width="100%"
      height="100%"
      focusable="false"
      data-flow-fallback=""
      // Fades out over 600 ms once the canvas draws; classes, as the CSP allows no inline styles.
      className={`absolute inset-0 transition-opacity duration-600 ease-[ease] ${hidden ? "opacity-0" : "opacity-100"}`}
    >
      <defs>{GLASS_GRADIENT}</defs>
      {layoutBars(allocations).map((bar) => (
        <Bar
          key={bar.category}
          {...bar}
          emphasis={emphasisOf(bar.category, highlight)}
          onHighlight={onHighlight}
        />
      ))}
      <line
        x1={FLOOR_LINE.inset}
        x2={VIEW.width - FLOOR_LINE.inset}
        y1={floorLineY}
        y2={floorLineY}
        stroke={FLOOR_LINE.color}
        strokeWidth={FLOOR_LINE.strokeWidth}
      />
    </svg>
  );
}
