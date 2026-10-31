import type { FaqItem } from "./faq";

/** One schema.org node; values are plain JSON. */
export type JsonLdNode = {
  readonly "@type": string;
  readonly "@id": string;
  readonly [key: string]: unknown;
};

/** A JSON-LD document with every node in one `@graph`, cross-referenced by `@id`. */
export type JsonLdGraph = {
  readonly "@context": "https://schema.org";
  readonly "@graph": readonly JsonLdNode[];
};

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

/** A reference to another node in the same graph. */
const nodeRef = (siteUrl: string, fragment: string) => ({ "@id": `${siteUrl}/#${fragment}` });

function websiteNode(input: LandingJsonLdInput): JsonLdNode {
  return {
    "@type": "WebSite",
    ...nodeRef(input.siteUrl, "website"),
    url: input.siteUrl,
    name: input.name,
    inLanguage: input.language,
    publisher: nodeRef(input.siteUrl, "organization"),
  };
}

function organizationNode(input: LandingJsonLdInput): JsonLdNode {
  return {
    "@type": "Organization",
    ...nodeRef(input.siteUrl, "organization"),
    name: input.name,
    url: input.siteUrl,
    logo: input.logoUrl,
  };
}

/** The product itself. Free, browser-based; deliberately no ratings or reviews (we have none to cite). */
function applicationNode(input: LandingJsonLdInput): JsonLdNode {
  return {
    "@type": "WebApplication",
    ...nodeRef(input.siteUrl, "app"),
    name: input.name,
    url: input.siteUrl,
    description: input.description,
    image: input.imageUrl,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any",
    inLanguage: input.language,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    featureList: [...input.features],
    publisher: nodeRef(input.siteUrl, "organization"),
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
    ...nodeRef(siteUrl, "faq"),
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
    "@graph": [
      websiteNode(input),
      organizationNode(input),
      applicationNode(input),
      faqPageNode(input.siteUrl, input.faq),
    ],
  };
}

/** `JSON.stringify`, typed honestly: it returns undefined for undefined, functions and symbols. */
const stringify = (value: unknown): string | undefined => JSON.stringify(value);

/**
 * JSON for an inline `<script type="application/ld+json">`. Every `<` is escaped as `\u003c`, so no
 * string inside the data can close the script element or open an HTML comment.
 * @param data any JSON-serialisable value
 */
export function serializeJsonLd(data: unknown): string {
  return (stringify(data) ?? "null").replace(/</g, "\\u003c");
}
