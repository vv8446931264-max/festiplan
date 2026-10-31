const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The first comma-separated value of a header, trimmed and lower-cased; null when blank. */
function firstHeaderValue(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  return value === "" ? null : value;
}

/** Every host this request may legitimately be addressed as: forwarded host, Host, URL host. */
function requestHosts(req: Request): string[] {
  const hosts = [
    firstHeaderValue(req.headers.get("x-forwarded-host")),
    firstHeaderValue(req.headers.get("host")),
  ];
  try {
    hosts.push(new URL(req.url).host.toLowerCase());
  } catch {
    // A relative or malformed URL simply contributes no host.
  }
  return hosts.filter((host): host is string => host !== null);
}

/** The lower-cased host of an http(s) Origin header value; null for anything else. */
function originHost(origin: string): string | null {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.host.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Cross-site request forgery guard for state-changing requests (POST/PATCH).
 * The `Origin` header must name this host (Host or X-Forwarded-Host). Without an Origin,
 * only `Sec-Fetch-Site: same-origin` is accepted — strict by design, so plain cross-site
 * form posts and header-less clients are refused. GET/HEAD/OPTIONS always pass.
 */
export function isSameOrigin(req: Request): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
  const origin = req.headers.get("origin");
  if (origin === null) return req.headers.get("sec-fetch-site") === "same-origin";
  const host = origin === "null" ? null : originHost(origin);
  return host !== null && requestHosts(req).includes(host);
}
