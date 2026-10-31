import { hash01 } from "@/lib/engine/particles";
import { smoothstep, wrap } from "./math";

/**
 * Where every light lives and how it drifts — plain numbers, no three.js, so
 * the choreography is deterministic (the poster equals the live scene) and cheap.
 * Lights are lanterns (glass body + core + glow) or bodiless bokeh orbs (glow only).
 * Every property is a hash of (light index, salt), so the field is identical on every load.
 */

/** Static per-light parameters, hashed from the index. */
export type Light = {
  /** Normalised screen position at the base depth, roughly -1..1. */
  x: number;
  y: number;
  /** Base distance in front of the camera. */
  depth: number;
  size: number;
  phase: number;
  /** Personal rise-speed multiplier. */
  rise: number;
  /** Index into the tone tables. */
  tone: number;
  body: boolean;
};

/** One light's pose this frame; `blur` is the circle of confusion in half-viewport-height units. */
export type Pose = {
  x: number;
  y: number;
  z: number;
  scale: number;
  fade: number;
  blur: number;
  rx: number;
  ry: number;
  rz: number;
};

/** Nearest and farthest lantern distance; the field wraps between them. */
export const DEPTH_RANGE = { near: 4.5, far: 58 } as const;
/** Distance that is "in focus" for the fake depth of field. */
export const FOCUS = 9.5;
/**
 * Circle of confusion (fraction of half the viewport height): a long lens
 * focused on the near lanterns — the foreground melts into big discs, the
 * distance stays almost crisp, so far lanterns read as small lights, not dots.
 */
const COC_NEAR = 0.05;
const COC_FAR = 0.008;

/** Share of lanterns that float close to the camera as large, soft shapes. */
const NEAR_LANTERN_SHARE = 0.07;
/** Entries per tone table (lantern-tints.ts). */
const TONE_COUNT = 4;
/** Orbs hash from their own index range so they never mirror a lantern. */
const ORB_HASH_OFFSET = 1000;
/** Orbs are tiny or far away, so they sway less than lanterns. */
const ORB_SWAY_SCALE = 0.4;
/** Lights wrap vertically this far past the view edge (× half its height)… */
const VERTICAL_WRAP = 1.3;
/** …and fade in between there and here, so nothing pops in at the edge. */
const EDGE_FADE_END = 1.08;
/** Lanterns fade in over this distance after the near wrap and out before the far one. */
const DEPTH_FADE = { near: 2, far: 8 } as const;
const TAU = Math.PI * 2;

/** A deterministic 0..1 value for (light index, salt). */
const hash = (index: number, salt: number) => hash01(index * 11 + salt);
/** `base` plus up to `span`, picked by `unit` (0..1). */
const ranged = (base: number, span: number, unit: number) => base + span * unit;
/** Maps 0..1 onto -1..1. */
const signed = (unit: number) => unit * 2 - 1;

function lantern(index: number): Light {
  const near = hash(index, 1) < NEAR_LANTERN_SHARE;
  const side = hash(index, 3) < 0.5 ? -1 : 1;
  const farDepth = ranged(10, 46, Math.pow(hash(index, 2), 0.9));
  return {
    // Near lanterns keep to the left and right so they frame the text rather than cover it.
    x: near ? side * ranged(0.5, 0.55, hash(index, 4)) : signed(hash(index, 4)) * 1.15,
    y: signed(hash(index, 5)) * 1.1 + (near ? 0.15 : 0),
    depth: near ? ranged(5.5, 3.5, hash(index, 2)) : farDepth,
    size: ranged(0.42, 0.3, hash(index, 6)),
    phase: hash(index, 7) * TAU,
    rise: ranged(0.6, 0.8, hash(index, 8)),
    tone: Math.floor(hash(index, 9) * TONE_COUNT),
    body: true,
  };
}

