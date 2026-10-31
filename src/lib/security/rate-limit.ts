type Bucket = { count: number; resetAt: number };

/** Outcome of a rate-limit check. `retryAfterSec` is 0 when allowed. */
export type RateLimitResult = { ok: boolean; retryAfterSec: number };

const buckets = new Map<string, Bucket>();
const PRUNE_EVERY_MS = 60_000;
const MAX_BUCKETS = 50_000;
const MS_PER_SECOND = 1000;
let lastPrune = 0;

/** Drops expired windows once a minute, and the oldest live ones under a flood of keys. */
function prune(now: number): void {
  if (now - lastPrune < PRUNE_EVERY_MS && buckets.size < MAX_BUCKETS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  // Still too many live buckets (a flood of distinct keys): drop the oldest.
  for (const key of buckets.keys()) {
    if (buckets.size < MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

/** Whole seconds until `resetAt`, never less than one. */
const secondsUntil = (resetAt: number, now: number): number =>
  Math.max(1, Math.ceil((resetAt - now) / MS_PER_SECOND));

/**
 * Fixed-window, in-process rate limiter: at most `limit` hits per `key` per `windowMs`.
 * Cloud Run instances each keep their own window, which is fine for abuse damping.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return limit >= 1
      ? { ok: true, retryAfterSec: 0 }
      : { ok: false, retryAfterSec: Math.ceil(windowMs / MS_PER_SECOND) };
  }
  if (bucket.count >= limit) return { ok: false, retryAfterSec: secondsUntil(bucket.resetAt, now) };
  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Multiplier for every per-route limit, from `RATE_LIMIT_SCALE` (a positive integer;
 * default and anything invalid → 1). End-to-end tests raise it because many plans
 * are created from one IP in parallel.
 */
export function rateLimitScale(env: Record<string, string | undefined> = process.env): number {
  const raw = env.RATE_LIMIT_SCALE?.trim() ?? "";
  if (!/^\d+$/.test(raw)) return 1;
  const scale = Number(raw);
  return Number.isSafeInteger(scale) && scale >= 1 ? scale : 1;
}

/** A route's base limit multiplied by `rateLimitScale()`. */
export function scaledLimit(
  base: number,
  env: Record<string, string | undefined> = process.env,
): number {
  return base * rateLimitScale(env);
}

/** Clears every window (tests). */
export function resetRateLimits(): void {
  buckets.clear();
  lastPrune = 0;
}

/** Number of tracked keys (tests). */
export function rateLimitSize(): number {
  return buckets.size;
}
