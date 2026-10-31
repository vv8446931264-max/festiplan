// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clientKey, expandIpv6, rateLimitSubject } from "@/lib/security/ip";

const req = (xff: string) =>
  new Request("http://localhost:3000/api/plan", { headers: { "x-forwarded-for": xff } });

describe("expandIpv6", () => {
  it("expands :: in every position", () => {
    expect(expandIpv6("2001:db8::1")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(expandIpv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIpv6("fe80::")).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 0]);
    expect(expandIpv6("::")).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(expandIpv6("2001:DB8:0:0:8:800:200C:417A")).toEqual([
      0x2001, 0xdb8, 0, 0, 8, 0x800, 0x200c, 0x417a,
    ]);
    expect(expandIpv6("1:2:3:4:5:6:7::")).toEqual([1, 2, 3, 4, 5, 6, 7, 0]);
  });

  it("reads a dotted IPv4 tail as the last two groups", () => {
    expect(expandIpv6("::ffff:192.0.2.128")).toEqual([0, 0, 0, 0, 0, 0xffff, 0xc000, 0x0280]);
    expect(expandIpv6("64:ff9b::198.51.100.7")).toEqual([0x64, 0xff9b, 0, 0, 0, 0, 0xc633, 0x6407]);
  });

  it("rejects malformed addresses", () => {
    for (const bad of [
      "1::2::3",
      "1:2:3:4:5:6:7:8:9",
      "1:2:3",
      ":1:2:3:4:5:6:7",
      "12345::1",
      "::ffff:300.1.1.1",
      "1:2:3:4:5:6:7:8::",
      "1.2.3.4",
      "g::1",
    ]) {
      expect(expandIpv6(bad)).toBeNull();
    }
  });
});

describe("rateLimitSubject", () => {
  it("keeps IPv4 addresses unchanged", () => {
    expect(rateLimitSubject("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitSubject("local")).toBe("local");
  });

  it("keys IPv6 on its /64 network", () => {
    expect(rateLimitSubject("2001:db8:aaaa:bbbb:1:2:3:4")).toBe("2001:db8:aaaa:bbbb::/64");
    expect(rateLimitSubject("2001:db8:aaaa:bbbb::ffff")).toBe("2001:db8:aaaa:bbbb::/64");
    expect(rateLimitSubject("2001:0DB8:0000:0001::1")).toBe("2001:db8:0:1::/64");
    expect(rateLimitSubject("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitSubject("2001:db8:0:2::1")).not.toBe(rateLimitSubject("2001:db8:0:1::1"));
  });

  it("keys IPv4-mapped IPv6 as the plain IPv4 address", () => {
    expect(rateLimitSubject("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitSubject("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("falls back to the lower-cased text for an unparseable IPv6-looking value", () => {
    expect(rateLimitSubject("1::2::3:A")).toBe("1::2::3:a");
  });
});

describe("clientKey", () => {
  it("gives every address in one /64 the same key, and IPv4 its own", () => {
    expect(clientKey(req("6.6.6.6, 2001:db8:1:2:aaaa::1"))).toBe(
      clientKey(req("2001:db8:1:2:ffff:ffff:ffff:ffff")),
    );
    expect(clientKey(req("2001:db8:1:2::1"))).toBe("2001:db8:1:2::/64");
    expect(clientKey(req("198.51.100.4"))).toBe("198.51.100.4");
    expect(clientKey(req("10.0.0.1, 198.51.100.4, 10.0.0.2"), 2)).toBe("198.51.100.4");
  });
});
