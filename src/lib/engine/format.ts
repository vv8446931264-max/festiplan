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
/** Compact units, largest first: [size in rupees, suffix]. */
const UNITS: readonly (readonly [number, string])[] = [
  [CRORE, "Cr"],
  [LAKH, "L"],
  [THOUSAND, "K"],
];

/**
 * Formats whole rupees with Indian digit grouping, e.g. 1200000 → "₹12,00,000".
 * Fractions are rounded; negatives keep the sign in front of the symbol.
 * @param amountINR Amount in rupees.
 */
export function formatINR(amountINR: number): string {
  // `+ 0` turns -0 (from rounding a tiny negative) into 0, so it never prints as "-₹0".
  return INR.format(Math.round(amountINR) + 0);
}

/** One decimal place without a trailing ".0": 12.0 → "12", 2.5 → "2.5". */
const oneDecimal = (value: number): string => value.toFixed(1).replace(/\.0$/, "");

/**
 * Compact rupee label: "₹1.2Cr", "₹12L", "₹2.5L", "₹40K"; below 1,000 falls back to `formatINR`.
 * @param amountINR Amount in rupees.
 */
export function formatINRCompact(amountINR: number): string {
  const magnitude = Math.abs(amountINR);
  const sign = amountINR < 0 ? "-" : "";
  const index = UNITS.findIndex(([size]) => magnitude >= size);
  if (index === -1) return formatINR(amountINR);
  const [size, suffix] = UNITS[index];
  const larger = index > 0 ? UNITS[index - 1] : undefined;
  // Rounding can carry into the next unit: ₹99,99,999 is "₹1Cr", not "₹100L".
  if (larger && Number((magnitude / size).toFixed(1)) * size >= larger[0]) {
    return `${sign}₹${oneDecimal(magnitude / larger[0])}${larger[1]}`;
  }
  return `${sign}₹${oneDecimal(magnitude / size)}${suffix}`;
}

/**
 * Display title for a plan: the user's own name for it, else "Wedding in Jaipur".
 * @param input The plan's brief.
 */
export function planTitle(input: Pick<PlanInput, "title" | "eventType" | "city">): string {
  const ownTitle = input.title?.trim() ?? "";
  return ownTitle.length > 0 ? ownTitle : `${EVENT_TYPE_LABELS[input.eventType]} in ${input.city}`;
}

/** Formats an ISO date with `formatter`; an unparsable input is returned unchanged. */
function formatIsoDate(formatter: Intl.DateTimeFormat, iso: string): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) ? iso : formatter.format(new Date(ms));
}

/**
 * Formats an ISO date as "14 Feb 2027" (en-IN, UTC). An unparsable input is returned unchanged.
 * @param iso ISO date `YYYY-MM-DD`.
 */
export function formatDate(iso: string): string {
  return formatIsoDate(LONG_DATE, iso);
}

/**
 * Formats an ISO date without the year, e.g. "14 Feb". An unparsable input is returned unchanged.
 * @param iso ISO date `YYYY-MM-DD`.
 */
export function formatDateShort(iso: string): string {
  return formatIsoDate(SHORT_DATE, iso);
}

/**
 * Formats a percentage with at most one decimal: 12.5 → "12.5%", 12 → "12%".
 * @param percent Percentage value (not a fraction).
 */
export function formatPercent(percent: number): string {
  return `${Number(percent.toFixed(1))}%`;
}

/**
 * Google Maps search link for a free-text query.
 * @param query Text to search for; it is URI-encoded.
 */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
