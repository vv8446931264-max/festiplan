import { ACESFilmicToneMapping, WebGLRenderer } from "three";
import type { Tier } from "./tier";

/** Device-pixel-ratio ceiling per tier (docs/DESIGN.md §8). */
export const DPR_CAP: Record<Exclude<Tier, "off">, number> = { high: 1.75, low: 1.25 };

/**
 * A transparent WebGL2 renderer for a canvas that sits over a CSS backdrop:
 * premultiplied alpha, clear alpha 0, ACES tone mapping, clamped DPR, no stencil.
 * MSAA only on the high tier; the transmission buffer renders at half resolution
 * (its roughness blur hides the difference and it quarters that pass's fill cost).
 */
export function createRenderer(canvas: HTMLCanvasElement, tier: Exclude<Tier, "off">): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: tier === "high",
    stencil: false,
    powerPreference: "high-performance",
  });
  const dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  renderer.setPixelRatio(Math.min(dpr, DPR_CAP[tier]));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.transmissionResolutionScale = 0.5;
  return renderer;
}

/** A requestAnimationFrame loop that can sleep (frame returns false) and be paused. */
export type Loop = {
  /** Stop scheduling frames until {@link Loop.resume}. */
  pause(): void;
  /** Undo {@link Loop.pause}; the first frame after it gets dt = 0. */
  resume(): void;
  /** Schedule a frame if the loop is asleep (and not paused). */
  wake(): void;
  /** Stop for good. */
  dispose(): void;
};

/**
 * Drive `frame(dt, time)` from requestAnimationFrame. `dt` is in seconds and
 * capped at 0.1 s; returning false lets the loop sleep until `wake()` (on-demand
 * rendering for scenes that come to rest).
 */
export function createLoop(win: Window, frame: (dt: number, time: number) => boolean): Loop {
  let raf = 0;
  let last = -1;
  let paused = false;
  let disposed = false;
  const tick = (now: number) => {
    raf = 0;
    const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    if (frame(dt, now / 1000) && !paused && !disposed) raf = win.requestAnimationFrame(tick);
    else last = -1;
  };
  const schedule = () => {
    if (raf === 0 && !paused && !disposed) raf = win.requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (raf !== 0) win.cancelAnimationFrame(raf);
    raf = 0;
    last = -1;
  };
  return {
    pause() {
      paused = true;
      cancel();
    },
    resume() {
      paused = false;
      schedule();
    },
    wake: schedule,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
