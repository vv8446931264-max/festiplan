const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

/** How many trusted proxies append to `X-Forwarded-For` (Cloud Run's front end = 1). */
export function trustedHops(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
}

/**
 * The client IP used as a rate-limit key. Proxies append to `X-Forwarded-For`, so
 * anything to the left of the hops our own infrastructure added is client-supplied
 * and spoofable; we read the entry `TRUSTED_PROXY_HOPS` from the right instead.
 * Falls back to "local" (dev, tests) when the header is missing or malformed.
 */
export function clientIp(req: Request, hops = trustedHops()): string {
  const entries = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidate = entries[Math.max(0, entries.length - hops)];
  return candidate && IP_RE.test(candidate) ? candidate : "local";
}
