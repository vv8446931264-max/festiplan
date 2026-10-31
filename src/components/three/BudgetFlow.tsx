"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BudgetCategory } from "@/lib/contracts";
import type { BudgetFlowScene } from "@/three/budget-flow-scene";
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
 * has drawn its first frame.
 */
export function BudgetFlow({ allocations, highlight, onHighlight, className }: BudgetFlowProps) {
  const tier = useTier();
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

  const aspect = className?.includes("aspect-") ? undefined : "4 / 3";
  return (
    <div
      ref={host}
      aria-hidden="true"
      data-budget-flow={tier ?? "pending"}
      className={className}
      style={{ position: "relative", aspectRatio: aspect, overflow: "hidden" }}
    >
      <BudgetFlowFallback
        allocations={allocations}
        highlight={highlight}
        hidden={ready && tier !== "off"}
        onHighlight={onHighlight}
      />
    </div>
  );
}
