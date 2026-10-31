import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.0–2.2, levels A and AA. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Generous ceiling for a full plan generation (model call plus scheduling). */
const PLAN_READY_TIMEOUT_MS = 60_000;

/**
 * Runs axe against WCAG 2.0–2.2 A/AA rules and fails on any violation. Waits for
 * time-based entrance animations first: mid-fade text would read as low contrast.
 */
export async function expectNoA11yViolations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" || animation.timeline !== document.timeline,
      ),
  );
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((violation) => {
    const targets = violation.nodes.map((node) => node.target.join(" "));
    return `${violation.id}: ${targets.join(", ")}`;
  });
  expect(summary).toEqual([]);
}

/** Reads every budget line plus contingency from the DOM data attributes. */
export async function budgetSum(page: Page): Promise<number> {
  const amounts = await page
    .locator("[data-category][data-amount]")
    .evaluateAll((lines) => lines.map((line) => Number(line.getAttribute("data-amount"))));
  const contingency = Number(
    await page.locator("[data-contingency]").getAttribute("data-contingency"),
  );
  return amounts.reduce((total, amount) => total + amount, contingency);
}

/** Taps a demo preset and waits for the plan to unfold. */
export async function planFromPreset(page: Page, label: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: label }).click();
  const planTitle = page
    .getByRole("heading", { level: 2, name: /./ })
    .and(page.locator("#plan-title"));
  await expect(planTitle).toBeVisible({ timeout: PLAN_READY_TIMEOUT_MS });
}

/** Switches the plan workspace to a tab and waits for its panel. */
export async function openTab(page: Page, name: string) {
  await page.getByRole("tab", { name, exact: true }).click();
  await expect(page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
}

/** Every tab of the plan workspace, in order. */
export const PLAN_TABS = [
  "Overview",
  "Ideas",
  "Budget",
  "Timeline",
  "Vendors",
  "Ask",
  "Share",
] as const;
