const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;
const IPV4_TAIL_RE = /(?:^|:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEXTET_RE = /^[0-9a-f]{1,4}$/;

/** How many trusted proxies append to `X-Forwarded-For` (Cloud Run's front end = 1). */
export function trustedHops(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
}

/**
 * The client IP. Proxies append to `X-Forwarded-For`, so anything to the left of the
 * hops our own infrastructure added is client-supplied and spoofable; we read the entry
 * `TRUSTED_PROXY_HOPS` from the right instead.
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

/** Rewrites a dotted IPv4 tail ("::ffff:1.2.3.4") as two hextets; null when an octet is out of range. */
function v4TailToHextets(ip: string): string | null {
  const m = IPV4_TAIL_RE.exec(ip);
  if (!m) return ip;
  const o = m.slice(1).map(Number);
  if (o.some((octet) => octet > 255)) return null;
  const prefix = ip.slice(0, m.index + (m[0].startsWith(":") ? 1 : 0));
  return `${prefix}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
}

/**
 * Expands an IPv6 address (with `::` and an optional dotted IPv4 tail) to its eight
 * 16-bit groups, or null when it is not a valid IPv6 address.
 */
export function expandIpv6(ip: string): number[] | null {
  const text = v4TailToHextets(ip.toLowerCase());
  if (text === null) return null;
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parts = (s: string | undefined) => (s ? s.split(":") : []);
  const head = parts(halves[0]);
  const tail = parts(halves[1]);
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  return groups.every((g) => HEXTET_RE.test(g)) ? groups.map((g) => parseInt(g, 16)) : null;
}

/**
 * The rate-limit subject for an IP. IPv4 is used as is. IPv6 is keyed on its /64 network
 * (an ISP hands one subscriber a whole /64, so per-address keys would be trivially evaded);
 * IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is keyed as the plain IPv4 address.
 */
export function rateLimitSubject(ip: string): string {
  if (!ip.includes(":")) return ip;
  const groups = expandIpv6(ip);
  if (!groups) return ip.toLowerCase();
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    const [hi, lo] = [groups[6], groups[7]];
    return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":")}::/64`;
}

/** The per-client rate-limit key for a request: `rateLimitSubject(clientIp(req))`. */
export function clientKey(req: Request, hops = trustedHops()): string {
  return rateLimitSubject(clientIp(req, hops));
}
