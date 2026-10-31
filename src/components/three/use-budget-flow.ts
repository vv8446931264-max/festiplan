import { useEffect, type RefObject } from "react";
import type { BudgetCategory } from "@/lib/contracts";
import type { BudgetFlowOptions, BudgetFlowScene } from "@/three/budget-flow-scene";
import type { Tier } from "@/three/tier";
import type { FlowAllocation } from "./BudgetFlowFallback";
import { createSceneCanvas, observeActivity, observeSize } from "./dom";

/** Latest props, read by the scene callbacks without re-running the mount effect. */
export type FlowInputs = {
  allocations: readonly FlowAllocation[];
  highlight: BudgetCategory | null;
  onHighlight?: (category: BudgetCategory | null) => void;
};

type Create = (canvas: HTMLCanvasElement, options: BudgetFlowOptions) => BudgetFlowScene;
type Refs = {
  host: RefObject<HTMLDivElement | null>;
  scene: RefObject<BudgetFlowScene | null>;
  inputs: RefObject<FlowInputs>;
};

function mount(
  create: Create,
  host: HTMLElement,
  win: Window,
  tier: "high" | "low",
  refs: Refs,
  onReady: () => void,
): () => void {
  const canvas = createSceneCanvas(host.ownerDocument);
  host.appendChild(canvas);
  let scene: BudgetFlowScene;
  try {
    scene = create(canvas, {
      tier,
      onFirstFrame: () => {
        canvas.style.opacity = "1";
        onReady();
      },
    });
  } catch (error) {
    canvas.remove();
    throw error;
  }
  scene.setAllocations(refs.inputs.current.allocations);
  scene.setHighlight(refs.inputs.current.highlight);
  refs.scene.current = scene;
  const offHover = scene.onHover((category) => refs.inputs.current.onHighlight?.(category));
  const offSize = observeSize(host, win, (w, h) => scene.resize(w, h));
  return () => {
    offHover();
    offSize();
    refs.scene.current = null;
    scene.dispose();
    canvas.remove();
  };
}

/**
 * Import the Budget Flow chunk the first time the box comes within 200 px of the
 * viewport, then run it only while visible (tab shown and on screen).
 */
export function useBudgetFlowScene(tier: Tier | null, refs: Refs, onReady: () => void): void {
  useEffect(() => {
    const host = refs.host.current;
    if (!host || (tier !== "high" && tier !== "low")) return;
    const win = host.ownerDocument.defaultView ?? window;
    let cancelled = false;
    let requested = false;
    let active = false;
    let teardown: (() => void) | null = null;
    const load = () => {
      requested = true;
      import("@/three/budget-flow-scene")
        .then((mod) => {
          if (cancelled) return;
          teardown = mount(mod.createBudgetFlowScene, host, win, tier, refs, onReady);
          if (!active) refs.scene.current?.pause();
        })
        .catch(() => undefined);
    };
    const stop = observeActivity(
      host,
      win,
      (next) => {
        active = next;
        if (next && !requested) load();
        if (next) refs.scene.current?.resume();
        else refs.scene.current?.pause();
      },
      "200px",
    );
    return () => {
      cancelled = true;
      stop();
      teardown?.();
    };
  }, [tier, refs, onReady]);
}
