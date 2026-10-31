import type { ParticleAssignment } from "./particles";
import { positiveOrZero } from "./shared";

// Where each Budget Flow particle should rest: stacked discs per column, or parked below.

/**
 * Stack geometry (scene units): column `spacing` on x, layer disc `radius`, `layerHeight`,
 * `perLayer` particles per layer, floor `baseY`, parked height `parkY`, peak-to-peak `jitter`.
 */
export type ColumnLayout = {
  spacing: number;
  radius: number;
  layerHeight: number;
  perLayer: number;
  baseY: number;
  parkY: number;
  jitter: number;
};

/** Defaults sized for ~600 particles across ten columns. */
export const DEFAULT_COLUMN_LAYOUT: ColumnLayout = {
  spacing: 1.15,
  radius: 0.34,
  layerHeight: 0.13,
  perLayer: 7,
  baseY: 0,
  parkY: -2,
  jitter: 0.05,
};

const AXES = 3;
const UINT32_RANGE = 2 ** 32;
/** Successive particles in a layer turn by the golden angle, so they never line up. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Each layer is turned a little further (radians), so layers do not stack into spokes. */
const LAYER_TWIST = 0.9;
/** Slots per column in a jitter seed, so no two (column, slot) pairs share a seed. */
const SEED_COLUMN_STRIDE = 65_536;
/** Offsets that give the y and z jitter of a particle their own hash values. */
const SEED_OFFSET_Y = 7;
const SEED_OFFSET_Z = 13;
/** Vertical jitter is half the horizontal, so layers stay readable. */
const VERTICAL_JITTER_SCALE = 0.5;

/** Deterministic integer hash to [0, 1), used instead of Math.random for placement. */
export function hash01(seed: number): number {
  let hash = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / UINT32_RANGE;
}

/** Deterministic noise in [-0.5, 0.5). */
const centredNoise = (seed: number): number => hash01(seed) - 0.5;

/** Height of a stack of `count` particles under `layout`. */
export function stackHeight(count: number, layout: ColumnLayout): number {
  return Math.ceil(positiveOrZero(count) / layout.perLayer) * layout.layerHeight;
}

/** World x of `column` when `columns` columns are centred on the origin. */
export function columnX(column: number, columns: number, layout: ColumnLayout): number {
  return (column - (columns - 1) / 2) * layout.spacing;
}

/** A parked particle waits on `parkY`, spread across the columns' x positions. */
function writeParkedTarget(
  targets: Float32Array,
  offset: number,
  slot: number,
  columns: number,
  layout: ColumnLayout,
): void {
  targets[offset] = columnX(slot % Math.max(columns, 1), columns, layout);
  targets[offset + 1] = layout.parkY;
  targets[offset + 2] = 0;
}

/**
 * A stacked particle sits on its layer's disc. Within a layer, radius ∝ √((k + ½) / perLayer)
 * on a golden-angle spiral fills the disc evenly; hashed jitter keeps it from looking machined.
 */
function writeStackedTarget(
  targets: Float32Array,
  offset: number,
  column: number,
  slot: number,
  columns: number,
  layout: ColumnLayout,
): void {
  const { perLayer, radius, jitter, layerHeight, baseY } = layout;
  const indexInLayer = slot % perLayer;
  const layer = Math.floor(slot / perLayer);
  const angle = indexInLayer * GOLDEN_ANGLE + layer * LAYER_TWIST;
  const distance = radius * Math.sqrt((indexInLayer + 0.5) / perLayer);
  const seed = column * SEED_COLUMN_STRIDE + slot;
  const height = baseY + (layer + 0.5) * layerHeight;
  targets[offset] =
    columnX(column, columns, layout) + Math.cos(angle) * distance + centredNoise(seed) * jitter;
  targets[offset + 1] =
    height + centredNoise(seed + SEED_OFFSET_Y) * jitter * VERTICAL_JITTER_SCALE;
  targets[offset + 2] = Math.sin(angle) * distance + centredNoise(seed + SEED_OFFSET_Z) * jitter;
}

/**
 * Target xyz for every particle: a golden-angle disc per layer, layers stacked
 * from `baseY`, plus deterministic jitter hashed from (column, slot). Parked
 * particles wait on `parkY` under the columns. Reuses `out` when its size fits.
 */
export function targetsFor(
  assignment: ParticleAssignment,
  layout: ColumnLayout,
  out?: Float32Array,
): Float32Array {
  const particleCount = assignment.column.length;
  const size = particleCount * AXES;
  const targets = out?.length === size ? out : new Float32Array(size);
  const columns = assignment.counts.length;
  for (let particle = 0; particle < particleCount; particle++) {
    const column = assignment.column[particle];
    const slot = assignment.slot[particle];
    const offset = particle * AXES;
    if (column < 0) writeParkedTarget(targets, offset, slot, columns, layout);
    else writeStackedTarget(targets, offset, column, slot, columns, layout);
  }
  return targets;
}
