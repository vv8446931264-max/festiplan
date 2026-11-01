import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { DAY_MS } from "../src/lib/time";
import { PLAN_TABS, openTab, planFromPreset } from "./helpers";

/*
 * `style-src` allows only this request's nonce. The browser therefore drops every `style`
 * attribute it parses and every `<style>` without the nonce, so a page that ships either looks
 * wrong and logs a violation. These tests check the server HTML for both, then run the pages
 * in a real browser and count violations. The e2e server is a production build, so the policy
 * under test is the production one.
 */

const EVENT_DAYS_AHEAD = 90;

/** Creates a birthday plan through the API (template mode in e2e). */
async function createPlan(request: APIRequestContext, origin: string) {
  const eventDate = new Date(Date.now() + EVENT_DAYS_AHEAD * DAY_MS).toISOString().slice(0, 10);
  const created = await request.post("/api/plan", {
    headers: { origin },
    data: {
      eventType: "birthday",
      eventDate,
      city: "Pune",
      guests: 30,
      budgetINR: 40_000,
      vibe: "dinosaurs",
      constraints: [],
      language: "en",
    },
  });
  expect(created.status()).toBe(201);
  const { plan, editKey } = (await created.json()) as { plan: { id: string }; editKey: string };
  return { path: `/plan/${plan.id}`, editKey };
}

/** Fetches a page: the policy must allow styles by nonce only, and the HTML must need no more. */
async function expectNoInlineStyles(request: APIRequestContext, path: string, status = 200) {
  const res = await request.get(path);
  expect(res.status()).toBe(status);
  const policy = res.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";
  expect(nonce).not.toBe("");
  expect(policy).toContain(`style-src 'self' 'nonce-${nonce}'`);
  expect(policy).not.toContain("'unsafe-inline'");

  const html = await res.text();
  expect(html).not.toMatch(/\sstyle\s*=/i);
  const unnonced = (html.match(/<style\b[^>]*>/gi) ?? []).filter(
    (tag) => !tag.includes(`nonce="${nonce}"`),
  );
  expect(unnonced).toEqual([]);
}

/**
 * Starts recording, before the page's first script runs, every `securitypolicyviolation` event
 * and every console error about the policy. Returns the check to run once the page has settled.
 */
async function watchPolicy(page: Page) {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy/i.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    const raised: string[] = [];
    Object.assign(window, { cspViolations: raised });
    document.addEventListener("securitypolicyviolation", (event) => {
      raised.push(`${event.effectiveDirective} blocked ${event.blockedURI || "inline"}`);
    });
  });
  return async () => {
    const events = await page.evaluate(() => Reflect.get(window, "cspViolations") as string[]);
    expect({ events, consoleErrors }).toEqual({ events: [], consoleErrors: [] });
  };
}

/** Waits for the lazy backdrop chunk to mount, then for the WebGL chunks it may pull in. */
async function settle(page: Page) {
  await expect(page.locator("[data-scene-backdrop]")).not.toHaveAttribute("data-tier", "pending");
  await page.waitForLoadState("networkidle");
}

test.describe("server HTML", () => {
  test("the landing page ships no inline styles", async ({ request }) => {
    await expectNoInlineStyles(request, "/");
  });

  test("a shared plan ships none either", async ({ request, baseURL }) => {
    const { path } = await createPlan(request, baseURL ?? "");
    await expectNoInlineStyles(request, path);
  });

  test("nor does the 404 page", async ({ request }) => {
    await expectNoInlineStyles(request, "/plan/doesnotexist", 404);
  });
});

test.describe("browser", () => {
  test("the landing page raises no CSP violation", async ({ page }) => {
    const expectQuiet = await watchPolicy(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("FestiPlan");
    await settle(page);
    await expectQuiet();
  });

  test("a shared plan raises none in any tab, as its owner", async ({ page, request, baseURL }) => {
    const { path, editKey } = await createPlan(request, baseURL ?? "");
    const expectQuiet = await watchPolicy(page);
    await page.goto(`${path}#edit=${editKey}`);
    await expect(page.locator("#plan-title")).toBeVisible();
    for (const tab of PLAN_TABS) await openTab(page, tab);
    // Switch back to Budget so its sliders are in the visible (non-hidden) panel.
    await openTab(page, "Budget");
    // The edit key came in the fragment: the owner's sliders have replaced the read-only meters.
    await expect(page.getByRole("slider").first()).toBeVisible();
    await settle(page);
    await expectQuiet();
  });

  test("a plan generated in the page raises none in any tab", async ({ page }) => {
    const expectQuiet = await watchPolicy(page);
    await planFromPreset(page, /Rahul's dino birthday/);
    for (const tab of PLAN_TABS) await openTab(page, tab);
    await settle(page);
    await expectQuiet();
  });
});
