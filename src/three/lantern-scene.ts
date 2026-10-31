import { MathUtils, PerspectiveCamera, Scene, Vector3, type WebGLRenderer } from "three";
import type { Mood } from "./bus";
import { createConfetti, type ConfettiBurst } from "./confetti";
import { skyFade } from "./dusk";
import { createDuskEnvironment, type Environment } from "./env";
import { createLanternField, type LanternField } from "./lanterns";
import { clamp01, damp } from "./math";
import { createRefractionSky, type RefractionSky } from "./refraction-sky";
import { compileThenStart, createGatedLoop, createRenderer, watchContextLoss } from "./renderer";
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

type Stage = {
  tier: Exclude<Tier, "off">;
  renderer: WebGLRenderer;
  env: Environment;
  scene: Scene;
  camera: PerspectiveCamera;
  field: LanternField;
  sky: RefractionSky;
};

/** Live inputs (targets) and the damped values the frame actually uses. */
type Motion = {
  target: { scroll: number; px: number; py: number };
  now: { scroll: number; px: number; py: number };
  burst: ConfettiBurst | null;
  palette: readonly string[] | null;
};

const TAN_HALF = Math.tan(MathUtils.degToRad(FOV / 2));

function buildStage(canvas: HTMLCanvasElement, tier: Exclude<Tier, "off">): Stage {
  const renderer = createRenderer(canvas, tier);
  const env = createDuskEnvironment(renderer);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 140);
  const field = createLanternField(tier, env.texture);
  const sky = createRefractionSky();
  scene.add(sky.mesh, ...field.meshes);
  return { tier, renderer, env, scene, camera, field, sky };
}

/** One frame: damp inputs, place the camera, drift the field, fly confetti, draw. */
function step(stage: Stage, m: Motion, dt: number): boolean {
  m.now.scroll = damp(m.now.scroll, m.target.scroll, 2.2, dt);
  m.now.px = damp(m.now.px, m.target.px, 2.4, dt);
  m.now.py = damp(m.now.py, m.target.py, 2.4, dt);
  stage.camera.position.set(m.now.px * 0.7, m.now.py * 0.45, 0);
  stage.camera.lookAt(m.now.px * 0.18, m.now.py * 0.1, -30);
  stage.sky.setFade(skyFade(m.now.scroll));
  stage.field.update(dt, {
    travel: m.now.scroll * TRAVEL,
    tanHalf: TAN_HALF,
    aspect: stage.camera.aspect,
  });
  if (m.burst && !m.burst.update(dt)) m.burst = null;
  stage.renderer.render(stage.scene, stage.camera);
  return true;
}

function fireConfetti(stage: Stage, m: Motion): void {
  m.burst?.dispose();
  const origin = new Vector3(0, -4.6, -10).applyMatrix4(stage.camera.matrixWorld);
  m.burst = createConfetti(stage.tier, origin, m.palette, stage.env.texture);
  stage.scene.add(m.burst.mesh);
}

function disposeStage(stage: Stage, m: Motion): void {
  m.burst?.dispose();
  stage.field.dispose();
  stage.sky.dispose();
  stage.env.dispose();
  stage.renderer.dispose();
  stage.renderer.forceContextLoss();
}

/**
 * The persistent background: glass lanterns with warm cores and soft glow
 * drifting in front of the CSS dusk sky (docs/DESIGN.md §6). Native scroll only
 * sets targets; every motion is damped in the render loop.
 */
export function createLanternScene(
  canvas: HTMLCanvasElement,
  options: LanternSceneOptions,
): LanternScene {
  const stage = buildStage(canvas, options.tier);
  const m: Motion = {
    target: { scroll: 0, px: 0, py: 0 },
    now: { scroll: 0, px: 0, py: 0 },
    burst: null,
    palette: null,
  };
  const loop = createGatedLoop(
    canvas.ownerDocument.defaultView ?? window,
    (dt) => step(stage, m, dt),
    options.onFirstFrame,
  );
  const unwatch = watchContextLoss(canvas, loop);
  stage.field.update(0, { travel: 0, tanHalf: TAN_HALF, aspect: stage.camera.aspect });
  compileThenStart(stage.renderer, stage.scene, stage.camera, loop);
  return {
    setScroll: (p) => void (m.target.scroll = clamp01(p)),
    setPointer(x, y) {
      m.target.px = MathUtils.clamp(x, -1, 1);
      m.target.py = MathUtils.clamp(y, -1, 1);
    },
    setPalette(hexes) {
      m.palette = hexes;
      stage.field.setPalette(hexes);
    },
    setMood: (mood) => stage.field.setMood(mood),
    celebrate: () => fireConfetti(stage, m),
    resize(width, height) {
      if (width <= 0 || height <= 0) return;
      stage.renderer.setSize(width, height, false);
      stage.camera.aspect = width / height;
      stage.camera.updateProjectionMatrix();
    },
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    dispose() {
      loop.dispose();
      unwatch();
      disposeStage(stage, m);
    },
  };
}
