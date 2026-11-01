import { PerspectiveCamera, Scene, type WebGLRenderer } from "three";
import { CATEGORY_COLORS } from "@/lib/category-style";
import type { BudgetCategory } from "@/lib/contracts";
import { layoutParticles, type ParticleAllocation } from "@/lib/engine/particles";
import {
  CAMERA,
  INITIAL_PARTICLE_SIZE,
  configureColumns,
  frameCamera,
  layoutFor,
  particleSizeFor,
} from "./budget-flow-layout";
import { createGlassColumns, type GlassColumns } from "./columns";
import { emphasisOf, type Emphasis } from "./emphasis";
import { createDuskEnvironment, type Environment } from "./env";
import { createFlowParticles, type FlowParticles } from "./flow-particles";
import { createHoverPicker } from "./hover";
import { compileThenStart, createGatedLoop, createRenderer, watchContextLoss } from "./renderer";
import type { Tier } from "./tier";

/** Particles (rupees) per tier (docs/DESIGN.md §6). */
const FLOW_PARTICLES = { high: 600, low: 250 } as const;

/** Options for {@link createBudgetFlowScene}. */
export type BudgetFlowOptions = { tier: Exclude<Tier, "off">; onFirstFrame?: () => void };

/** Imperative handle the BudgetFlow component drives. */
export type BudgetFlowScene = {
  setAllocations(allocations: readonly ParticleAllocation[]): void;
  setHighlight(category: BudgetCategory | null): void;
  /** CSS pixel size of the canvas. */
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  /** Hovered column changes (category or null); returns an unsubscribe. */
  onHover(listener: (category: BudgetCategory | null) => void): () => void;
};

/** Column glow (1 bright … negative dark) and rupee brightness for each emphasis. */
const COLUMN_GLOW: Record<Emphasis, number> = { normal: 0, lit: 1, dimmed: -0.85 };
const PARTICLE_LEVEL: Record<Emphasis, number> = { normal: 1, lit: 1.7, dimmed: 0.26 };

type Stage = {
  particleCount: number;
  renderer: WebGLRenderer;
  env: Environment;
  scene: Scene;
  camera: PerspectiveCamera;
  columns: GlassColumns;
  particles: FlowParticles;
};
type Flow = {
  categories: BudgetCategory[];
  counts: number[];
  highlight: BudgetCategory | null;
  size: number;
};

function buildStage(canvas: HTMLCanvasElement, tier: Exclude<Tier, "off">): Stage {
  const particleCount = FLOW_PARTICLES[tier];
  const renderer = createRenderer(canvas, tier);
  const env = createDuskEnvironment(renderer);
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, CAMERA.initialAspect, CAMERA.near, CAMERA.far);
  const columns = createGlassColumns();
  const particles = createFlowParticles(particleCount, env.texture);
  scene.add(particles.mesh, columns.mesh);
  return { particleCount, renderer, env, scene, camera, columns, particles };
}

/** Brighten the highlighted column and its rupees, dim the rest. */
function applyHighlight(stage: Stage, flow: Flow): void {
  const emphases = flow.categories.map((category) => emphasisOf(category, flow.highlight));
  emphases.forEach((emphasis, index) => stage.columns.setGlow(index, COLUMN_GLOW[emphasis]));
  stage.particles.setLevels(emphases.map((emphasis) => PARTICLE_LEVEL[emphasis]));
}

/** Re-layout for new allocations; returns false when nothing changed. */
function applyAllocations(
  stage: Stage,
  flow: Flow,
  allocations: readonly ParticleAllocation[],
): boolean {
  const categories = allocations.map((allocation) => allocation.category);
  const counts = layoutParticles(allocations, stage.particleCount);
  const sameCategories =
    categories.length === flow.categories.length &&
    categories.every((category, index) => category === flow.categories[index]);
  if (sameCategories && counts.every((count, index) => count === flow.counts[index])) return false;
  if (!sameCategories) stage.particles.remap(flow.categories, categories);
  const layout = layoutFor(stage.particleCount, counts);
  const colors = categories.map((category) => CATEGORY_COLORS[category]);
  stage.particles.assign(counts, layout, colors);
  configureColumns(stage.columns, counts, layout, colors);
  flow.categories = categories;
  flow.counts = counts;
  flow.size = particleSizeFor(layout);
  frameCamera(stage.camera, categories.length);
  applyHighlight(stage, flow);
  return true;
}

function changeHighlight(stage: Stage, flow: Flow, category: BudgetCategory | null): boolean {
  if (category === flow.highlight) return false;
  flow.highlight = category;
  applyHighlight(stage, flow);
  return true;
}

function resizeStage(stage: Stage, flow: Flow, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  stage.renderer.setSize(width, height, false);
  stage.camera.aspect = width / height;
  frameCamera(stage.camera, flow.categories.length);
  return true;
}

/** One frame; returns false once particles and columns have settled (the loop then sleeps). */
function draw(stage: Stage, flow: Flow, dt: number): boolean {
  const flowing = stage.particles.update(dt, flow.size);
  const growing = stage.columns.update(dt);
  stage.renderer.render(stage.scene, stage.camera);
  return flowing || growing;
}

function disposeStage(stage: Stage): void {
  stage.particles.dispose();
  stage.columns.dispose();
  stage.env.dispose();
  stage.renderer.dispose();
  stage.renderer.forceContextLoss();
}

/**
 * Budget Flow: K translucent glass columns tinted with CATEGORY_COLORS, heights
 * ∝ share, filled with N rupee particles. Changing one allocation moves only the
 * delta particles (stable assignment from particles.ts), arcing between columns.
 * Renders on demand: the loop sleeps once everything has settled.
 */
export function createBudgetFlowScene(
  canvas: HTMLCanvasElement,
  options: BudgetFlowOptions,
): BudgetFlowScene {
  const stage = buildStage(canvas, options.tier);
  const flow: Flow = { categories: [], counts: [], highlight: null, size: INITIAL_PARTICLE_SIZE };
  const win = canvas.ownerDocument.defaultView ?? window;
  const loop = createGatedLoop(win, (dt) => draw(stage, flow, dt), options.onFirstFrame);
  const stopWatchingContext = watchContextLoss(canvas, loop);
  const categoryAt = (index: number) => flow.categories[index] ?? null;
  const picker = createHoverPicker(canvas, stage.camera, stage.columns.mesh, categoryAt);
  // Place the camera and write the first instance data before the shaders compile.
  frameCamera(stage.camera, 0);
  stage.particles.update(0, flow.size);
  stage.columns.update(0);
  compileThenStart(stage.renderer, stage.scene, stage.camera, loop);
  const wakeIfChanged = (changed: boolean) => {
    if (changed) loop.wake();
  };
  return {
    setAllocations: (allocations) => wakeIfChanged(applyAllocations(stage, flow, allocations)),
    setHighlight: (category) => wakeIfChanged(changeHighlight(stage, flow, category)),
    resize: (width, height) => wakeIfChanged(resizeStage(stage, flow, width, height)),
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    onHover: (listener) => picker.listen(listener),
    dispose() {
      loop.dispose();
      stopWatchingContext();
      picker.dispose();
      disposeStage(stage);
    },
  };
}
