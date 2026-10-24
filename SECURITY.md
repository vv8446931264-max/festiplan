# Security

FestiPlan has no accounts, so its threat model is small: protect the AI quota, keep
plans editable only by people holding the edit key, never let user text steer the
model, and never leak credentials. Every control below is implemented in code and
covered by tests.

## Reporting

Please open a private security advisory on GitHub or email the maintainer. Do not
file public issues for vulnerabilities.

## Controls

| Risk | Control | Code | Tests |
|---|---|---|---|
| Credential leakage | Production uses the Cloud Run service identity (ADC) for Vertex AI and Firestore — no API keys exist in production. `GEMINI_API_KEY` is local-only, server-only, never `NEXT_PUBLIC_`. Deploys use Workload Identity Federation (no service-account keys). | `src/lib/ai/client.ts`, `.github/workflows/deploy.yml` | `tests/ai/client.test.ts` |
| Oversized / malformed bodies | Streaming byte cap per route (8 KB plan, 16 KB patch, 2 KB refine, 1 KB vendors) checked before parsing; `application/json` required; Zod strict objects reject unknown keys. | `src/lib/security/body.ts`, `src/lib/contracts/input.ts` | `tests/security/body.test.ts` |
| Quota abuse / DoS | Per-IP fixed-window rate limits (plan 5/min, refine 10/min, vendors 10/min, patch 30/min) with `Retry-After`; Cloud Run max instances capped. | `src/lib/security/rate-limit.ts` | `tests/security/rate-limit.test.ts` |
| Cross-site request forgery | State-changing routes require a same-origin `Origin` (or `Sec-Fetch-Site: same-origin`). | `src/lib/security/origin.ts` | `tests/security/origin.test.ts` |
| Unauthorised edits | Each plan has a 256-bit random edit key returned once; only its SHA-256 is stored; comparison is timing-safe. Share links are read-only; the edit link carries the key in the URL fragment, which browsers never send to servers. | `src/lib/security/edit-key.ts`, `src/lib/client/edit-keys.ts` | `tests/security/edit-key.test.ts`, `tests/server/*.test.ts` |
| Prompt injection | User text reaches Gemini only inside a delimited block labelled as untrusted data, with delimiter sequences stripped; the system instruction tells the model to ignore instructions inside it. Model output is Zod-validated and can never set amounts or dates. | `src/lib/ai/prompts.ts` | `tests/ai/prompts.test.ts` |
| Hallucinated vendors | Only places returned in Maps grounding metadata (title + `https` Maps URI) are rendered; no model text is shown as a vendor. | `src/lib/ai/vendors.ts` | `tests/ai/vendors.test.ts` |
| Tampered budgets | PATCHed allocations must cover the same categories and sum to the same total, or the server answers 422. | `src/lib/engine/budget.ts` (`applyEdits`) | `tests/engine/budget-edit.test.ts` |
| XSS / clickjacking | React escaping (no `dangerouslySetInnerHTML`); CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, strict referrer policy, restrictive Permissions-Policy. | `next.config.ts` | `e2e/` |
| Direct database access | Firestore security rules deny all client access; only the server (Admin SDK) reads and writes. | `firestore.rules` | — |
| Data retention | Plans expire via a Firestore TTL policy 180 days after creation. Logs contain no user text. | `src/lib/server/plan-service.ts`, `src/lib/server/log.ts` | `tests/server/*.test.ts` |
