import type { BudgetCategory } from "../contracts";

// Budget Flow particle maths (docs/DESIGN.md §6): rupees are particles, categories are columns.
// Pure — no three.js, no I/O, no Math.random (positions come from an integer hash).

/** One budget line as the particle layout sees it. */
export type ParticleAllocation = { category: BudgetCategory; amountINR: number };

/** Positions and velocities, xyz per particle (length 3·n each). */
export type ParticleState = { pos: Float32Array; vel: Float32Array };

/** Column per particle (-1 = parked, hidden), stack slot (0 = bottom) and particles per column. */
export type ParticleAssignment = { column: Int16Array; slot: Int32Array; counts: number[] };

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

/**
 * Spring options: `stiffness` (unit mass, default 60), `damping` (default 2·√stiffness = critical),
 * `lift` (upward pull per unit of horizontal distance, so particles crossing columns arc).
 */
export type SpringOptions = { stiffness?: number; damping?: number; lift?: number };

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

/** Largest simulation step; longer frames (tab switches, jank) are clamped to it. */
export const MAX_DT = 1 / 30;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic integer hash to [0, 1), used instead of Math.random for placement. */
export function hash01(i: number): number {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function sanitize(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/**
 * Split `n` particles across allocations in proportion to their rupees with the
 * largest-remainder method, so the counts sum to exactly `n` (ties go to the
 * earlier line). Negative or non-finite amounts count as zero; when every amount
 * is zero, or `n` is not a positive number, every count is zero.
 */
export function layoutParticles(allocations: readonly ParticleAllocation[], n: number): number[] {
  const total = Math.floor(sanitize(n));
  const amounts = allocations.map((a) => sanitize(a.amountINR));
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (total === 0 || sum === 0) return amounts.map(() => 0);
  const counts = amounts.map((a) => Math.floor((a * total) / sum));
  let left = total - counts.reduce((s, c) => s + c, 0);
  const order = amounts
    .map((a, i) => ({ r: (a * total) / sum - counts[i], i }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left === 0) break;
    counts[i] += 1;
    left -= 1;
  }
  return counts;
}

/** A fresh assignment with every one of `n` particles parked. */
export function emptyAssignment(n: number): ParticleAssignment {
  const size = Math.floor(sanitize(n));
  const slot = new Int32Array(size);
  for (let i = 0; i < size; i++) slot[i] = i;
  return { column: new Int16Array(size).fill(-1), slot, counts: [] };
}

/**
 * Stable re-assignment. A particle keeps its column and slot while that column
 * still has room for it; only the surplus of shrinking columns (top of the stack)
 * and parked particles move, filling the lowest free slots of growing columns in
 * column order. When one slider moves, exactly the delta changes column. `prev`
 * carries the previous counts; `nextCounts` usually comes from {@link layoutParticles}.
 */
export function assignParticles(
  prev: ParticleAssignment,
  nextCounts: readonly number[],
): ParticleAssignment {
  const n = prev.column.length;
  const taken = nextCounts.map((c) => new Uint8Array(Math.floor(sanitize(c))));
  const out: ParticleAssignment = {
    column: new Int16Array(n).fill(-1),
    slot: new Int32Array(n),
    counts: taken.map(() => 0),
  };
  const free: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = prev.column[i];
    const s = prev.slot[i];
    const room: Uint8Array | undefined = taken[c];
    if (room !== undefined && s >= 0 && s < room.length && room[s] === 0) {
      room[s] = 1;
      out.column[i] = c;
      out.slot[i] = s;
      out.counts[c] += 1;
    } else free.push(i);
  }
  let next = 0;
  taken.forEach((room, c) => {
    for (let s = 0; s < room.length && next < free.length; s++) {
      if (room[s] === 1) continue;
      const i = free[next++];
      out.column[i] = c;
      out.slot[i] = s;
      out.counts[c] += 1;
    }
  });
  for (let parked = 0; next < free.length; parked++) out.slot[free[next++]] = parked;
  return out;
}

/** Height of a stack of `count` particles under `layout`. */
export function stackHeight(count: number, layout: ColumnLayout): number {
  return Math.ceil(sanitize(count) / layout.perLayer) * layout.layerHeight;
}

/** World x of column `c` when `columns` columns are centred on the origin. */
export function columnX(c: number, columns: number, layout: ColumnLayout): number {
  return (c - (columns - 1) / 2) * layout.spacing;
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
  const n = assignment.column.length;
  const t = out?.length === n * 3 ? out : new Float32Array(n * 3);
  const columns = assignment.counts.length;
  const { perLayer, radius, jitter: j } = layout;
  for (let i = 0, o = 0; i < n; i++, o += 3) {
    const c = assignment.column[i];
    const s = assignment.slot[i];
    if (c < 0) {
      t[o] = columnX(s % Math.max(columns, 1), columns, layout);
      t[o + 1] = layout.parkY;
      t[o + 2] = 0;
      continue;
    }
    const k = s % perLayer;
    const layer = Math.floor(s / perLayer);
    const angle = k * GOLDEN_ANGLE + layer * 0.9;
    const r = radius * Math.sqrt((k + 0.5) / perLayer);
    const seed = c * 65536 + s;
    t[o] = columnX(c, columns, layout) + Math.cos(angle) * r + (hash01(seed) - 0.5) * j;
    t[o + 1] =
      layout.baseY + (layer + 0.5) * layout.layerHeight + (hash01(seed + 7) - 0.5) * j * 0.5;
    t[o + 2] = Math.sin(angle) * r + (hash01(seed + 13) - 0.5) * j;
  }
  return t;
}

/** Particle state for `n` particles at rest, starting at `init` (copied) or the origin. */
export function createParticleState(n: number, init?: Float32Array): ParticleState {
  const size = Math.floor(sanitize(n)) * 3;
  const pos = new Float32Array(size);
  if (init) pos.set(init.subarray(0, size));
  return { pos, vel: new Float32Array(size) };
}

/**
 * Advance every particle one step towards its target: damped spring (critical by default),
 * semi-implicit Euler, `dt` clamped to [0, {@link MAX_DT}] so a long frame cannot blow up.
 * Mutates and returns `state`.
 */
export function stepParticles(
  state: ParticleState,
  targets: Float32Array,
  dt: number,
  opts: SpringOptions = {},
): ParticleState {
  const [h, k] = [Math.min(sanitize(dt), MAX_DT), opts.stiffness ?? 60];
  const [c, lift] = [opts.damping ?? 2 * Math.sqrt(k), opts.lift ?? 0];
  const { pos, vel } = state;
  const len = Math.min(pos.length, vel.length, targets.length) - 2;
  for (let o = 0; o < len; o += 3) {
    const dx = targets[o] - pos[o];
    const dz = targets[o + 2] - pos[o + 2];
    vel[o] += (k * dx - c * vel[o]) * h;
    vel[o + 1] +=
      (k * (targets[o + 1] - pos[o + 1]) - c * vel[o + 1] + lift * Math.hypot(dx, dz)) * h;
    vel[o + 2] += (k * dz - c * vel[o + 2]) * h;
    pos[o] += vel[o] * h;
    pos[o + 1] += vel[o + 1] * h;
    pos[o + 2] += vel[o + 2] * h;
  }
  return state;
}

/** True when every particle is within `eps` of its target and nearly at rest. */
export function isSettled(state: ParticleState, targets: Float32Array, eps = 1e-3): boolean {
  const len = Math.min(state.pos.length, targets.length);
  for (let i = 0; i < len; i++) {
    if (Math.abs(targets[i] - state.pos[i]) > eps || Math.abs(state.vel[i]) > eps) return false;
  }
  return true;
}
