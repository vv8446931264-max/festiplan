import { CONTINGENCY_PERCENT, LANG_LABELS } from "@/lib/contracts/constants";

/**
 * Search-facing copy for the landing page. Lengths are held to search-snippet limits
 * (title 50–60, description 140–160 characters) by tests/seo/metadata.test.ts.
 */
export const SEO_COPY = {
  title: "AI Wedding, Birthday & Event Planner for India · FestiPlan",
  description:
    "Free AI planner for weddings, birthday parties and community events in India: three ideas, a budget split to the last rupee, a dated timeline and real vendors.",
  /** Open Graph locale (underscore form) and BCP 47 tag for structured data. */
  locale: "en_IN",
  language: "en-IN",
  ogImageAlt: "FestiPlan: made for moments, built for budgets.",
} as const;

/**
 * Whole rupees in Indian digit grouping, e.g. `₹12,00,000`.
 * @param amount an integer amount in rupees
 */
export function rupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

/** English names of the plan languages, from the labels the form shows ("हिन्दी (Hindi)" → "Hindi"). */
export const PLAN_LANGUAGES: readonly string[] = Object.values(LANG_LABELS).map(
  (label) => /\(([^)]+)\)$/.exec(label)?.[1] ?? label,
);

/** What the product does, for `featureList` in JSON-LD. Each line maps to shipped code (docs/SPEC.md §2). */
export const FEATURES: readonly string[] = [
  "Three AI-drafted celebration concepts",
  `Budget split to the rupee with ${CONTINGENCY_PERCENT}% contingency`,
  "Live budget sliders and actual-spend tracking",
  "Timeline counted back from the event date, with calendar export",
  "Vendor checklist and real vendors from Google Maps",
  `Plans in ${PLAN_LANGUAGES.length} languages`,
  "Share link and private edit link, no account",
];
