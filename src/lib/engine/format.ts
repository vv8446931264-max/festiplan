/** Display formatting for rupees, dates and percentages (en-IN). Pure; no clock access. */

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
  if (abs >= CRORE) return `${sign}₹${trimmed(abs / CRORE)}Cr`;
  if (abs >= LAKH) return `${sign}₹${trimmed(abs / LAKH)}L`;
  if (abs >= THOUSAND) return `${sign}₹${trimmed(abs / THOUSAND)}K`;
  return formatINR(n);
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
