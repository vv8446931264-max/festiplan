/** India Standard Time is UTC+05:30 all year round (no daylight saving). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Today's calendar date in Asia/Kolkata as an ISO `YYYY-MM-DD` string.
 * The engine is pure and takes `today` as an argument; routes call this once per request.
 */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** An RFC 5545 `DTSTAMP` value in UTC, e.g. `20261024T113400Z`. */
export function dtstamp(now: Date = new Date()): string {
  return now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}
