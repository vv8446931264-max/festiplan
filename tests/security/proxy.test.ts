// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";
import { contentSecurityPolicy, newNonce } from "@/lib/security/csp";

afterEach(() => vi.unstubAllEnvs());

/** Parses a CSP header into `{ directive: [sources] }`. */
function directives(header: string | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of (header ?? "").split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
}

const run = (path = "/") => proxy(new NextRequest(`http://localhost:3000${path}`));

describe("proxy (nonce CSP)", () => {
  it("sets strict script-src and style-src with this request's nonce and no 'unsafe-inline'", () => {
    const res = run();
    const header = res.headers.get("content-security-policy");
    const csp = directives(header);
    const nonce = res.headers.get("x-middleware-request-x-nonce") ?? "";
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(csp["script-src"]).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]);
    expect(csp["style-src"]).toEqual(["'self'", `'nonce-${nonce}'`]);
    expect(header).not.toContain("'unsafe-inline'");
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
    expect(csp["font-src"]).toEqual(["'self'"]);
  });

  it("hands the same policy and nonce to the renderer as request headers", () => {
    const res = run("/plan/abcdef123456");
    expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(
      res.headers.get("content-security-policy"),
    );
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-nonce");
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("mints a fresh nonce for every request", () => {
    const nonces = new Set(
      Array.from({ length: 50 }, () => run().headers.get("x-middleware-request-x-nonce")),
    );
    expect(nonces.size).toBe(50);
    expect(newNonce()).not.toBe(newNonce());
  });

  it("allows eval only in development and upgrades insecure requests only in production", () => {
    const dev = directives(contentSecurityPolicy("n", "development"));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["upgrade-insecure-requests"]).toBeUndefined();
    const prod = directives(contentSecurityPolicy("n", "production"));
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["upgrade-insecure-requests"]).toEqual([]);
    expect(
      directives(contentSecurityPolicy("n", "test"))["upgrade-insecure-requests"],
    ).toBeUndefined();
  });

  it("needs the nonce for styles in production, where 'unsafe-inline' appears nowhere", () => {
    const prod = contentSecurityPolicy("n", "production");
    expect(directives(prod)["style-src"]).toEqual(["'self'", "'nonce-n'"]);
    expect(prod).not.toContain("'unsafe-inline'");
    // The nonce unlocks exactly the scripts and the styles that carry it.
    expect(prod.match(/'nonce-n'/g)).toHaveLength(2);
  });

  it("allows inline styles only in development, and then lists no style nonce", () => {
    const dev = contentSecurityPolicy("n", "development");
    // A nonce beside 'unsafe-inline' would make browsers ignore 'unsafe-inline'.
    expect(directives(dev)["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(dev.match(/'unsafe-inline'/g)).toHaveLength(1);
    expect(directives(dev)["script-src"]).toContain("'nonce-n'");
    expect(directives(dev)["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("runs on pages but skips API routes, static assets, icons and prefetches", () => {
    const matches = (url: string, headers: Record<string, string> = {}) =>
      unstable_doesMiddlewareMatch({ config, url, headers });
    expect(matches("/")).toBe(true);
    expect(matches("/plan/abcdef123456")).toBe(true);
    expect(matches("/api/plan")).toBe(false);
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/image?url=x")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/icon.svg")).toBe(false);
    expect(matches("/", { "next-router-prefetch": "1" })).toBe(false);
    expect(matches("/", { purpose: "prefetch" })).toBe(false);
  });
});
