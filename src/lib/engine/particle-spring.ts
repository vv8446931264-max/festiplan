import { positiveOrZero } from "./shared";

// The motion half of the Budget Flow particle maths: a damped spring pulls every particle
// towards the target that `targetsFor` computed. Pure — mutates only the state it is given.

/** Positions and velocities, xyz per particle (length 3·n each). */
export type ParticleState = { pos: Float32Array; vel: Float32Array };

/**
 * Spring options: `stiffness` (unit mass, default 60), `damping` (default 2·√stiffness = critical),
 * `lift` (upward pull per unit of horizontal distance, so particles crossing columns arc).
 */
export type SpringOptions = { stiffness?: number; damping?: number; lift?: number };

/** Largest simulation step; longer frames (tab switches, jank) are clamped to it. */
export const MAX_DT = 1 / 30;

const AXES = 3;
const DEFAULT_STIFFNESS = 60;
const SETTLED_EPSILON = 1e-3;

/** Particle state for `count` particles at rest, starting at `init` (copied) or the origin. */
export function createParticleState(count: number, init?: Float32Array): ParticleState {
  const size = Math.floor(positiveOrZero(count)) * AXES;
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
  options: SpringOptions = {},
): ParticleState {
  const step = Math.min(positiveOrZero(dt), MAX_DT);
  const stiffness = options.stiffness ?? DEFAULT_STIFFNESS;
  const damping = options.damping ?? 2 * Math.sqrt(stiffness);
  const lift = options.lift ?? 0;
  const { pos, vel } = state;
  // Stop two short of the shortest buffer so the z index of the last particle stays in range.
  const end = Math.min(pos.length, vel.length, targets.length) - 2;
  // x, y and z index one particle's three components in the flat buffers.
  for (let x = 0; x < end; x += AXES) {
    const y = x + 1;
    const z = x + 2;
    const dx = targets[x] - pos[x];
    const dz = targets[z] - pos[z];
    const springY = stiffness * (targets[y] - pos[y]) - damping * vel[y];
    vel[x] += (stiffness * dx - damping * vel[x]) * step;
    vel[y] += (springY + lift * Math.hypot(dx, dz)) * step;
    vel[z] += (stiffness * dz - damping * vel[z]) * step;
    pos[x] += vel[x] * step;
    pos[y] += vel[y] * step;
    pos[z] += vel[z] * step;
  }
  return state;
}

/** True when every particle is within `epsilon` of its target and nearly at rest. */
export function isSettled(
  state: ParticleState,
  targets: Float32Array,
  epsilon = SETTLED_EPSILON,
): boolean {
  const end = Math.min(state.pos.length, targets.length);
  for (let index = 0; index < end; index++) {
    const offTarget = Math.abs(targets[index] - state.pos[index]) > epsilon;
    if (offTarget || Math.abs(state.vel[index]) > epsilon) return false;
  }
  return true;
}
