import { MathUtils, PerspectiveCamera, Scene, Vector3 } from "three";
import type { Mood } from "./bus";
import { createConfetti, type ConfettiBurst } from "./confetti";
import { skyFade } from "./dusk";
import { createDuskEnvironment } from "./env";
import { createLanternField } from "./lanterns";
import { clamp01, damp } from "./math";
import { createRefractionSky } from "./refraction-sky";
import { createLoop, createRenderer } from "./renderer";
import type { Tier } from "./tier";

/** Options for {@link createLanternScene}. */
export type LanternSceneOptions = {
  tier: Exclude<Tier, "off">;
  /** Called once, after shaders compiled and the first frame is on screen. */
  onFirstFrame?: () => void;
};

/** Imperative handle the backdrop component drives. */
export type LanternScene = {
  /** Document scroll progress 0..1; the camera dollies through the field, damped. */
  setScroll(p: number): void;
  /** Pointer in normalised device coordinates (-1..1, y up); damped parallax. */
  setPointer(x: number, y: number): void;
  setPalette(hexes: readonly string[] | null): void;
  setMood(mood: Mood): void;
  /** One confetti burst (restarts a burst still in flight). */
  celebrate(): void;
  /** CSS pixel size of the canvas. */
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
};

const FOV = 45;
/** World units the camera travels from the top of the page to the bottom. */
const TRAVEL = 34;

/**
 * The persistent background: glass lanterns with warm cores and soft glow
 * drifting in front of the CSS dusk sky (docs/DESIGN.md §6). Native scroll only
 * sets targets; every motion is damped in the render loop.
 */
export function createLanternScene(canvas: HTMLCanvasElement, options: LanternSceneOptions): LanternScene {
  const { tier } = options;
  const win = canvas.ownerDocument.defaultView ?? window;
  const renderer = createRenderer(canvas, tier);
  const env = createDuskEnvironment(renderer);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 140);
  const field = createLanternField(tier, env.texture);
  const sky = createRefractionSky();
  scene.add(sky.mesh, ...field.meshes);
  const tanHalf = Math.tan(MathUtils.degToRad(FOV / 2));
  const target = { scroll: 0, px: 0, py: 0 };
  const now = { scroll: 0, px: 0, py: 0 };
  let burst: ConfettiBurst | null = null;
  let palette: readonly string[] | null = null;
  let started = false;

  const frame = (dt: number) => {
    now.scroll = damp(now.scroll, target.scroll, 2.2, dt);
    now.px = damp(now.px, target.px, 2.4, dt);
    now.py = damp(now.py, target.py, 2.4, dt);
    camera.position.set(now.px * 0.7, now.py * 0.45, 0);
    camera.lookAt(now.px * 0.18, now.py * 0.1, -30);
    sky.setFade(skyFade(now.scroll));
    field.update(dt, { travel: now.scroll * TRAVEL, tanHalf, aspect: camera.aspect });
    if (burst && !burst.update(dt)) burst = null;
    renderer.render(scene, camera);
    return true;
  };
  const loop = createLoop(win, (dt) => {
    const keep = frame(dt);
    if (!started) {
      started = true;
      options.onFirstFrame?.();
    }
    return keep;
  });
  // Compile off the main thread (KHR_parallel_shader_compile) before the first
  // frame; until then, and whenever the owner pauses, the loop stays parked.
  const gate = { compiled: false, paused: false };
  const sync = () => (gate.compiled && !gate.paused ? loop.resume() : loop.pause());
  const ready = () => {
    gate.compiled = true;
    sync();
  };
  loop.pause();
  field.update(0, { travel: 0, tanHalf, aspect: camera.aspect });
  void renderer.compileAsync(scene, camera).then(ready, ready);

  const onLost = (e: Event) => {
    e.preventDefault();
    loop.pause();
  };
  const onRestored = () => sync();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  return {
    setScroll: (p) => void (target.scroll = clamp01(p)),
    setPointer(x, y) {
      target.px = MathUtils.clamp(x, -1, 1);
      target.py = MathUtils.clamp(y, -1, 1);
    },
    setPalette(hexes) {
      palette = hexes;
      field.setPalette(hexes);
    },
    setMood: (mood) => field.setMood(mood),
    celebrate() {
      burst?.dispose();
      const origin = new Vector3(0, -4.6, -10).applyMatrix4(camera.matrixWorld);
      burst = createConfetti(tier, origin, palette, env.texture);
      scene.add(burst.mesh);
    },
    resize(width, height) {
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    pause() {
      gate.paused = true;
      sync();
    },
    resume() {
      gate.paused = false;
      sync();
    },
    dispose() {
      loop.dispose();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      burst?.dispose();
      field.dispose();
      sky.dispose();
      env.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
