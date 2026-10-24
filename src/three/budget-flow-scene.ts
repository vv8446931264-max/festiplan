import { MathUtils, PerspectiveCamera, Scene, type WebGLRenderer } from "three";
import { CATEGORY_COLORS } from "@/lib/category-style";
import type { BudgetCategory } from "@/lib/contracts";
import { DEFAULT_COLUMN_LAYOUT, columnX, layoutParticles, stackHeight, type ColumnLayout, type ParticleAllocation } from "@/lib/engine/particles";
import { createGlassColumns, type GlassColumns } from "./columns";
import { createDuskEnvironment, type Environment } from "./env";
import { createFlowParticles, type FlowParticles } from "./flow-particles";
import { createHoverPicker } from "./hover";
import { compileThenStart, createGatedLoop, createRenderer, watchContextLoss } from "./renderer";
import type { Tier } from "./tier";

/** Particles (rupees) per tier (docs/DESIGN.md §6). */
export const FLOW_PARTICLES = { high: 600, low: 250 } as const;

/** Options for {@link createBudgetFlowScene}. */
export type BudgetFlowOptions = { tier: Exclude<Tier, "off">; onFirstFrame?: () => void };

/** Imperative handle the BudgetFlow component drives. */
export type BudgetFlowScene = {
  setAllocations(list: readonly ParticleAllocation[]): void;
  setHighlight(category: BudgetCategory | null): void;
  /** CSS pixel size of the canvas. */
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  /** Hovered column changes (category or null); returns an unsubscribe. */
  onHover(cb: (category: BudgetCategory | null) => void): () => void;
};

/** Height (world units) that a 40 % share fills. */
const FIT_HEIGHT = 7;
const FOV = 30;

type Stage = { n: number; renderer: WebGLRenderer; env: Environment; scene: Scene; camera: PerspectiveCamera; columns: GlassColumns; particles: FlowParticles };
type Flow = { categories: BudgetCategory[]; counts: number[]; highlight: BudgetCategory | null; size: number };

function buildStage(canvas: HTMLCanvasElement, tier: Exclude<Tier, "off">): Stage {
  const n = FLOW_PARTICLES[tier];
  const renderer = createRenderer(canvas, tier);
  const env = createDuskEnvironment(renderer);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 4 / 3, 0.1, 80);
  const columns = createGlassColumns();
  const particles = createFlowParticles(n, env.texture);
  scene.add(particles.mesh, columns.mesh);
  return { n, renderer, env, scene, camera, columns, particles };
}

/** Stack geometry: the taller of 30 % or the largest share fills FIT_HEIGHT (it rescales past that). */
function layoutFor(n: number, counts: readonly number[]): ColumnLayout {
  const perLayer = n >= 500 ? 7 : 4;
  const tallest = Math.max(0.3 * n, ...counts);
  const layerHeight = FIT_HEIGHT / Math.ceil(tallest / perLayer);
  return { ...DEFAULT_COLUMN_LAYOUT, perLayer, radius: perLayer === 7 ? 0.34 : 0.26, spacing: 1.2, layerHeight };
}

/** Fit the row of columns to the viewport width and the stack to its height, looking down onto the lids. */
function frameCamera(camera: PerspectiveCamera, columns: number): void {
  const tan = Math.tan(MathUtils.degToRad(FOV / 2));
  const width = Math.max(columns, 4) * 1.2 + 0.5;
  const dist = Math.max(width / (2 * tan * camera.aspect), (FIT_HEIGHT * 1.12) / (2 * tan));
  camera.position.set(0, FIT_HEIGHT * 0.72, dist);
  camera.lookAt(0, FIT_HEIGHT * 0.36, 0);
  camera.updateProjectionMatrix();
}

/** Brighten the highlighted column and its rupees, dim the rest. */
function applyHighlight(stage: Stage, f: Flow): void {
  const any = f.highlight !== null;
  f.categories.forEach((c, i) => stage.columns.setGlow(i, c === f.highlight ? 1 : any ? -0.85 : 0));
  stage.particles.setLevels(f.categories.map((c) => (c === f.highlight ? 1.7 : any ? 0.26 : 1)));
}

/** Re-layout for new allocations; returns false when nothing changed. */
function applyAllocations(stage: Stage, f: Flow, list: readonly ParticleAllocation[]): boolean {
  const categories = list.map((a) => a.category);
  const counts = layoutParticles(list, stage.n);
  const sameCats = categories.length === f.categories.length && categories.every((c, i) => c === f.categories[i]);
  if (sameCats && counts.every((c, i) => c === f.counts[i])) return false;
  if (!sameCats) stage.particles.remap(f.categories, categories);
  const layout = layoutFor(stage.n, counts);
  const colors = categories.map((c) => CATEGORY_COLORS[c]);
  stage.particles.assign(counts, layout, colors);
  stage.columns.configure(categories.map((_, i) => columnX(i, categories.length, layout)), layout.radius + 0.13, colors);
  counts.forEach((c, i) => stage.columns.setHeight(i, c > 0 ? stackHeight(c, layout) + layout.layerHeight * 0.8 : 0));
  Object.assign(f, { categories, counts, size: Math.min(0.1, layout.layerHeight * 0.62) });
  frameCamera(stage.camera, categories.length);
  applyHighlight(stage, f);
  return true;
}

/** One frame; returns false once particles and columns have settled (the loop then sleeps). */
function draw(stage: Stage, f: Flow, dt: number): boolean {
  const flowing = stage.particles.update(dt, f.size);
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
export function createBudgetFlowScene(canvas: HTMLCanvasElement, options: BudgetFlowOptions): BudgetFlowScene {
  const stage = buildStage(canvas, options.tier);
  const f: Flow = { categories: [], counts: [], highlight: null, size: 0.07 };
  const loop = createGatedLoop(canvas.ownerDocument.defaultView ?? window, (dt) => draw(stage, f, dt), options.onFirstFrame);
  const unwatch = watchContextLoss(canvas, loop);
  const picker = createHoverPicker(canvas, stage.camera, stage.columns.mesh, (i) => f.categories[i] ?? null);
  frameCamera(stage.camera, 0);
  stage.particles.update(0, f.size);
  stage.columns.update(0);
  compileThenStart(stage.renderer, stage.scene, stage.camera, loop);
  return {
    setAllocations: (list) => void (applyAllocations(stage, f, list) && loop.wake()),
    setHighlight(category) {
      if (category === f.highlight) return;
      f.highlight = category;
      applyHighlight(stage, f);
      loop.wake();
    },
    resize(width, height) {
      if (width <= 0 || height <= 0) return;
      stage.renderer.setSize(width, height, false);
      stage.camera.aspect = width / height;
      frameCamera(stage.camera, f.categories.length);
      loop.wake();
    },
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    onHover: (cb) => picker.listen(cb),
    dispose() {
      loop.dispose();
      unwatch();
      picker.dispose();
      disposeStage(stage);
    },
  };
}
