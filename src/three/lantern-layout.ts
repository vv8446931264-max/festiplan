import { hash01 } from "@/lib/engine/particles";
import { smoothstep, wrap } from "./math";

/**
 * Where every light lives and how it drifts — plain numbers, no three.js, so
 * the choreography is deterministic (the poster equals the live scene) and cheap.
 * Lights are lanterns (glass body + core + glow) or bodiless bokeh orbs (glow only).
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

const h = (i: number, k: number) => hash01(i * 11 + k);

function lantern(i: number): Light {
  const near = h(i, 1) < 0.07;
  const depth = near ? 5.5 + 3.5 * h(i, 2) : 10 + 46 * Math.pow(h(i, 2), 0.9);
  const side = h(i, 3) < 0.5 ? -1 : 1;
  const x = near ? side * (0.5 + 0.55 * h(i, 4)) : (h(i, 4) * 2 - 1) * 1.15;
  return {
    x,
    y: (h(i, 5) * 2 - 1) * 1.1 + (near ? 0.15 : 0),
    depth,
    size: 0.42 + 0.3 * h(i, 6),
    phase: h(i, 7) * Math.PI * 2,
    rise: 0.6 + 0.8 * h(i, 8),
    tone: Math.floor(h(i, 9) * 4),
    body: true,
  };
}

function orb(i: number): Light {
  const close = h(i, 21) < 0.5;
  return {
    x: (h(i, 22) * 2 - 1) * 1.2,
    y: (h(i, 23) * 2 - 1) * 1.1,
    depth: close ? 3 + 2.2 * h(i, 24) : 62 + 30 * h(i, 24),
    size: close ? 0.08 + 0.1 * h(i, 25) : 0.9 + 1.2 * h(i, 25),
    phase: h(i, 26) * Math.PI * 2,
    rise: 0.3 + 0.4 * h(i, 27),
    tone: Math.floor(h(i, 28) * 4),
    body: false,
  };
}

/** `lanterns` lanterns followed by `orbs` bokeh orbs, deterministic for a given count. */
export function placeLights(lanterns: number, orbs: number): Light[] {
  const out: Light[] = [];
  for (let i = 0; i < lanterns; i++) out.push(lantern(i));
  for (let i = 0; i < orbs; i++) out.push(orb(1000 + i));
  return out;
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

/**
 * Pose of `light` this frame: base screen position at its base depth, dollied
 * by `travel` (wrapping far ↔ near, faded at both ends), lifted and wrapped
 * vertically, swaying on two incommensurate sines (a cheap curl-like drift).
 */
export function poseFor(light: Light, f: FrameInput, out: Pose): Pose {
  const { near, far } = DEPTH_RANGE;
  const t = f.time;
  const p = light.phase;
  const d = light.body ? wrap(light.depth - f.travel, near, far) : light.depth;
  const halfH = d * f.tanHalf;
  const baseH = light.depth * f.tanHalf;
  const sway =
    Math.sin(t * 0.23 * (0.7 + light.rise * 0.4) + p) * 0.22 + Math.sin(t * 0.61 + p * 1.7) * 0.07;
  out.x = light.x * baseH * f.aspect + sway * (light.body ? 1 : 0.4);
  const lifted = light.y * baseH + f.lift * light.rise + Math.sin(t * 0.37 + p * 2.3) * 0.14;
  out.y = wrap(lifted, -halfH * 1.3, halfH * 1.3);
  out.z = -d;
  const edge = smoothstep(1.3, 1.08, Math.abs(out.y) / halfH);
  out.fade = light.body ? smoothstep(near, near + 2, d) * smoothstep(far, far - 8, d) * edge : edge;
  out.scale = light.size * out.fade;
  out.blur = d < FOCUS ? COC_NEAR * (FOCUS / d - 1) : COC_FAR * (1 - FOCUS / d);
  out.rx = Math.sin(t * 0.5 + p) * 0.1;
  out.ry = p * 3 + t * 0.04 * (light.rise - 1);
  out.rz = Math.sin(t * 0.41 + p * 1.3) * 0.12;
  return out;
}

/** A blank pose to reuse across frames. */
export function emptyPose(): Pose {
  return { x: 0, y: 0, z: 0, scale: 0, fade: 0, blur: 0, rx: 0, ry: 0, rz: 0 };
}
