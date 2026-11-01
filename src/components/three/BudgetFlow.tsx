"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BudgetCategory } from "@/lib/contracts";
import type { BudgetFlowScene } from "@/three/budget-flow-scene";
import type { Tier } from "@/three/tier";
import { useAnimationPaused } from "./animation-pause";
import { BudgetFlowFallback, type FlowAllocation } from "./BudgetFlowFallback";
import { useBudgetFlowScene, type FlowInputs } from "./use-budget-flow";
import { useTier } from "./use-tier";

/** Props for {@link BudgetFlow}. */
export type BudgetFlowProps = {
  /** Budget lines (extra Allocation fields are ignored). */
  allocations: readonly FlowAllocation[];
  /** Category to brighten (mirrors the table/slider row in focus or hover). */
  highlight: BudgetCategory | null;
  /** Hovering a column reports its category; leaving reports null. */
  onHighlight?: (category: BudgetCategory | null) => void;
  /** Box classes. Include an `aspect-*` class; without one the box is 4:3. */
  className?: string;
};

/**
 * Budget Flow (docs/DESIGN.md §6): rupee particles flowing into glass columns.
 * Decorative and aria-hidden — the accessible table lives next to it. The box has
 * a fixed aspect ratio (no layout shift); a static SVG of the same shares shows on
 * tier "off" and until the WebGL chunk, loaded when the box nears the viewport,
 * has drawn its first frame. "Pause animation" (WCAG 2.2.2) shows the static chart;
 * resuming mounts a fresh scene.
 */
export function BudgetFlow(props: BudgetFlowProps) {
  const paused = useAnimationPaused();
  const tier = useTier();
  return <FlowStage key={paused ? "paused" : "live"} {...props} tier={paused ? "off" : tier} />;
}

/** The flow box for one tier: the static chart until, and unless, the live scene draws. */
function FlowStage({
  allocations,
  highlight,
  onHighlight,
  className,
  tier,
}: BudgetFlowProps & { tier: Tier | null }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BudgetFlowScene | null>(null);
  const inputs = useRef<FlowInputs>({ allocations, highlight, onHighlight });
  const refs = useMemo(() => ({ host, scene, inputs }), []);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    inputs.current = { allocations, highlight, onHighlight };
  });
  useEffect(() => {
    scene.current?.setAllocations(allocations);
  }, [allocations]);
  useEffect(() => {
    scene.current?.setHighlight(highlight);
  }, [highlight]);
  useBudgetFlowScene(tier, refs, onReady);

  // Classes, not a style attribute (the CSP allows no inline styles); 4:3 unless the caller sized it.
  const sized = className?.includes("aspect-") ?? false;
  const box = `relative overflow-hidden ${sized ? "" : "aspect-[4/3] "}${className ?? ""}`.trim();
  return (
    <div ref={host} aria-hidden="true" data-budget-flow={tier ?? "pending"} className={box}>
      <BudgetFlowFallback
        allocations={allocations}
        highlight={highlight}
        hidden={ready && tier !== "off"}
        onHighlight={onHighlight}
      />
    </div>
  );
}
