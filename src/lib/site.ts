/** Public origin used for metadata, sitemap and share links rendered on the server. */
export const SITE_URL =
  process.env.SITE_URL ?? "https://festiplan-580541627338.us-central1.run.app";

/** Short product strings reused across pages. */
export const BRAND = {
  name: "FestiPlan",
  tagline: "Made for moments. Built for budgets.",
  category: "AI Celebration & Event Planner",
} as const;
