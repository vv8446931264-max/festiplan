// @vitest-environment node
import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../next.config";

const headersFor = async (url: string) =>
  (await unstable_getResponseFromNextConfig({ url: `https://festiplan.example${url}`, nextConfig })).headers;

describe("next.config.ts hardening headers", () => {
  it("sends the browser hardening headers on every path", async () => {
    for (const path of ["/", "/plan/abcdef123456", "/api/health"]) {
      const h = await headersFor(path);
      expect(h.get("x-content-type-options")).toBe("nosniff");
      expect(h.get("x-frame-options")).toBe("DENY");
      expect(h.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
      expect(h.get("cross-origin-opener-policy")).toBe("same-origin");
      expect(h.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(h.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    }
  });

  it("leaves page CSP to the proxy and locks API responses down completely", async () => {
    expect((await headersFor("/")).get("content-security-policy")).toBeNull();
    expect((await headersFor("/api/plan")).get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("marks shared plans noindex", async () => {
    expect((await headersFor("/plan/abcdef123456")).get("x-robots-tag")).toBe("noindex, nofollow");
    expect((await headersFor("/")).get("x-robots-tag")).toBeNull();
  });
});
