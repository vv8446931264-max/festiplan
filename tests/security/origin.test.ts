// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/security/origin";
import { clientIp, trustedHops } from "@/lib/security/ip";

const req = (headers: Record<string, string>, method = "POST", url = "http://localhost:3000/api/plan") =>
  new Request(url, { method, headers });

describe("isSameOrigin", () => {
  it("accepts an Origin matching Host or X-Forwarded-Host", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://festiplan.app", host: "festiplan-abc.a.run.app", "x-forwarded-host": "festiplan.app" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "http://LOCALHOST:3000" }))).toBe(true);
  });

  it("rejects foreign, null and malformed origins", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "not a url" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "ftp://localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "http://localhost:3001", host: "localhost:3000" }))).toBe(false);
  });

  it("without Origin, requires Sec-Fetch-Site: same-origin for writes", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({}))).toBe(false);
    expect(isSameOrigin(req({}, "PATCH"))).toBe(false);
  });

  it("lets safe methods through", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example" }, "GET"))).toBe(true);
    expect(isSameOrigin(req({}, "HEAD"))).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the hop appended by the trusted proxy, ignoring spoofed entries", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.1" }), 2)).toBe("203.0.113.7");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7" }), 3)).toBe("203.0.113.7");
  });

  it("reads TRUSTED_PROXY_HOPS, defaulting to 1 for invalid values", () => {
    expect(trustedHops({})).toBe(1);
    expect(trustedHops({ TRUSTED_PROXY_HOPS: "2" })).toBe(2);
    expect(trustedHops({ TRUSTED_PROXY_HOPS: "0" })).toBe(1);
    expect(trustedHops({ TRUSTED_PROXY_HOPS: "x" })).toBe(1);
  });

  it("falls back to local for missing or junk values", () => {
    expect(clientIp(req({}))).toBe("local");
    expect(clientIp(req({ "x-forwarded-for": "<script>" }))).toBe("local");
  });
});
