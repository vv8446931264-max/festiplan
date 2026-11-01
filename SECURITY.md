# Security

FestiPlan has no accounts and stores no passwords or payment data, so its threat model is
small and specific. Every control below is implemented in code or in checked-in
configuration. The Tests column names the tests that exercise each control. Where a control
is cloud configuration that unit tests cannot reach, the column says so.

## Reporting a vulnerability

Please report privately through GitHub: **Security → Advisories → Report a vulnerability**
on this repository. Do not open a public issue. Only `main` (the live deployment) is
supported; fixes ship as a new deploy from `main`.

## Threat model

| Asset | Adversary and goal | Trust boundary and main controls |
|---|---|---|
| Gemini / Maps quota and the cloud bill | Bots and scripted clients flooding the AI routes | Browser → API: per-client and per-instance limits, byte caps, strict schemas, AI ceiling |
| Edit rights to a plan | Someone holding only the read-only link, or guessing IDs | API: 256-bit edit key checked against a SHA-256 hash in constant time; 72-bit random plan IDs |
| Visitors' browsers | XSS, clickjacking, cross-site form posts | Response headers: nonce CSP, `frame-ancestors 'none'`, same-origin checks on writes |
| Model behaviour | Prompt injection through the brief or a question | API → Gemini: user text only inside a delimited data block; model output is Zod-validated and never sets amounts or dates |
| Plan data | Direct database reads, search-engine indexing | Server → Firestore: Admin SDK only, deny-all client rules, `noindex`, 180-day TTL |
| Cloud credentials and deploys | Leaked keys, malicious pull requests, compromised dependencies | GitHub → Google Cloud: keyless Workload Identity Federation, deploys only from pushes to `main`, SHA-pinned actions, CodeQL, audited production dependencies |

## Controls

