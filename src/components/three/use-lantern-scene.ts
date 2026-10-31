import { useEffect, useRef, type RefObject } from "react";
import { getState, subscribe, type SceneEvent } from "@/three/bus";
import { lanternFade, skyFade } from "@/three/dusk";
import type { LanternScene, LanternSceneOptions } from "@/three/lantern-scene";
import type { Tier } from "@/three/tier";
import {
  attachSceneCanvas,
  nextFrame,
  observeActivity,
  observeSize,
  scrollProgress,
  whenIdle,
} from "./dom";

type CreateScene = (canvas: HTMLCanvasElement, options: LanternSceneOptions) => LanternScene;

function forward(scene: LanternScene, event: SceneEvent): void {
  if (event.type === "celebrate") scene.celebrate();
  else if (event.type === "palette") scene.setPalette(event.palette);
  else scene.setMood(event.mood);
}

function followPointer(win: Window, scene: LanternScene): () => void {
  const onMove = (event: PointerEvent) => {
    // Normalised device coordinates: -1..1 from left to right and from bottom to top.
    const x = (event.clientX / win.innerWidth) * 2 - 1;
    const y = 1 - (event.clientY / win.innerHeight) * 2;
    scene.setPointer(x, y);
  };
  win.addEventListener("pointermove", onMove, { passive: true });
  return () => win.removeEventListener("pointermove", onMove);
}

/** Create the scene on a fresh canvas, replay the bus state and wire every input; returns teardown. */
function mount(
  createScene: CreateScene,
  root: HTMLElement,
  win: Window,
  tier: "high" | "low",
  sceneRef: RefObject<LanternScene | null>,
): () => void {
  const { scene, canvas } = attachSceneCanvas(root, (target) =>
    createScene(target, {
      tier,
      onFirstFrame: () => target.style.setProperty("--lantern-on", "1"),
    }),
  );
  const { palette, mood } = getState();
  scene.setPalette(palette);
  scene.setMood(mood);
  scene.setScroll(scrollProgress(win));
  sceneRef.current = scene;
  const cleanups = [
    observeSize(root, win, (width, height) => scene.resize(width, height)),
    observeActivity(root, win, (active) => (active ? scene.resume() : scene.pause())),
    subscribe((event) => forward(scene, event)),
    followPointer(win, scene),
  ];
  return () => {
    cleanups.forEach((cleanup) => cleanup());
    sceneRef.current = null;
    scene.dispose();
    canvas.remove();
  };
}

/**
 * After first paint (idle callback), import the lantern scene chunk — three.js is
 * never in the initial bundle — and mount it. Calls `onFail` if the chunk or the
 * WebGL context cannot be created, so the caller can show the poster instead.
 */
export function useLanternScene(
  tier: Tier | null,
  rootRef: RefObject<HTMLDivElement | null>,
  sceneRef: RefObject<LanternScene | null>,
  onFail: () => void,
): void {
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });
  useEffect(() => {
    const root = rootRef.current;
    if (!root || (tier !== "high" && tier !== "low")) return;
    const win = root.ownerDocument.defaultView ?? window;
    let cancelled = false;
    let teardown: (() => void) | null = null;
    const cancelIdle = whenIdle(win, () => {
      import("@/three/lantern-scene")
        .then((sceneModule) => {
          if (!cancelled)
            teardown = mount(sceneModule.createLanternScene, root, win, tier, sceneRef);
        })
        .catch(() => {
          if (!cancelled) failRef.current();
        });
    });
    return () => {
      cancelled = true;
      cancelIdle();
      teardown?.();
    };
  }, [tier, rootRef, sceneRef]);
}

/**
 * Native scroll only (no hijacking): a passive, rAF-throttled listener that
 * fades the sky toward night and hands progress to the scene, which damps it.
 */
export function useSkyScroll(
  skyRef: RefObject<HTMLDivElement | null>,
  sceneRef: RefObject<LanternScene | null>,
): void {
  useEffect(() => {
    const sky = skyRef.current;
    if (!sky) return;
    const win = sky.ownerDocument.defaultView ?? window;
    let cancelPending: (() => void) | null = null;
    const read = () => {
      cancelPending = null;
      const progress = scrollProgress(win);
      sky.style.opacity = String(skyFade(progress));
      sky.parentElement?.style.setProperty(
        "--lantern-dim",
        lanternFade(win.scrollY, win.innerHeight).toFixed(3),
      );
      sceneRef.current?.setScroll(progress);
    };
    const onScroll = () => {
      cancelPending ??= nextFrame(win, read);
    };
    read();
    win.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      win.removeEventListener("scroll", onScroll);
      cancelPending?.();
    };
  }, [skyRef, sceneRef]);
}
