const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * The client IP used as a rate-limit key: the first hop of `X-Forwarded-For` (set by
 * Cloud Run's front end), else "local" (dev, tests). Values that do not look like an
 * IP address are ignored.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && IP_RE.test(forwarded) ? forwarded : "local";
}
