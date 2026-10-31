/** A fresh, unguessable CSP nonce: 128 random bits, base64. Minted once per request. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The Content-Security-Policy for one HTML response. Scripts run only when they carry
 * this request's nonce; `'strict-dynamic'` extends that trust to the chunks those
 * scripts load (lazy WebGL scenes), so there is no `'unsafe-inline'` for scripts.
 * Development adds `'unsafe-eval'` (React's dev tooling); production adds
 * `upgrade-insecure-requests`.
 * @param nonce the value from `newNonce()` for this request
 * @param mode `NODE_ENV` (inlined at build time by Next.js)
 */
export function contentSecurityPolicy(
  nonce: string,
  mode: string | undefined = process.env.NODE_ENV,
): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${mode === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (mode === "production") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
