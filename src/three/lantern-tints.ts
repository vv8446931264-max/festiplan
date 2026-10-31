import { Color } from "three";
import type { Light } from "./lantern-layout";

/** Warm defaults (sRGB): glass tint, core, glow — four tones each, picked by `Light.tone`. */
const TONES = {
  body: ["#ffe9cf", "#ffdcb3", "#ffd2a4", "#fff3e3"],
  core: ["#fff3da", "#ffe3ad", "#ffd58f", "#fff8ea"],
  glow: ["#ffa24a", "#ffb862", "#ff8c3e", "#ffc874"],
} as const;

/** How far each part leans toward a concept palette colour (0 = warm default, 1 = palette). */
const PALETTE_MIX = { body: 0.6, core: 0.22, glow: 0.55 } as const;

/** Colour easing rate (1/s) after a palette change. */
const TINT_EASE_RATE = 2.4;

const PARTS = ["body", "core", "glow"] as const;

/** Per-light linear RGB triples for the glass body, the core and the glow. */
export type Tints = Record<(typeof PARTS)[number], Float32Array>;

/** Zeroed tints for `count` lights. */
export function createTints(count: number): Tints {
  return {
    body: new Float32Array(count * 3),
    core: new Float32Array(count * 3),
    glow: new Float32Array(count * 3),
  };
}

/** An independent copy of `tints`. */
export function copyTints(tints: Tints): Tints {
  return { body: tints.body.slice(), core: tints.core.slice(), glow: tints.glow.slice() };
}

/** Target colours: each light's warm tone, mixed toward a palette colour (cycled) if given. */
export function toneTargets(
  lights: readonly Light[],
  palette: readonly string[] | null,
  out: Tints,
): void {
  const color = new Color();
  const paletteColor = new Color();
  lights.forEach((light, index) => {
    const accent = palette ? paletteColor.set(palette[index % palette.length]) : null;
    for (const part of PARTS) {
      color.set(TONES[part][light.tone]);
      if (accent) color.lerp(accent, PALETTE_MIX[part]);
      color.toArray(out[part], index * 3);
    }
  });
}

/** Ease `current` toward `target`, frame-rate independently. */
export function easeTints(current: Tints, target: Tints, dt: number): void {
  const blend = 1 - Math.exp(-TINT_EASE_RATE * dt);
  for (const part of PARTS) {
    const values = current[part];
    const goal = target[part];
    for (let index = 0; index < values.length; index++) {
      values[index] += (goal[index] - values[index]) * blend;
    }
  }
}
