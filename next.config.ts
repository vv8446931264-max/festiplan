import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Server SDKs with native/optional deps stay as runtime requires instead of being bundled.
  serverExternalPackages: ["@google-cloud/firestore", "@google/genai"],

  headers: async () => [
    // Pages get a per-request nonce CSP from src/proxy.ts. API responses are data, never
    // documents: they may load nothing and may not be framed.
    {
      source: "/api/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
      ],
    },
    // Shared plans are private links: never index them, never cache them publicly.
    { source: "/plan/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "0" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
