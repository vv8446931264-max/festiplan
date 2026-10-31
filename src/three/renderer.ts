import { ACESFilmicToneMapping, WebGLRenderer, type Camera, type Scene } from "three";
import type { Tier } from "./tier";

/** Device-pixel-ratio ceiling per tier (docs/DESIGN.md §8). */
export const DPR_CAP: Record<Exclude<Tier, "off">, number> = { high: 1.75, low: 1.25 };

/** Slightly above neutral so the warm glass reads bright after ACES compression. */
const TONE_MAPPING_EXPOSURE = 1.05;
/** The transmission pass renders at half resolution (its roughness blur hides the difference). */
const TRANSMISSION_RESOLUTION_SCALE = 0.5;
/** Longest step a frame may take, so a tab switch or a breakpoint never jumps the simulation. */
const MAX_FRAME_SECONDS = 0.1;

/**
 * A transparent WebGL2 renderer for a canvas that sits over a CSS backdrop:
 * premultiplied alpha, clear alpha 0, ACES tone mapping, clamped DPR, no stencil.
 * MSAA only on the high tier; the half-resolution transmission buffer quarters that
 * pass's fill cost.
 */
export function createRenderer(
  canvas: HTMLCanvasElement,
  tier: Exclude<Tier, "off">,
): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: tier === "high",
    stencil: false,
    // A background decoration should not wake a laptop's discrete GPU.
    powerPreference: "default",
  });
  const devicePixelRatio = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_CAP[tier]));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  renderer.transmissionResolutionScale = TRANSMISSION_RESOLUTION_SCALE;
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
 * Drive `frame(dt, time)` from requestAnimationFrame. `dt` is in seconds and capped at
 * {@link MAX_FRAME_SECONDS}; returning false lets the loop sleep until `wake()` (on-demand
 * rendering for scenes that come to rest).
 */
export function createLoop(win: Window, frame: (dt: number, time: number) => boolean): Loop {
  let frameHandle = 0;
  let lastTime = -1;
  let paused = false;
  let disposed = false;
  const tick = (now: number) => {
    frameHandle = 0;
    const dt = lastTime < 0 ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = now;
    const keepGoing = frame(dt, now / 1000);
    if (keepGoing && !paused && !disposed) frameHandle = win.requestAnimationFrame(tick);
    else lastTime = -1;
  };
  const schedule = () => {
    if (frameHandle === 0 && !paused && !disposed) frameHandle = win.requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (frameHandle !== 0) win.cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    lastTime = -1;
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

/** A {@link Loop} parked until shaders compile and whenever its owner pauses it. */
export type GatedLoop = {
  ready(): void;
  pause(): void;
  resume(): void;
  wake(): void;
  dispose(): void;
};

/**
 * Wrap `frame` in a loop that only runs once `ready()` has been called (shaders
 * compiled) and the owner has not paused it; `onFirstFrame` fires once.
 */
export function createGatedLoop(
  win: Window,
  frame: (dt: number) => boolean,
  onFirstFrame?: () => void,
): GatedLoop {
  let firstFrame = true;
  const loop = createLoop(win, (dt) => {
    const keepGoing = frame(dt);
    if (firstFrame) {
      firstFrame = false;
      onFirstFrame?.();
    }
    return keepGoing;
  });
  const gate = { compiled: false, paused: false };
  const sync = () => (gate.compiled && !gate.paused ? loop.resume() : loop.pause());
  loop.pause();
  return {
    ready() {
      gate.compiled = true;
      sync();
    },
    pause() {
      gate.paused = true;
      sync();
    },
    resume() {
      gate.paused = false;
      sync();
    },
    wake: () => loop.wake(),
    dispose: () => loop.dispose(),
  };
}

/**
 * Compile every program off the main thread where KHR_parallel_shader_compile
 * exists, then open the gate (also on failure — the first frame compiles then).
 */
export function compileThenStart(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  loop: GatedLoop,
): void {
  const openGate = () => loop.ready();
  void renderer.compileAsync(scene, camera).then(openGate, openGate);
}

/** Pause on WebGL context loss, carry on after restore; returns a cleanup. */
export function watchContextLoss(canvas: HTMLCanvasElement, loop: GatedLoop): () => void {
  const onLost = (event: Event) => {
    // Without preventDefault the browser never tries to restore the context.
    event.preventDefault();
    loop.pause();
  };
  const onRestored = () => loop.resume();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return () => {
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
  };
}
