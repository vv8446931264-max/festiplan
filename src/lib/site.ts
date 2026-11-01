/**
 * Public origin used for metadata, sitemap, structured data and share links rendered on the
 * server. No trailing slash, so `${SITE_URL}/path` never doubles it.
 */
export const SITE_URL = (
  process.env.SITE_URL ?? "https://festiplan-580541627338.us-central1.run.app"
).replace(/\/+$/, "");

/**
 * Absolute URL on the public origin. The root is the bare origin, exactly as Next.js renders
 * a canonical of `/`, so the sitemap, canonical link and JSON-LD all name the same URL.
 * @param path a root-relative path such as `/` or `/opengraph-image`
 */
export function absoluteUrl(path = "/"): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Short product strings reused across pages, social cards and structured data. */
export const BRAND = {
  name: "FestiPlan",
  tagline: "Made for moments. Built for budgets.",
  category: "AI Celebration & Event Planner",
  subtitle: "AI planner for weddings, birthdays & community events",
} as const;

/** Generated image routes: `src/app/{opengraph-image,icon,apple-icon}.tsx`. */
export const IMAGE_ROUTES = {
  og: "/opengraph-image",
  icon192: "/icon/192",
  icon512: "/icon/512",
  apple: "/apple-icon",
} as const;

/** Brand colours for places CSS cannot reach (image routes, manifest); see `brand-colors.ts`. */
export { BRAND_COLORS } from "@/lib/brand-colors";
