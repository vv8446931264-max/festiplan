/**
 * The dusk sky, defined once (docs/DESIGN.md §3 `--dusk`). The DOM backdrop paints
 * it with CSS; the lantern scene re-creates the same vertical ramp inside its
 * transmission pass so the glass refracts the sky that is really behind it. No
 * three.js import — the SSR'd backdrop and the poster harness use this too.
 */

/**
 * Vertical ramp, top → bottom: the gradient stops #250187 → #8C019C → #CD197D →
 * #E9500E → #FFBF02 read as zenith → horizon, each mixed into espresso so cream
 * text stays ≥ 4.5:1 on top of it, then the "ground" falls into espresso #100904.
 */
export const DUSK_STOPS: readonly { at: number; color: string }[] = [
  { at: 0, color: "#0c0620" },
  { at: 0.22, color: "#170832" },
  { at: 0.4, color: "#2c0a40" },
  { at: 0.53, color: "#46103f" },
  { at: 0.63, color: "#5a1b2b" },
  { at: 0.72, color: "#3c1810" },
  { at: 0.84, color: "#1a0e06" },
  { at: 1, color: "#100904" },
];

/** Espresso, the page colour the sky dissolves into. */
export const ESPRESSO = "#100904";

/** 180 px tile of SVG fractal-noise film grain (~3 % white): hides 8-bit banding. */
const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E" +
  "%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E" +
  "%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .07 0'/%3E%3C/filter%3E" +
  "%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E";

const ramp = DUSK_STOPS.map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ");

/**
 * CSS background layers: film grain, a low ember/gold horizon glow left of centre
 * (behind the hero's empty column, where the lanterns cluster), a plum haze, and
 * the vertical ramp.
 */
export const DUSK_BACKGROUND = [
  `url("${GRAIN}") 0 0 / 180px 180px`,
  "radial-gradient(60% 26% at 26% 66%, rgb(255 191 2 / 0.09), transparent 70%)",
  "radial-gradient(100% 40% at 32% 63%, rgb(233 80 14 / 0.16), transparent 72%)",
  "radial-gradient(80% 36% at 80% 42%, rgb(140 1 156 / 0.14), transparent 70%)",
  `linear-gradient(180deg, ${ramp})`,
].join(", ");

/**
 * How much of the sky remains at document scroll progress `p` (0..1): full at
 * the hero, easing to 45 % by a quarter of the page so later chapters sit on a
 * darker field. Shared by the CSS layer and the refraction shader.
 */
export function skyFade(p: number): number {
  const t = Math.min(Math.max(p / 0.25, 0), 1);
  return 1 - 0.55 * t * t * (3 - 2 * t);
}
