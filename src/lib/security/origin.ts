const firstValue = (header: string | null): string | null => {
  const v = header?.split(",")[0]?.trim().toLowerCase();
  return v ? v : null;
};

function requestHosts(req: Request): string[] {
  const hosts = [
    firstValue(req.headers.get("x-forwarded-host")),
    firstValue(req.headers.get("host")),
  ];
  try {
    hosts.push(new URL(req.url).host.toLowerCase());
  } catch {
    // A relative or malformed URL simply contributes no host.
  }
  return hosts.filter((h): h is string => h !== null);
}

/**
 * Cross-site request forgery guard for state-changing requests (POST/PATCH).
 * The `Origin` header must name this host (Host or X-Forwarded-Host). Without an Origin,
 * only `Sec-Fetch-Site: same-origin` is accepted — strict by design, so plain cross-site
 * form posts and header-less clients are refused. GET/HEAD/OPTIONS always pass.
 */
export function isSameOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const origin = req.headers.get("origin");
  if (origin === null) return req.headers.get("sec-fetch-site") === "same-origin";
  if (origin === "null") return false;
  let originHost: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    originHost = url.host.toLowerCase();
  } catch {
    return false;
  }
  return requestHosts(req).includes(originHost);
}
