import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type LdNode = { "@type": string; [key: string]: unknown };
type Question = { name: string; acceptedAnswer: { text: string } };

const meta = (page: Page, selector: string) => page.locator(selector).getAttribute("content");

/** Fetches a same-origin path taken from an absolute production URL and checks it is a PNG. */
async function expectPng(request: APIRequestContext, absolute: string | null) {
  expect(absolute).toMatch(/^https:\/\//);
  const url = new URL(absolute ?? "");
  const res = await request.get(`${url.pathname}${url.search}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
}

async function landingGraph(page: Page): Promise<LdNode[]> {
  const blocks = page.locator('script[type="application/ld+json"]');
  await expect(blocks).toHaveCount(1);
  const data = JSON.parse((await blocks.textContent()) ?? "") as { "@graph": LdNode[] };
  return data["@graph"];
}

test.describe("landing page SEO", () => {
  test("one h1, snippet-length title and description, canonical and social tags", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    expect((await page.title()).length).toBeGreaterThanOrEqual(50);
    expect((await page.title()).length).toBeLessThanOrEqual(60);
    const description = (await meta(page, 'meta[name="description"]')) ?? "";
    expect(description.length).toBeGreaterThanOrEqual(140);
    expect(description.length).toBeLessThanOrEqual(160);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toMatch(/^https:\/\/[^/]+$/);
    expect(await meta(page, 'meta[property="og:url"]')).toBe(canonical);
    expect(await meta(page, 'meta[property="og:type"]')).toBe("website");
    expect(await meta(page, 'meta[property="og:locale"]')).toBe("en_IN");
    expect(await meta(page, 'meta[property="og:site_name"]')).toBe("FestiPlan");
    expect(await meta(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(await meta(page, 'meta[property="og:image:width"]')).toBe("1200");
    expect(await meta(page, 'meta[property="og:image:height"]')).toBe("630");
    expect(await meta(page, 'meta[name="robots"]')).not.toContain("noindex");

    await expectPng(request, await meta(page, 'meta[property="og:image"]'));
    await expectPng(request, await meta(page, 'meta[name="twitter:image"]'));
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    await expectPng(request, new URL(apple ?? "", canonical ?? "").href);
  });

  test("JSON-LD parses, describes the app and mirrors the visible FAQ", async ({ page }) => {
    await page.goto("/");
    const graph = await landingGraph(page);
    const types = graph.map((n) => n["@type"]);
    expect(types).toEqual(
      expect.arrayContaining(["WebApplication", "FAQPage", "WebSite", "Organization"]),
    );
    const app = graph.find((n) => n["@type"] === "WebApplication");
    expect(app).toMatchObject({
      applicationCategory: "LifestyleApplication",
      offers: { price: "0", priceCurrency: "INR" },
    });
    expect(app?.url).toBe(await page.locator('link[rel="canonical"]').getAttribute("href"));

    const faq = graph.find((n) => n["@type"] === "FAQPage")?.mainEntity as Question[];
    const questions = await page
      .locator("#faq summary > span:not([aria-hidden])")
      .allTextContents();
    const answers = await page.locator("#faq details > p").allTextContents();
    expect(questions).toEqual(faq.map((q) => q.name));
    expect(answers).toEqual(faq.map((q) => q.acceptedAnswer.text));

    const first = page.locator("#faq details").first();
    await first.locator("summary").click();
    await expect(first.locator("p")).toBeVisible();
  });

  test("JSON-LD carries this response's CSP nonce and no raw <", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"] ?? "";
    const html = await res.text();
    const match = /<script type="application\/ld\+json" nonce="([^"]+)">([\s\S]*?)<\/script>/.exec(
      html,
    );
    expect(match).not.toBeNull();
    expect(csp).toContain(`'nonce-${match?.[1]}'`);
    expect(match?.[2]).not.toContain("<");
  });
});

test.describe("crawl files", () => {
  test("robots.txt, sitemap.xml and the manifest agree with the canonical URL", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
    expect(robots).toMatch(/^Disallow: \/plan\/$/m);
    expect(robots).toContain(`Sitemap: ${canonical}/sitemap.xml`);

    const sitemapRes = await request.get("/sitemap.xml");
    expect(sitemapRes.headers()["content-type"]).toContain("xml");
    const sitemap = await sitemapRes.text();
    expect([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([canonical]);
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(sitemap)?.[1] ?? "";
    expect(Number.isNaN(Date.parse(lastmod))).toBe(false);

    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as {
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    expect(manifest.icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain(icon.type);
    }
  });

  test("plan pages stay out of the index and unknown plans 404", async ({ request, baseURL }) => {
    const eventDate = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
    const created = await request.post("/api/plan", {
      headers: { origin: baseURL ?? "" },
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
    const { plan } = (await created.json()) as { plan: { id: string } };

    const res = await request.get(`/plan/${plan.id}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    const html = await res.text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"\/>/);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("application/ld+json");

    const missing = await request.get("/plan/doesnotexist");
    expect(missing.status()).toBe(404);
    expect(missing.headers()["x-robots-tag"]).toContain("noindex");
  });
});
