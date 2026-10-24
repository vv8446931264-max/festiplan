import axe from "axe-core";

/**
 * Runs axe-core on a rendered container (WCAG 2.x A/AA). Colour contrast is
 * skipped because jsdom has no layout or computed colours — it is checked in the
 * Playwright suite against real rendering instead.
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
