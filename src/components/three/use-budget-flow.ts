import { useEffect, type RefObject } from "react";
import type { BudgetCategory } from "@/lib/contracts";
import type { BudgetFlowOptions, BudgetFlowScene } from "@/three/budget-flow-scene";
import type { Tier } from "@/three/tier";
import type { FlowAllocation } from "./BudgetFlowFallback";
import { attachSceneCanvas, observeActivity, observeSize } from "./dom";

/** Latest props, read by the scene callbacks without re-running the mount effect. */
export type FlowInputs = {
  allocations: readonly FlowAllocation[];
  highlight: BudgetCategory | null;
  onHighlight?: (category: BudgetCategory | null) => void;
};

type CreateScene = (canvas: HTMLCanvasElement, options: BudgetFlowOptions) => BudgetFlowScene;
type Refs = {
  host: RefObject<HTMLDivElement | null>;
  scene: RefObject<BudgetFlowScene | null>;
  inputs: RefObject<FlowInputs>;
};

/** Start loading the scene chunk this far before the box scrolls into view. */
const PRELOAD_MARGIN = "200px";

function mount(
  createScene: CreateScene,
  host: HTMLElement,
  win: Window,
  tier: "high" | "low",
  refs: Refs,
  onReady: () => void,
): () => void {
  const { scene, canvas } = attachSceneCanvas(host, (target) =>
    createScene(target, {
      tier,
      onFirstFrame: () => {
        target.style.opacity = "1";
        onReady();
      },
    }),
  );
  scene.setAllocations(refs.inputs.current.allocations);
  scene.setHighlight(refs.inputs.current.highlight);
  refs.scene.current = scene;
  const stopHover = scene.onHover((category) => refs.inputs.current.onHighlight?.(category));
  const stopResize = observeSize(host, win, (width, height) => scene.resize(width, height));
  return () => {
    stopHover();
    stopResize();
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
        .then((sceneModule) => {
          if (cancelled) return;
          teardown = mount(sceneModule.createBudgetFlowScene, host, win, tier, refs, onReady);
          if (!active) refs.scene.current?.pause();
        })
        .catch(() => undefined);
    };
    const onActivity = (visible: boolean) => {
      active = visible;
      if (visible && !requested) load();
      if (visible) refs.scene.current?.resume();
      else refs.scene.current?.pause();
    };
    const stopObserving = observeActivity(host, win, onActivity, PRELOAD_MARGIN);
    return () => {
      cancelled = true;
      stopObserving();
      teardown?.();
    };
  }, [tier, refs, onReady]);
}