function orb(index: number): Light {
  const close = hash(index, 21) < 0.5;
  return {
    x: signed(hash(index, 22)) * 1.2,
    y: signed(hash(index, 23)) * 1.1,
    // Close orbs are specks just in front of the lens; distant ones are large, faint discs.
    depth: close ? ranged(3, 2.2, hash(index, 24)) : ranged(62, 30, hash(index, 24)),
    size: close ? ranged(0.08, 0.1, hash(index, 25)) : ranged(0.9, 1.2, hash(index, 25)),
    phase: hash(index, 26) * TAU,
    rise: ranged(0.3, 0.4, hash(index, 27)),
    tone: Math.floor(hash(index, 28) * TONE_COUNT),
    body: false,
  };
}

/** `lanterns` lanterns followed by `orbs` bokeh orbs, deterministic for a given count. */
export function placeLights(lanterns: number, orbs: number): Light[] {
  const lights: Light[] = [];
  for (let index = 0; index < lanterns; index++) lights.push(lantern(index));
  for (let index = 0; index < orbs; index++) lights.push(orb(ORB_HASH_OFFSET + index));
  return lights;
}

/** Frame inputs shared by every light. */
export type FrameInput = {
  time: number;
  /** Damped dolly distance from scroll progress. */
  travel: number;
  /** Accumulated rise in world units (mood "plan" speeds it up). */
  lift: number;
  /** tan(fov / 2) and viewport aspect. */
  tanHalf: number;
  aspect: number;
};

/** Horizontal drift: a slow sway (quicker for fast risers) plus a gentle ripple. */
function swayAt(light: Light, time: number): number {
  const slow = Math.sin(time * 0.23 * (0.7 + light.rise * 0.4) + light.phase) * 0.22;
  const ripple = Math.sin(time * 0.61 + light.phase * 1.7) * 0.07;
  return slow + ripple;
}

/** Vertical bob on top of the steady rise. */
function bobAt(light: Light, time: number): number {
  return Math.sin(time * 0.37 + light.phase * 2.3) * 0.14;
}

/** Lanterns fade in just after the near wrap and out before the far wrap. */
function depthFade(depth: number): number {
  const { near, far } = DEPTH_RANGE;
  return (
    smoothstep(near, near + DEPTH_FADE.near, depth) * smoothstep(far, far - DEPTH_FADE.far, depth)
  );
}

function circleOfConfusion(depth: number): number {
  return depth < FOCUS ? COC_NEAR * (FOCUS / depth - 1) : COC_FAR * (1 - FOCUS / depth);
}

/**
 * Pose of `light` this frame: base screen position at its base depth, dollied
 * by `travel` (wrapping far ↔ near, faded at both ends), lifted and wrapped
 * vertically, swaying on two incommensurate sines (a cheap curl-like drift).
 */
export function poseFor(light: Light, frame: FrameInput, out: Pose): Pose {
  const { time, travel, lift, tanHalf, aspect } = frame;
  const { near, far } = DEPTH_RANGE;
  const depth = light.body ? wrap(light.depth - travel, near, far) : light.depth;
  const halfHeight = depth * tanHalf;
  const baseHalfHeight = light.depth * tanHalf;
  const sway = swayAt(light, time) * (light.body ? 1 : ORB_SWAY_SCALE);
  out.x = light.x * baseHalfHeight * aspect + sway;
  const lifted = light.y * baseHalfHeight + lift * light.rise + bobAt(light, time);
  out.y = wrap(lifted, -halfHeight * VERTICAL_WRAP, halfHeight * VERTICAL_WRAP);
  out.z = -depth;
  const edgeFade = smoothstep(VERTICAL_WRAP, EDGE_FADE_END, Math.abs(out.y) / halfHeight);
  out.fade = light.body ? depthFade(depth) * edgeFade : edgeFade;
  out.scale = light.size * out.fade;
  out.blur = circleOfConfusion(depth);
  // Gentle rocking plus a slow spin: quick risers turn one way, slow ones the other.
  out.rx = Math.sin(time * 0.5 + light.phase) * 0.1;
  out.ry = light.phase * 3 + time * 0.04 * (light.rise - 1);
  out.rz = Math.sin(time * 0.41 + light.phase * 1.3) * 0.12;
  return out;
}

/** A blank pose to reuse across frames. */
export function emptyPose(): Pose {
  return { x: 0, y: 0, z: 0, scale: 0, fade: 0, blur: 0, rx: 0, ry: 0, rz: 0 };
}
