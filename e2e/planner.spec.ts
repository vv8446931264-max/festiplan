import { expect, test } from "@playwright/test";
import { PLAN_TABS, budgetSum, expectNoA11yViolations, openTab, planFromPreset } from "./helpers";

test.describe("landing", () => {
  test("renders the hero and passes axe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("FestiPlan");
    await expect(page.getByRole("link", { name: /start planning/i }).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("an empty brief shows a focused error summary that links to fields", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /plan my celebration/i }).click();
    const summary = page.getByRole("alert").filter({ hasText: "There's a problem" });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("Choose what you're celebrating.");
    await summary.getByRole("link", { name: /enter the city/i }).click();
    await expect(page.locator("#field-city")).toBeFocused();
  });
});

test.describe("plan", () => {
  test("preset → plan → exact budget → checklist → shared page", async ({ page, request }) => {
    await planFromPreset(page, /Priya's sangeet/);
    await expect(page.locator("#plan-title")).toHaveText("Riya's sangeet");
    await expect(page).toHaveURL(/\/plan\/[A-Za-z0-9_-]+/);
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await openTab(page, "Budget");
    await expect(page.getByRole("heading", { name: /12,00,000, accounted for/ })).toBeVisible();
    expect(await budgetSum(page)).toBe(1_200_000);
    const decor = page.getByRole("slider", { name: "Décor" });
    await decor.focus();
    for (let i = 0; i < 8; i++) await decor.press("ArrowRight");
    expect(await budgetSum(page)).toBe(1_200_000);

    await openTab(page, "Timeline");
    const boxes = page.locator("#panel-timeline input[type=checkbox]:visible");
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });

    await openTab(page, "Share");
    const shareUrl = await page.locator("#share-link").inputValue();
    const shared = await request.get(shareUrl);
    expect(shared.headers()["x-robots-tag"]).toContain("noindex");
    const html = await shared.text();
    expect(html).toContain("Riya&#x27;s sangeet");
    expect(html).toContain("Rajasthani");

    await page.goto(shareUrl);
    await expect(page.locator("#plan-title")).toHaveText("Riya's sangeet");
    await expect(page.locator("#panel-timeline input[type=checkbox]:checked")).toHaveCount(2);
    expect(await budgetSum(page)).toBe(1_200_000);
    for (const tab of PLAN_TABS) {
      await openTab(page, tab);
      await expectNoA11yViolations(page);
    }
  });

  test("a new plan keeps its URL, edit rights and chosen tab across a refresh", async ({
    page,
  }) => {
    await planFromPreset(page, /Rahul's dino birthday/);
    await openTab(page, "Budget");
    await expect(page).toHaveURL(/\/plan\/[A-Za-z0-9_-]+#budget$/);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Budget" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("slider").first()).toBeVisible();
  });

  test("a read-only viewer sees no edit controls", async ({ page, browser }) => {
    await planFromPreset(page, /Meera's Diwali mela/);
    const url = new URL(page.url());
    const stranger = await browser.newPage();
    await stranger.goto(`${url.origin}${url.pathname}`);
    await expect(stranger.getByText("Read-only", { exact: true })).toBeVisible();
    await openTab(stranger, "Budget");
    await expect(stranger.getByRole("slider")).toHaveCount(0);
    await openTab(stranger, "Timeline");
    await expect(stranger.locator("#panel-timeline input[type=checkbox]")).toHaveCount(0);
    await stranger.close();
  });

  test("calendar export is valid iCalendar", async ({ page, request }) => {
    await planFromPreset(page, /Rahul's dino birthday/);
    await openTab(page, "Timeline");
    const href = await page.getByRole("link", { name: /\.ics/ }).first().getAttribute("href");
    const res = await request.get(href ?? "");
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  test("unknown plans 404 with a helpful page", async ({ page }) => {
    const res = await page.goto("/plan/doesnotexist123");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("left the party");
  });
});

test("health reports the live backends", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
