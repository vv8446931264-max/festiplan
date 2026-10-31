import type { NextConfig } from "next";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** API responses are data, never documents: they may load nothing and may not be framed. */
const API_HEADERS: HeaderRule = {
  source: "/api/:path*",
  headers: [
    { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
  ],
};

/** Shared plans are private links: keep them out of search engines. */
const PLAN_HEADERS: HeaderRule = {
  source: "/plan/:path*",
  headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
};

/** Browser hardening for every response. Pages get their nonce CSP from src/proxy.ts. */
const HARDENING_HEADERS: HeaderRule = {
  source: "/:path*",
  headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-XSS-Protection", value: "0" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
  ],
};

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Server SDKs with native/optional deps stay as runtime requires instead of being bundled.
  serverExternalPackages: ["@google-cloud/firestore", "@google/genai"],
  headers: () => Promise.resolve([API_HEADERS, PLAN_HEADERS, HARDENING_HEADERS]),
};

export default nextConfig;
