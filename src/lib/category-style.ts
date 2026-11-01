import type { BudgetCategory } from "@/lib/contracts";

/**
 * Category colours drawn from the dusk gradient, olive and gold (docs/DESIGN.md §3), for
 * the places CSS cannot reach: the Budget Flow's SVG fallback and its WebGL scene. DOM
 * swatches and bars take the same colour plus a pattern from `[data-category-fill]` in
 * src/app/globals.css (no inline styles under the CSP); tests/security/csp-stylesheet.test.ts
 * keeps the two in step. Colour is never the only signal: every swatch sits next to its
 * text label and carries its pattern, so the budget reads the same in greyscale.
 */
export const CATEGORY_COLORS: Record<BudgetCategory, string> = {
  venue: "#FFBF02",
  catering: "#F58A07",
  decor: "#E9500E",
  photography: "#CD197D",
  entertainment: "#A23BC4",
  attire: "#7B6BE0",
  invitations: "#8FA36A",
  gifts: "#C9D88F",
  transport: "#BBAC97",
  misc: "#FFEDD7",
};
