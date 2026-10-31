import { describe, expect, it } from "vitest";
import { FEATURES, SEO_COPY } from "@/lib/seo/copy";
import { FAQ } from "@/lib/seo/faq";
import {
  buildLandingJsonLd,
  faqPageNode,
  serializeJsonLd,
  type JsonLdNode,
} from "@/lib/seo/json-ld";
import { landingJsonLd } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/site";

const input = {
  siteUrl: "https://example.test",
  name: "FestiPlan",
  description: "A description.",
  language: "en-IN",
  imageUrl: "https://example.test/opengraph-image",
  logoUrl: "https://example.test/icon/512",
  features: ["One", "Two"],
  faq: [{ id: "q", question: "Why?", answer: "Because." }],
} as const;

const byType = (nodes: readonly JsonLdNode[], type: string) => {
  const node = nodes.find((n) => n["@type"] === type);
  if (!node) throw new Error(`no ${type} node`);
  return node;
};

/** Every `{ "@id": … }` reference anywhere inside a value. */
function refs(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => refs(v, found));
  else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "@id")
      found.push(String((value as { "@id": unknown })["@id"]));
    else Object.values(value).forEach((v) => refs(v, found));
  }
  return found;
}

describe("buildLandingJsonLd", () => {
  const graph = buildLandingJsonLd(input);
  const nodes = graph["@graph"];

  it("is a schema.org graph of WebSite, Organization, WebApplication and FAQPage", () => {
    expect(graph["@context"]).toBe("https://schema.org");
    expect(nodes.map((n) => n["@type"])).toEqual([
      "WebSite",
      "Organization",
      "WebApplication",
      "FAQPage",
    ]);
    expect(new Set(nodes.map((n) => n["@id"])).size).toBe(nodes.length);
  });

  it("describes a free web app with the required fields", () => {
    const app = byType(nodes, "WebApplication");
    expect(app).toMatchObject({
      name: "FestiPlan",
      url: "https://example.test",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "en-IN",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      featureList: ["One", "Two"],
    });
  });

  it("never claims ratings or reviews", () => {
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|"review"|ratingValue/i);
  });

  it("only references nodes that exist in the graph", () => {
    const ids = new Set(nodes.map((n) => n["@id"]));
    for (const id of refs(nodes.map(({ "@id": _id, ...rest }) => rest))) expect(ids).toContain(id);
  });

  it("gives the organization a raster logo", () => {
    expect(byType(nodes, "Organization").logo).toBe(input.logoUrl);
  });
});

describe("faqPageNode", () => {
  it("mirrors the visible FAQ word for word, in order", () => {
    const node = faqPageNode(SITE_URL, FAQ);
    const entities = node.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities.map((e) => e.name)).toEqual(FAQ.map((f) => f.question));
    expect(entities.map((e) => e.acceptedAnswer.text)).toEqual(FAQ.map((f) => f.answer));
  });
});

describe("serializeJsonLd", () => {
  it("escapes every < so data cannot close the script element", () => {
    const hostile = { text: "</script><script>alert(1)</script><!--" };
    const out = serializeJsonLd(hostile);
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
    expect(JSON.parse(out)).toEqual(hostile);
  });

  it("serialises undefined as null instead of throwing", () => {
    expect(serializeJsonLd(undefined)).toBe("null");
  });
});

describe("landingJsonLd", () => {
  const graph = landingJsonLd();
  const text = serializeJsonLd(graph);

  it("uses absolute https URLs on the public origin", () => {
    const urls = text.match(/https?:\/\/[^"\\]+/g) ?? [];
    const own = urls.filter((u) => u !== "https://schema.org");
    expect(own.length).toBeGreaterThan(0);
    for (const url of own) expect(url.startsWith(SITE_URL)).toBe(true);
  });

  it("carries the page description, features and every FAQ item", () => {
    expect(byType(graph["@graph"], "WebApplication")).toMatchObject({
      description: SEO_COPY.description,
      featureList: [...FEATURES],
    });
    expect((byType(graph["@graph"], "FAQPage").mainEntity as unknown[]).length).toBe(FAQ.length);
  });
});
