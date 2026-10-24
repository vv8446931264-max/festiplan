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
  { at: 0, color: "#0d0624" },
  { at: 0.2, color: "#1a0838" },
  { at: 0.38, color: "#350b47" },
  { at: 0.52, color: "#561345" },
  { at: 0.63, color: "#6e2231" },
  { at: 0.72, color: "#4a1f12" },
  { at: 0.84, color: "#1d0f07" },
  { at: 1, color: "#100904" },
];

/** Espresso, the page colour the sky dissolves into. */
export const ESPRESSO = "#100904";

const ramp = DUSK_STOPS.map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ");

/**
 * CSS background layers: a low ember/gold horizon glow left of centre (behind the
 * hero's empty column, where the lanterns cluster) over the vertical ramp.
 */
export const DUSK_BACKGROUND = [
  "radial-gradient(70% 34% at 28% 64%, rgb(255 191 2 / 0.16), transparent 70%)",
  "radial-gradient(110% 46% at 34% 62%, rgb(233 80 14 / 0.24), transparent 72%)",
  "radial-gradient(90% 40% at 78% 40%, rgb(140 1 156 / 0.18), transparent 70%)",
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
