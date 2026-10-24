import type { Metadata } from "next";
import { BRAND, IMAGE_ROUTES, SITE_URL, absoluteUrl } from "@/lib/site";
import { FEATURES, SEO_COPY } from "./copy";
import { FAQ } from "./faq";
import { buildLandingJsonLd, type JsonLdGraph } from "./json-ld";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** Open Graph fields every page shares. Images come from `src/app/opengraph-image.tsx`. */
function openGraph(url?: string): OpenGraph {
  return {
    type: "website",
    siteName: BRAND.name,
    locale: SEO_COPY.locale,
    title: SEO_COPY.title,
    description: SEO_COPY.description,
    ...(url ? { url } : {}),
  };
}

/**
 * Site-wide defaults for the root layout. Deliberately no canonical URL or `og:url`: those
 * would be inherited by private `/plan/[id]` pages and point them at the landing page.
 */
export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SEO_COPY.title, template: `%s · ${BRAND.name}` },
    description: SEO_COPY.description,
    applicationName: BRAND.name,
    openGraph: openGraph(),
    twitter: { card: "summary_large_image", title: SEO_COPY.title, description: SEO_COPY.description },
  };
}

/**
 * Landing page (`/`): canonical URL, `og:url` and permission for large image previews.
 * Metadata merges shallowly, so the page restates the whole Open Graph object.
 */
export function homeMetadata(): Metadata {
  return {
    alternates: { canonical: "/" },
    openGraph: openGraph("/"),
    robots: { "max-image-preview": "large" },
  };
}

/** The landing page's JSON-LD graph, assembled from the same copy and FAQ the page renders. */
export function landingJsonLd(): JsonLdGraph {
  return buildLandingJsonLd({
    siteUrl: absoluteUrl("/"),
    name: BRAND.name,
    description: SEO_COPY.description,
    language: SEO_COPY.language,
    imageUrl: absoluteUrl(IMAGE_ROUTES.og),
    logoUrl: absoluteUrl(IMAGE_ROUTES.icon512),
    features: FEATURES,
    faq: FAQ,
  });
}
