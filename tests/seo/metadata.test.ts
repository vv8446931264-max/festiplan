import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SEO_COPY } from "@/lib/seo/copy";
import { homeMetadata, rootMetadata } from "@/lib/seo/metadata";
import { IMAGE_ROUTES, SITE_URL, absoluteUrl } from "@/lib/site";

describe("search copy", () => {
  it("keeps the title within 50–60 characters", () => {
    expect(SEO_COPY.title.length).toBeGreaterThanOrEqual(50);
    expect(SEO_COPY.title.length).toBeLessThanOrEqual(60);
  });

  it("keeps the description within 140–160 characters", () => {
    expect(SEO_COPY.description.length).toBeGreaterThanOrEqual(140);
    expect(SEO_COPY.description.length).toBeLessThanOrEqual(160);
  });
});

describe("absoluteUrl", () => {
  it("renders the root as the bare origin, like Next.js canonicals", () => {
    expect(absoluteUrl("/")).toBe(SITE_URL);
    expect(absoluteUrl()).toBe(SITE_URL);
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("joins paths with exactly one slash", () => {
    expect(absoluteUrl("/sitemap.xml")).toBe(`${SITE_URL}/sitemap.xml`);
    expect(absoluteUrl("icon/512")).toBe(`${SITE_URL}/icon/512`);
  });
});

describe("rootMetadata", () => {
  const meta = rootMetadata();

  it("sets title template, description, Open Graph and a large Twitter card", () => {
    expect(meta.title).toEqual({ default: SEO_COPY.title, template: "%s · FestiPlan" });
    expect(meta.description).toBe(SEO_COPY.description);
    expect(meta.openGraph).toMatchObject({ type: "website", siteName: "FestiPlan", locale: "en_IN" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("has no canonical or og:url that private plan pages would inherit", () => {
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).not.toHaveProperty("url");
  });
});

describe("homeMetadata", () => {
  const meta = homeMetadata();

  it("declares the canonical URL and og:url for the landing page", () => {
    expect(meta.alternates?.canonical).toBe("/");
    expect(meta.openGraph).toMatchObject({ url: "/", locale: "en_IN", siteName: "FestiPlan", type: "website" });
  });

  it("stays indexable and allows large image previews", () => {
    expect(meta.robots).toEqual({ "max-image-preview": "large" });
  });
});

describe("robots.txt", () => {
  it("allows the landing page, blocks plans and the API, and links the sitemap", () => {
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/", "/plan/"] });
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("lists only the landing page, absolute, with a last-modified date", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe(absoluteUrl("/"));
    expect(entries[0].lastModified).toBeInstanceOf(Date);
  });
});

describe("web app manifest", () => {
  const m = manifest();

  it("offers SVG plus 192/512 PNG icons and a maskable icon", () => {
    const icons = m.icons ?? [];
    expect(icons).toContainEqual({ src: "/icon.svg", sizes: "any", type: "image/svg+xml" });
    expect(icons).toContainEqual(expect.objectContaining({ src: IMAGE_ROUTES.icon192, sizes: "192x192", type: "image/png" }));
    expect(icons).toContainEqual(expect.objectContaining({ src: IMAGE_ROUTES.icon512, sizes: "512x512", type: "image/png" }));
    expect(icons).toContainEqual(expect.objectContaining({ src: IMAGE_ROUTES.icon512, purpose: "maskable" }));
  });

  it("describes the app in its own language and scope", () => {
    expect(m).toMatchObject({ id: "/", start_url: "/", scope: "/", lang: "en-IN", display: "standalone" });
    expect(m.description).toBe(SEO_COPY.description);
  });
});
