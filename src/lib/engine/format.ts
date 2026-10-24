/** Display formatting for rupees, dates and percentages (en-IN). Pure; no clock access. */
import { EVENT_TYPE_LABELS } from "@/lib/contracts/constants";
import type { PlanInput } from "@/lib/contracts";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const DATE_PARTS = { timeZone: "UTC", day: "numeric", month: "short" } as const;
const LONG_DATE = new Intl.DateTimeFormat("en-IN", { ...DATE_PARTS, year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("en-IN", DATE_PARTS);

const CRORE = 10_000_000;
const LAKH = 100_000;
const THOUSAND = 1_000;
const UNITS: readonly (readonly [number, string])[] = [
  [CRORE, "Cr"],
  [LAKH, "L"],
  [THOUSAND, "K"],
];

/**
 * Formats whole rupees with Indian digit grouping, e.g. 1200000 → "₹12,00,000".
 * Fractions are rounded; negatives keep the sign in front of the symbol.
 * @param n Amount in rupees.
 */
export function formatINR(n: number): string {
  return INR.format(Math.round(n) + 0);
}

const trimmed = (value: number): string => value.toFixed(1).replace(/\.0$/, "");

/**
 * Compact rupee label: "₹1.2Cr", "₹12L", "₹2.5L", "₹40K"; below 1,000 falls back to `formatINR`.
 * @param n Amount in rupees.
 */
export function formatINRCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const index = UNITS.findIndex(([size]) => abs >= size);
  if (index === -1) return formatINR(n);
  const [size, suffix] = UNITS[index];
  const bigger = UNITS[index - 1];
  // Rounding can carry into the next unit: ₹99,99,999 is "₹1Cr", not "₹100L".
  if (bigger && Number((abs / size).toFixed(1)) * size >= bigger[0]) {
    return `${sign}₹${trimmed(abs / bigger[0])}${bigger[1]}`;
  }
  return `${sign}₹${trimmed(abs / size)}${suffix}`;
}

/**
 * Display title for a plan: the user's own name for it, else "Wedding in Jaipur".
 * @param input The plan's brief.
 */
export function planTitle(input: Pick<PlanInput, "title" | "eventType" | "city">): string {
  return input.title?.trim() || `${EVENT_TYPE_LABELS[input.eventType]} in ${input.city}`;
}

const withFormatter = (fmt: Intl.DateTimeFormat, iso: string): string => {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) ? iso : fmt.format(new Date(ms));
};

/**
 * Formats an ISO date as "14 Feb 2027" (en-IN, UTC). An unparsable input is returned unchanged.
 * @param iso ISO date `YYYY-MM-DD`.
 */
export function formatDate(iso: string): string {
  return withFormatter(LONG_DATE, iso);
}

/**
 * Formats an ISO date without the year, e.g. "14 Feb". An unparsable input is returned unchanged.
 * @param iso ISO date `YYYY-MM-DD`.
 */
export function formatDateShort(iso: string): string {
  return withFormatter(SHORT_DATE, iso);
}

/**
 * Formats a percentage with at most one decimal: 12.5 → "12.5%", 12 → "12%".
 * @param n Percentage value (not a fraction).
 */
export function formatPercent(n: number): string {
  return `${Number(n.toFixed(1))}%`;
}

/**
 * Google Maps search link for a free-text query.
 * @param query Text to search for; it is URI-encoded.
 */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
