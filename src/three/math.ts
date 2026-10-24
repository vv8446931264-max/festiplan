/** Small frame-rate independent helpers shared by the scenes. No three.js import. */

/** Exponential smoothing towards `target`; `lambda` ≈ 1 / time constant (s⁻¹). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Hermite smoothstep between `e0` and `e1` (works with e0 > e1 for a falling edge). */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Wrap `x` into [min, max). */
export function wrap(x: number, min: number, max: number): number {
  const span = max - min;
  return ((((x - min) % span) + span) % span) + min;
}

/** Clamp to [0, 1]; non-finite input becomes 0. */
export function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(Math.max(x, 0), 1) : 0;
}
