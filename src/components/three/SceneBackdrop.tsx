"use client";

import { useRef, useState } from "react";
import type { LanternScene } from "@/three/lantern-scene";
import { useAnimationPaused } from "./animation-pause";
import { DuskSky } from "./DuskSky";
import { useLanternScene, useSkyScroll } from "./use-lantern-scene";
import { useTier } from "./use-tier";

/**
 * The persistent background (docs/DESIGN.md §5–7): a fixed, aria-hidden,
 * pointer-events-none layer under all content. Always paints the CSS dusk sky;
 * on tier "off" (reduced motion, Save-Data, ≤ 4 cores, no WebGL), while the
 * visitor has pressed "Pause animation", or if WebGL fails, adds the static poster
 * captured from the real scene and runs no scene at all. Otherwise the lantern
 * scene chunk is imported after first paint and runs paused whenever the tab is
 * hidden. Pausing disposes the scene (its render loop stops for good); resuming
 * mounts a fresh one. Scroll stays native; the scene only listens.
 */
export function SceneBackdrop() {
  const tier = useTier();
  const paused = useAnimationPaused();
  const rootRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LanternScene | null>(null);
  const [failed, setFailed] = useState(false);
  const still = tier === "off" || paused || failed;
  useSkyScroll(skyRef, sceneRef);
  useLanternScene(still ? "off" : tier, rootRef, sceneRef, () => setFailed(true));
  return <DuskSky rootRef={rootRef} skyRef={skyRef} tier={tier ?? "pending"} poster={still} />;
}
