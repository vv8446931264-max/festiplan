/** ISO `YYYY-MM-DD` date arithmetic. UTC only, no clock access, no locale. */

const DAY_MS = 86_400_000;

const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/**
 * Adds `n` whole days (negative to subtract) to an ISO date.
 * @param iso ISO date, e.g. "2027-02-14".
 * @param n Number of days to add.
 * @returns The resulting ISO date.
 */
export function addDays(iso: string, n: number): string {
  return new Date(toMs(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Whole days from `from` to `to` (`to − from`); negative when `to` is earlier.
 * @param from ISO start date.
 * @param to ISO end date.
 */
export function diffDays(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/**
 * The later of two ISO dates.
 * @param a ISO date.
 * @param b ISO date.
 */
export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * The earlier of two ISO dates.
 * @param a ISO date.
 * @param b ISO date.
 */
export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}
