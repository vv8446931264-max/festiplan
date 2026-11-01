/** 128 random bits: unguessable, and the length the CSP spec recommends as a minimum. */
const NONCE_BYTES = 16;

/** A fresh, unguessable CSP nonce: 128 random bits, base64. Minted once per request. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The Content-Security-Policy for one HTML response. Scripts run only when they carry
 * this request's nonce; `'strict-dynamic'` extends that trust to the chunks those
 * scripts load (lazy WebGL scenes), so there is no `'unsafe-inline'` for scripts.
 * Styles need the nonce too: pages ship no `style` attributes, Next.js stamps the nonce
 * on its own inline styles, and runtime changes go through the CSSOM, which CSP allows.
 * Development swaps the style nonce for `'unsafe-inline'` (dev tooling injects styles
 * without one; a nonce in the list would switch `'unsafe-inline'` off) and adds
 * `'unsafe-eval'` (React's dev tooling); production adds `upgrade-insecure-requests`.
 * @param nonce the value from `newNonce()` for this request
 * @param mode `NODE_ENV` (inlined at build time by Next.js)
 */
export function contentSecurityPolicy(
  nonce: string,
  mode: string | undefined = process.env.NODE_ENV,
): string {
  const development = mode === "development";
  const devEval = development ? " 'unsafe-eval'" : "";
  const styleSource = development ? "'unsafe-inline'" : `'nonce-${nonce}'`;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    `style-src 'self' ${styleSource}`,
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
