import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Runs axe against WCAG 2.0–2.2 A/AA rules and fails on any violation. */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

/** Reads every budget line plus contingency from the DOM data attributes. */
export async function budgetSum(page: Page): Promise<number> {
  const amounts = await page
    .locator("[data-category][data-amount]")
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-amount"))));
  const contingency = Number(await page.locator("[data-contingency]").getAttribute("data-contingency"));
  return amounts.reduce((a, b) => a + b, 0) + contingency;
}

/** Taps a demo preset and waits for the plan to unfold. */
export async function planFromPreset(page: Page, label: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: label }).click();
  await expect(page.getByRole("heading", { level: 2, name: /./ }).and(page.locator("#plan-title"))).toBeVisible({
    timeout: 60_000,
  });
}
