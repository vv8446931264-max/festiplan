import { MathUtils, type PerspectiveCamera } from "three";
import {
  DEFAULT_COLUMN_LAYOUT,
  columnX,
  stackHeight,
  type ColumnLayout,
} from "@/lib/engine/particles";
import type { GlassColumns } from "./columns";

/*
 * Budget Flow geometry: how the rupee stacks are packed, where the glass goes around them
 * and where the camera stands so every column fits the box, whatever its aspect ratio.
 */

/** Lens and clipping range; the aspect is 4:3 until the first resize reports the real box. */
export const CAMERA = { fov: 30, initialAspect: 4 / 3, near: 0.1, far: 80 } as const;
/** Particle size before the first allocation arrives. */
export const INITIAL_PARTICLE_SIZE = 0.07;

/** Height (world units) the tallest stack is fitted to. */
const FIT_HEIGHT = 7;
/** A stack holding this share of the particles (or the largest share, if bigger) fills FIT_HEIGHT. */
const FULL_STACK_SHARE = 0.3;
/** From this many particles, stacks are wider with more particles per layer. */
const DENSE_STACK_MIN_PARTICLES = 500;
const STACK = { dense: { perLayer: 7, radius: 0.34 }, sparse: { perLayer: 4, radius: 0.26 } };
const COLUMN_SPACING = 1.2;
/** Glass wall distance outside the particle stack, and headroom above it (in layers). */
const GLASS = { wallGap: 0.13, headroomLayers: 0.8 } as const;
/** Particle size: a fraction of the layer height, capped so sparse stacks don't look chunky. */
const PARTICLE_SIZE = { max: 0.1, perLayerHeight: 0.62 } as const;
/** Framing: always room for at least `minColumns`, plus a margin and some headroom. */
const FRAME = { minColumns: 4, margin: 0.5, headroom: 1.12, eye: 0.72, lookAt: 0.36 } as const;
const TAN_HALF_FOV = Math.tan(MathUtils.degToRad(CAMERA.fov / 2));

/** Stack geometry: the taller of a FULL_STACK_SHARE stack or the largest one fills FIT_HEIGHT. */
export function layoutFor(particleCount: number, counts: readonly number[]): ColumnLayout {
  const stack = particleCount >= DENSE_STACK_MIN_PARTICLES ? STACK.dense : STACK.sparse;
  const tallest = Math.max(FULL_STACK_SHARE * particleCount, ...counts);
  const layerHeight = FIT_HEIGHT / Math.ceil(tallest / stack.perLayer);
  return { ...DEFAULT_COLUMN_LAYOUT, ...stack, spacing: COLUMN_SPACING, layerHeight };
}

/** Rupee size for a layout: thinner layers get smaller coins. */
export function particleSizeFor(layout: ColumnLayout): number {
  return Math.min(PARTICLE_SIZE.max, layout.layerHeight * PARTICLE_SIZE.perLayerHeight);
}

/** Fit the row of columns to the viewport width and the stack to its height, looking down onto the lids. */
export function frameCamera(camera: PerspectiveCamera, columns: number): void {
  const rowWidth = Math.max(columns, FRAME.minColumns) * COLUMN_SPACING + FRAME.margin;
  const distanceForWidth = rowWidth / (2 * TAN_HALF_FOV * camera.aspect);
  const distanceForHeight = (FIT_HEIGHT * FRAME.headroom) / (2 * TAN_HALF_FOV);
  camera.position.set(0, FIT_HEIGHT * FRAME.eye, Math.max(distanceForWidth, distanceForHeight));
  camera.lookAt(0, FIT_HEIGHT * FRAME.lookAt, 0);
  camera.updateProjectionMatrix();
}

/** Position the glass around each stack, tall enough to leave headroom above the rupees. */
export function configureColumns(
  columns: GlassColumns,
  counts: readonly number[],
  layout: ColumnLayout,
  colors: readonly string[],
): void {
  const xPositions = counts.map((_, index) => columnX(index, counts.length, layout));
  columns.configure(xPositions, layout.radius + GLASS.wallGap, colors);
  const headroom = layout.layerHeight * GLASS.headroomLayers;
  counts.forEach((count, index) => {
    columns.setHeight(index, count > 0 ? stackHeight(count, layout) + headroom : 0);
  });
}