| Risk | Control | Code | Tests |
|---|---|---|---|
| Credential leakage | Production uses the Cloud Run service identity (ADC) for Vertex AI and Firestore, so no API keys exist in production. `GEMINI_API_KEY` is local-only and server-only, never `NEXT_PUBLIC_`. Deploys use Workload Identity Federation, so no service-account keys exist. `.env*` (except the placeholder-only `.env.example`) and key or credential files are git-ignored, and `.env*` is excluded from the Docker build context. | `src/lib/ai/client.ts`, `.github/workflows/deploy.yml`, `.gitignore`, `.dockerignore` | `tests/ai/client.test.ts` (backend selection). WIF itself is cloud configuration with no unit test. |
| Over-privileged runtime | The service runs as a dedicated `festiplan-runtime` service account. It holds only `roles/aiplatform.user`, `roles/datastore.user` and `roles/logging.logWriter`. The deployer may act as that one account (`iam.serviceAccountUser` granted on the SA). The deploy passes `--service-account` when the `GCP_RUNTIME_SA` repo variable is set. Projects bootstrapped before that variable existed keep the default compute SA until the script is re-run. The container runs as the unprivileged `node` user. | `scripts/gcp-bootstrap.sh`, `.github/workflows/deploy.yml`, `Dockerfile` | IAM configuration, so no unit test. The deploy smoke test checks `/api/health` after every deploy. |
| Oversized / malformed bodies | A streaming byte cap per route (8 KB plan, 16 KB patch, 2 KB refine, 1 KB vendors) is enforced before parsing, so nothing larger is ever buffered. `application/json` is required. Zod strict objects reject unknown keys. | `src/lib/security/body.ts`, `src/lib/contracts/input.ts` | `tests/security/body.test.ts`, `tests/api/*.test.ts` (413 / 415 / 400) |
| Quota abuse / DoS (per client) | Fixed-window limits per client: plan 5/min, refine 10/min, vendors 10/min, patch 30/min, reads 120/min, `.ics` 60/min. Each answers 429 with `Retry-After`. The client IP is the `X-Forwarded-For` entry appended by Cloud Run's front end (rightmost, `TRUSTED_PROXY_HOPS`), so a client cannot spoof its way around the limit. IPv4 is keyed per address. IPv6 is keyed on its **/64** network, because one subscriber holds a whole /64. IPv4-mapped IPv6 is keyed as the IPv4 address. | `src/lib/security/rate-limit.ts`, `src/lib/security/ip.ts`, `src/lib/server/http.ts` | `tests/security/rate-limit.test.ts`, `tests/security/ip.test.ts`, `tests/security/origin.test.ts`, `tests/server/http.test.ts`, `tests/api/plan.test.ts`, `tests/api/vendors.test.ts` (two addresses in one /64 share a window) |
| Quota abuse / DoS (many clients) | Each instance has a global ceiling of 120 AI-backed requests per minute (× `RATE_LIMIT_SCALE`), shared by plan creation, refine and vendors. It is checked after the per-client limit and after validation, so junk requests do not spend it. Over the ceiling the server answers 503 with `Retry-After` and a plain-language message. Cloud Run is capped at 5 instances. Plan output is bounded by `maxOutputTokens` (8192 for English, 16384 for other languages). A reply cut off at that limit is asked for once more with 1.5× the budget (at most 24576), without resending the cut-off text. | `src/lib/server/http.ts` (`aiGlobalLimit`), `src/lib/ai/plan-model.ts`, `.github/workflows/deploy.yml` | `tests/api/ai-ceiling.test.ts`, `tests/ai/plan-truncation.test.ts` |
| Open-ended Maps proxy | `POST /api/vendors` takes only `{ planId, category }`. The city and event type are read from the stored plan, so the endpoint cannot run arbitrary Maps searches. An unknown plan returns 404. | `src/app/api/vendors/route.ts`, `src/lib/contracts/input.ts` | `tests/api/vendors.test.ts` |
| Cross-site request forgery | State-changing routes require an `Origin` header naming this host. Without an `Origin`, they require `Sec-Fetch-Site: same-origin`. | `src/lib/security/origin.ts` | `tests/security/origin.test.ts`, `tests/api/*.test.ts` (403) |
| Unauthorised edits | Each plan gets a 256-bit random edit key, returned once. Only its SHA-256 is stored, and the comparison is timing-safe. Share links are read-only. The edit link carries the key in the URL fragment, which browsers never send to servers. | `src/lib/security/edit-key.ts`, `src/lib/client/edit-keys.ts` | `tests/security/edit-key.test.ts`, `tests/server/plan-service.test.ts`, `tests/api/plan-id.test.ts`, `e2e/planner.spec.ts` (read-only viewer) |
| Prompt injection | User text reaches Gemini only inside a delimited block labelled as untrusted data, with delimiter sequences stripped. The system instruction tells the model to ignore instructions inside it. Model output is Zod-validated and can never set amounts or dates. | `src/lib/ai/prompts.ts` | `tests/ai/prompts.test.ts`, `tests/ai/plan.test.ts`, `tests/ai/vendors.test.ts` |
| Hallucinated vendors | Only places returned in Maps grounding metadata (title plus an `https` Maps URI) are rendered. No model text is shown as a vendor. | `src/lib/ai/vendors.ts` | `tests/ai/vendors.test.ts` |
| Tampered budgets | PATCHed allocations must cover the same categories and sum to the same total. Otherwise the server answers 422 and writes nothing. | `src/lib/engine/budget.ts` (`applyEdits`), `src/lib/server/plan-service.ts` | `tests/engine/budget-edit.test.ts`, `tests/server/plan-service.test.ts`, `tests/api/plan-id.test.ts` |
| Lost updates | Every edit is one atomic read-modify-write through `PlanStore.mutate`. In Firestore that is a `runTransaction` (read, decide, then `set` only when there is a next plan). In memory it is a no-await critical section. Concurrent saves from two phones both persist. | `src/lib/store/firestore.ts` (`loadFirestore`, `mutate`), `src/lib/store/memory.ts` | `tests/store/firestore-sdk.test.ts` (the real transaction code against a mocked `@google-cloud/firestore`: one read and one write per edit, no write for 403 / 404 / 422), `tests/server/concurrency.test.ts` |
| XSS | Nonce-based CSP from `src/proxy.ts`. Every page request gets a fresh 128-bit nonce. Scripts run only with it (`script-src 'self' 'nonce-…' 'strict-dynamic'`) and styles likewise (`style-src 'self' 'nonce-…'`), so the production policy contains no `'unsafe-inline'` at all. A nonce cannot unlock a `style` attribute, so pages ship none: the look comes from classes and `globals.css`, the model's palette colours (Zod-validated `#RRGGBB`) are SVG `fill` and `stop-color` attributes, and run-time changes go through the CSSOM, which CSP does not restrict. Development lists `'unsafe-inline'` in place of the style nonce (the dev server injects styles without one) and adds `'unsafe-eval'`. The rest of the policy is `default-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` and `connect-src 'self'`, plus `upgrade-insecure-requests` in production. Next.js stamps the nonce on its own scripts and inline styles, and `'strict-dynamic'` lets those scripts load the lazy WebGL chunks. Pages render per request (`connection()` in the root layout), so each one gets its own nonce. React escapes all output; `dangerouslySetInnerHTML` appears only for JSON-LD, which is serialised with `<` escaped and carries the nonce. API responses carry `default-src 'none'`. | `src/proxy.ts`, `src/lib/security/csp.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/landing/JsonLd.tsx`, `next.config.ts` | `tests/security/proxy.test.ts` (header shape, per-request nonce, dev/prod differences in `unsafe-eval`, `upgrade-insecure-requests` and the style source, matcher skips `/api`, static assets and prefetches), `tests/security/headers.test.ts`, `tests/security/csp-stylesheet.test.ts` (the CSS colours and sky equal `CATEGORY_COLORS` and `DUSK_BACKGROUND`), `tests/components/no-inline-styles.test.tsx` (no `style` attribute or `<style>` in the server HTML of the landing page, a shared plan, the sky, and the 404, error and global error pages), `e2e/csp.spec.ts` (production headers, server HTML, and no violation in a real browser on the landing page and in every plan tab), `e2e/seo.spec.ts` (JSON-LD nonce, no raw `<`) |
| Clickjacking, sniffing, cross-origin leaks | `frame-ancestors 'none'` plus `X-Frame-Options: DENY`, HSTS (two years, subdomains), COOP and CORP `same-origin`, `nosniff`, a strict referrer policy, and a Permissions-Policy that denies camera, microphone, geolocation, payment and USB. Shared plans send `X-Robots-Tag: noindex, nofollow`. `X-Powered-By` is off. | `next.config.ts` | `tests/security/headers.test.ts`, `e2e/seo.spec.ts` (noindex) |
| Direct database access | Firestore security rules deny all client access. Only the server (Admin SDK) reads and writes. | `firestore.rules` | No test: rules are deployed configuration. |
| Data retention | Plans expire through a Firestore TTL policy 180 days after creation. Logs contain no user text. They carry only operational fields and, for AI calls, token counts. | `src/lib/server/plan-service.ts`, `src/lib/server/log.ts`, `src/lib/ai/plan.ts` | `tests/server/plan-service.test.ts` (`expireAt`), `tests/server/log.test.ts`, `tests/ai/plan-truncation.test.ts` (the token log carries numbers, not the brief). The TTL policy itself is cloud configuration. |
| Malicious pull requests reaching production | `deploy.yml` runs after CI only when CI succeeded for a **push** in this repository, or on a manual dispatch from `main`. Pull-request CI runs never deploy, including forks whose branch is named `main`. Workflows default to read-only `contents` permission, check out without persisting the token, and pass repository variables to shell steps through `env`, never by expression interpolation. | `.github/workflows/deploy.yml`, `.github/workflows/ci.yml` | Workflow configuration; CodeQL's `actions` analysis re-checks it on every push. |
| Supply chain | Direct dependencies are pinned to exact versions and installed with `npm ci` from the lockfile (CI and Docker). Every GitHub Action is pinned to a full commit SHA. CodeQL (`security-extended`) analyses the TypeScript and the workflows on every push to `main` and weekly. CI fails on any high or critical advisory in the production dependency tree. | `package.json`, `package-lock.json`, `.github/workflows/*.yml` | `npm audit --omit=dev` in `ci.yml`; CodeQL results in the Security tab |

## Dependency policy

- **Production tree:** `npm audit --omit=dev` reports no advisories at any severity. CI
  blocks the build on high or critical ones. One transitive override pins `glob` 14.0.3
  under `rimraf`, which `google-gax` pulls in for build tooling and never loads at runtime.
- **Development tree:** moderate advisories in `minimatch` 3, used by ESLint and its
  plugins, remain until those tools move on. Lint tooling never ships: the runtime image
  contains only the traced Next.js standalone server output.
- **Updates:** Dependabot version-update pull requests are deliberately not configured,
  because this repository keeps a single branch. Updates are made on `main` and must pass
  `npm run verify` and the CI gates above.

## Known limitations

- Rate limits are kept in process memory, so each Cloud Run instance (at most 5) has its
  own windows. This is accepted for abuse damping. A shared store such as Memorystore, or
  Cloud Armor, would be the next step.
- Read-only share links are bearer links by design: anyone holding one can read that plan.
  Plan IDs carry 72 random bits; pages are `noindex` and expire after 180 days.
- The edit key is kept in the browser's `localStorage` so the owner can return to edit. The
  nonce CSP is what protects it from injected scripts.
