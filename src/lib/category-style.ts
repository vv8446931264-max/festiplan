import type { BudgetCategory } from "./contracts";

/**
 * Category colours drawn from the dusk gradient, olive and gold (docs/DESIGN.md §3).
 * Colour is never the only signal: every swatch sits next to its text label and the
 * pattern below, so the budget reads the same in greyscale.
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

/** CSS background patterns that pair with each colour for non-colour differentiation. */
export const CATEGORY_PATTERNS: Record<BudgetCategory, string> = {
  venue: "none",
  catering: "repeating-linear-gradient(45deg, rgb(0 0 0 / .28) 0 2px, transparent 2px 6px)",
  decor: "radial-gradient(rgb(0 0 0 / .32) 1px, transparent 1.5px) 0 0 / 5px 5px",
  photography: "repeating-linear-gradient(90deg, rgb(0 0 0 / .28) 0 2px, transparent 2px 6px)",
  entertainment: "repeating-linear-gradient(-45deg, rgb(0 0 0 / .28) 0 2px, transparent 2px 6px)",
  attire: "repeating-linear-gradient(0deg, rgb(0 0 0 / .28) 0 2px, transparent 2px 6px)",
  invitations: "repeating-conic-gradient(rgb(0 0 0 / .25) 0 25%, transparent 0 50%) 0 0 / 6px 6px",
  gifts: "radial-gradient(rgb(0 0 0 / .3) 1.5px, transparent 2px) 0 0 / 7px 7px",
  transport: "repeating-linear-gradient(135deg, rgb(0 0 0 / .3) 0 1px, transparent 1px 4px)",
  misc: "repeating-linear-gradient(45deg, rgb(0 0 0 / .18) 0 1px, transparent 1px 8px)",
};
