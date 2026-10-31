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
  setScroll(progress: number): void;
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

const CAMERA = { fov: 45, near: 0.1, far: 140 } as const;
const TAN_HALF_FOV = Math.tan(MathUtils.degToRad(CAMERA.fov / 2));
/** World units the camera travels from the top of the page to the bottom. */
const TRAVEL = 34;
/** Damping rates (1/s) for the scroll dolly and the pointer parallax. */
const EASE = { scroll: 2.2, pointer: 2.4 } as const;
/** Pointer parallax: camera shift and aim per unit of pointer offset; aim depth into the field. */
const PARALLAX = { shiftX: 0.7, shiftY: 0.45, aimX: 0.18, aimY: 0.1, aimDepth: -30 } as const;
/** The confetti cannons sit below and in front of the camera (camera space). */
const CONFETTI_ORIGIN = new Vector3(0, -4.6, -10);

type Stage = {
  tier: Exclude<Tier, "off">;
  renderer: WebGLRenderer;
  env: Environment;
  scene: Scene;
  camera: PerspectiveCamera;
  field: LanternField;
  sky: RefractionSky;
};

type MotionValues = { scroll: number; pointerX: number; pointerY: number };

/** Live inputs (targets) and the damped values the frame actually uses. */
type Motion = {
  target: MotionValues;
  now: MotionValues;
  burst: ConfettiBurst | null;
  palette: readonly string[] | null;
};

function buildStage(canvas: HTMLCanvasElement, tier: Exclude<Tier, "off">): Stage {
  const renderer = createRenderer(canvas, tier);
  const env = createDuskEnvironment(renderer);
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  const field = createLanternField(tier, env.texture);
  const sky = createRefractionSky();
  scene.add(sky.mesh, ...field.meshes);
  return { tier, renderer, env, scene, camera, field, sky };
}

function createMotion(): Motion {
  return {
    target: { scroll: 0, pointerX: 0, pointerY: 0 },
    now: { scroll: 0, pointerX: 0, pointerY: 0 },
    burst: null,
    palette: null,
  };
}

/** One frame: damp inputs, place the camera, drift the field, fly confetti, draw. */
function step(stage: Stage, motion: Motion, dt: number): boolean {
  const { now, target } = motion;
  now.scroll = damp(now.scroll, target.scroll, EASE.scroll, dt);
  now.pointerX = damp(now.pointerX, target.pointerX, EASE.pointer, dt);
  now.pointerY = damp(now.pointerY, target.pointerY, EASE.pointer, dt);
  stage.camera.position.set(now.pointerX * PARALLAX.shiftX, now.pointerY * PARALLAX.shiftY, 0);
  stage.camera.lookAt(
    now.pointerX * PARALLAX.aimX,
    now.pointerY * PARALLAX.aimY,
    PARALLAX.aimDepth,
  );
  stage.sky.setFade(skyFade(now.scroll));
  stage.field.update(dt, {
    travel: now.scroll * TRAVEL,
    tanHalf: TAN_HALF_FOV,
    aspect: stage.camera.aspect,
  });
  if (motion.burst && !motion.burst.update(dt)) motion.burst = null;
  stage.renderer.render(stage.scene, stage.camera);
  return true;
}

function fireConfetti(stage: Stage, motion: Motion): void {
  motion.burst?.dispose();
  const origin = CONFETTI_ORIGIN.clone().applyMatrix4(stage.camera.matrixWorld);
  motion.burst = createConfetti(stage.tier, origin, motion.palette, stage.env.texture);
  stage.scene.add(motion.burst.mesh);
}

function resizeStage(stage: Stage, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  stage.renderer.setSize(width, height, false);
  stage.camera.aspect = width / height;
  stage.camera.updateProjectionMatrix();
}

function disposeStage(stage: Stage, motion: Motion): void {
  motion.burst?.dispose();
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
  const motion = createMotion();
  const win = canvas.ownerDocument.defaultView ?? window;
  const loop = createGatedLoop(win, (dt) => step(stage, motion, dt), options.onFirstFrame);
  const stopWatchingContext = watchContextLoss(canvas, loop);
  stage.field.update(0, { travel: 0, tanHalf: TAN_HALF_FOV, aspect: stage.camera.aspect });
  compileThenStart(stage.renderer, stage.scene, stage.camera, loop);
  return {
    setScroll(progress) {
      motion.target.scroll = clamp01(progress);
    },
    setPointer(x, y) {
      motion.target.pointerX = MathUtils.clamp(x, -1, 1);
      motion.target.pointerY = MathUtils.clamp(y, -1, 1);
    },
    setPalette(hexes) {
      motion.palette = hexes;
      stage.field.setPalette(hexes);
    },
    setMood: (mood) => stage.field.setMood(mood),
    celebrate: () => fireConfetti(stage, motion),
    resize: (width, height) => resizeStage(stage, width, height),
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    dispose() {
      loop.dispose();
      stopWatchingContext();
      disposeStage(stage, motion);
    },
  };
}
