import type { FaqItem } from "./faq";

/** One schema.org node; values are plain JSON. */
export type JsonLdNode = { readonly "@type": string; readonly "@id": string; readonly [key: string]: unknown };

/** A JSON-LD document with every node in one `@graph`, cross-referenced by `@id`. */
export type JsonLdGraph = { readonly "@context": "https://schema.org"; readonly "@graph": readonly JsonLdNode[] };

/** Everything the landing-page graph needs; passed in so the builder stays pure. */
export type LandingJsonLdInput = {
  /** Canonical URL of the landing page, e.g. `https://example.run.app` (no trailing slash). */
  readonly siteUrl: string;
  readonly name: string;
  readonly description: string;
  /** BCP 47 language of the page, e.g. `en-IN`. */
  readonly language: string;
  readonly imageUrl: string;
  readonly logoUrl: string;
  readonly features: readonly string[];
  readonly faq: readonly FaqItem[];
};

const ref = (siteUrl: string, fragment: string) => ({ "@id": `${siteUrl}/#${fragment}` });

function websiteNode(i: LandingJsonLdInput): JsonLdNode {
  return {
    "@type": "WebSite",
    ...ref(i.siteUrl, "website"),
    url: i.siteUrl,
    name: i.name,
    inLanguage: i.language,
    publisher: ref(i.siteUrl, "organization"),
  };
}

function organizationNode(i: LandingJsonLdInput): JsonLdNode {
  return {
    "@type": "Organization",
    ...ref(i.siteUrl, "organization"),
    name: i.name,
    url: i.siteUrl,
    logo: i.logoUrl,
  };
}

/** The product itself. Free, browser-based; deliberately no ratings or reviews (we have none to cite). */
function applicationNode(i: LandingJsonLdInput): JsonLdNode {
  return {
    "@type": "WebApplication",
    ...ref(i.siteUrl, "app"),
    name: i.name,
    url: i.siteUrl,
    description: i.description,
    image: i.imageUrl,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any",
    inLanguage: i.language,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    featureList: [...i.features],
    publisher: ref(i.siteUrl, "organization"),
  };
}

/**
 * `FAQPage` built from the same items the landing page renders, so the markup always matches
 * the visible questions and answers word for word.
 * @param siteUrl canonical URL of the page that shows the FAQ
 * @param faq the visible FAQ items, in display order
 */
export function faqPageNode(siteUrl: string, faq: readonly FaqItem[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    ...ref(siteUrl, "faq"),
    url: siteUrl,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * The landing page's structured data: `WebSite`, `Organization`, `WebApplication` and
 * `FAQPage` nodes in one graph. Pure: same input, same output.
 * @param input page facts; see {@link LandingJsonLdInput}
 */
export function buildLandingJsonLd(input: LandingJsonLdInput): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [websiteNode(input), organizationNode(input), applicationNode(input), faqPageNode(input.siteUrl, input.faq)],
  };
}

/**
 * JSON for an inline `<script type="application/ld+json">`. Every `<` becomes `<`, so no
 * string inside the data can close the script element or open an HTML comment.
 * @param data any JSON-serialisable value
 */
export function serializeJsonLd(data: unknown): string {
  return (JSON.stringify(data) ?? "null").replace(/</g, "\\u003c");
}
