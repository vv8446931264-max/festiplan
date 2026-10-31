const IP_LIKE = /^[0-9a-fA-F:.]{2,45}$/;
const IPV4_TAIL = /(?:^|:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;
const IPV6_GROUPS = 8;
const MAX_OCTET = 255;
/** Cloud Run's front end appends exactly one `X-Forwarded-For` entry. */
const DEFAULT_TRUSTED_HOPS = 1;
const MAX_TRUSTED_HOPS = 5;

/** How many trusted proxies append to `X-Forwarded-For` (Cloud Run's front end = 1). */
export function trustedHops(env: Record<string, string | undefined> = process.env): number {
  const hops = Number(env.TRUSTED_PROXY_HOPS ?? DEFAULT_TRUSTED_HOPS);
  const valid = Number.isInteger(hops) && hops >= 1 && hops <= MAX_TRUSTED_HOPS;
  return valid ? hops : DEFAULT_TRUSTED_HOPS;
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
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidate = entries[Math.max(0, entries.length - hops)];
  return candidate && IP_LIKE.test(candidate) ? candidate : "local";
}

/** Rewrites a dotted IPv4 tail ("::ffff:1.2.3.4") as two hextets; null when an octet is out of range. */
function v4TailToHextets(ip: string): string | null {
  const match = IPV4_TAIL.exec(ip);
  if (!match) return ip;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((octet) => octet > MAX_OCTET)) return null;
  const prefix = ip.slice(0, match.index + (match[0].startsWith(":") ? 1 : 0));
  return `${prefix}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
}

/** Splits one side of a `::` into its hextet strings ("" → none). */
const hextetsOf = (side: string | undefined): string[] => (side ? side.split(":") : []);

/**
 * Expands an IPv6 address (with `::` and an optional dotted IPv4 tail) to its eight
 * 16-bit groups, or null when it is not a valid IPv6 address.
 */
export function expandIpv6(ip: string): number[] | null {
  const text = v4TailToHextets(ip.toLowerCase());
  if (text === null) return null;
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = hextetsOf(halves[0]);
  const tail = hextetsOf(halves[1]);
  const missing = IPV6_GROUPS - head.length - tail.length;
  const compressed = halves.length === 2;
  if (compressed ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  return groups.every((group) => HEXTET.test(group))
    ? groups.map((group) => parseInt(group, 16))
    : null;
}

/** `::ffff:a.b.c.d` (IPv4-mapped IPv6) as plain dotted IPv4; null for any other address. */
function mappedIpv4(groups: number[]): string | null {
  const isMapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (!isMapped) return null;
  const [high, low] = [groups[6], groups[7]];
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
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
  const network = groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":");
  return mappedIpv4(groups) ?? `${network}::/64`;
}

/** The per-client rate-limit key for a request: `rateLimitSubject(clientIp(req))`. */
export function clientKey(req: Request, hops = trustedHops()): string {
  return rateLimitSubject(clientIp(req, hops));
}
