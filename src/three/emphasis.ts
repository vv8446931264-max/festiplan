/**
 * How one budget category is drawn while a category is highlighted. Shared by the WebGL
 * Budget Flow and its static SVG fallback so both react to hover the same way. No three.js.
 */
export type Emphasis = "normal" | "lit" | "dimmed";

/** Without a highlight every category is normal; otherwise the highlighted one is lit and the rest dimmed. */
export function emphasisOf<Category>(category: Category, highlight: Category | null): Emphasis {
  if (highlight === null) return "normal";
  return category === highlight ? "lit" : "dimmed";
}
