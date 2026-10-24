import { NextResponse } from "next/server";
import type { NextRequest, ProxyConfig } from "next/server";
import { contentSecurityPolicy, newNonce } from "@/lib/security/csp";

/**
 * Runs before every page render: mints a per-request nonce and sets a strict CSP on the
 * request (Next.js reads the nonce from it and stamps its own scripts) and on the response.
 * Pages render per request (`connection()` in the root layout), so every HTML response
 * carries a fresh nonce.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config: ProxyConfig = {
  matcher: [
    // Every page — not API routes, static chunks, image optimisation, icons or prefetches.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
