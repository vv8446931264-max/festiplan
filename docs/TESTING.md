# Testing

Every number below comes from running the suites (`npm test`, `npm run test:coverage`,
`npm run test:e2e`) on 2026-10-31.

| Layer | Tool | Tests | What they prove |
|---|---|---|---|
| Engine (`tests/engine`, 21 files) | Vitest | 162 | Budget sums are exact over ~500 seeded random cases each for allocation and re-balancing; locked lines never move; no negative amounts; edits that change the total are rejected; topological sort, cycles and unknown dependencies; proportional schedule compression keeps every dependency in order; clamping to today, crunch and phase boundaries (0, 7, 8, 28, 29, 91, 92, 182, 183 days); RFC 5545 escaping and 75-octet folding with ₹ and Devanagari; Indian number formatting; particle layout, delta-only reassignment and spring convergence |
| AI (`tests/ai`) | Vitest + fake Gemini client | 73 | JSON-mode request shape, Zod failure → one corrective retry → labelled template fallback, timeout handling, prompt-injection text stays inside the delimited data block, every template passes the schema for many random briefs, only grounded `https` Maps places are returned (duplicates and non-https dropped), refine stream and its template answer |
| Store (`tests/store`) | Vitest | 16 | Memory and Firestore adapters (fake binding): Timestamp ↔ Date for TTL, expired and foreign documents read as missing, transactional `mutate`, including the real `runTransaction` code path against a mocked Firestore SDK |
| Security (`tests/security`) | Vitest | 42 | Streaming byte cap (with and without `content-length`), content-type, same-origin rules, fixed-window rate limit and `RATE_LIMIT_SCALE`, spoof-resistant client IP (`TRUSTED_PROXY_HOPS`, IPv6 keyed by /64), edit keys hashed and compared timing-safely, nonce CSP from `src/proxy.ts` (fresh nonce, no `unsafe-inline` scripts), static hardening headers |
| Server (`tests/server`) | Vitest | 32 | Plan service end-to-end with the memory store: budget + contingency equals the brief exactly; wrong key → 403; bad edits → 422 and write nothing; **concurrent edits from two phones both survive**; the pure patch logic; body reading (byte cap + strict schema) and thrown or rejected handler errors → plain 500; structured logs carry no user text |
| API (`tests/api`) | Vitest, route handlers called with real `Request`s | 29 | Status codes and bodies for every route (201/400/403/404/413/415/422/429 and 503 with `Retry-After`), vendor lookups require a stored plan, the global AI cap, streaming refine, `.ics` headers, health |
| Components (`tests/components`) | Testing Library + axe-core | 49 | Autosave merges bursts, keeps saves in order, never reports "saved" while a change is pending, retries transient failures with the change put back, reports rejections, and flushes with `keepalive` when the page is left; the pure plan reducer; Ask FestiPlan streams, survives a dropped stream and re-enables; vendor search shows only grounded places; sharing copies, uses the native sheet and never prints the edit link; the planner form validates, focuses its error summary and maps server issues to fields; a preset posts the right brief, shows staged progress and unfolds the plan; sliders keep the budget exact and respect locks; read-only mode has no controls; template plans are labelled; AI text carries `lang`; **axe finds no WCAG A/AA violations** (colour contrast is checked in the browser suite) |
| 3D (`tests/three`, `tests/components/{scene-backdrop,budget-flow}.test.tsx`) | Vitest | 38 | Tier gating (reduced motion, Save-Data, ≤ 4 cores, no WebGL → poster), event bus, lantern dimming curve, lazy scene mount/teardown, static budget fallback |
| SEO (`tests/seo`) | Vitest | 34 | Title and description lengths, canonical and social metadata on `/` only, JSON-LD shape and escaping, the FAQ mirrors its structured data, generated icon and share-image sizes |
| **Unit + component total** | | **475** (66 files) | |
| End-to-end (`e2e/`) | Playwright, production build, Desktop Chrome 1440×900 **and** Pixel 7 | 13 scenarios × 2 = **26** | Landing passes axe; an empty brief focuses the error summary and its links move focus; **preset → plan → drag a slider → budget still sums to ₹12,00,000 → tick two tasks → saved → the share URL is server-rendered with `X-Robots-Tag: noindex` → the same plan reloads with the ticks → axe passes on every tab**; a new plan keeps its URL, edit rights and tab across a refresh; a stranger sees a read-only plan; `.ics` export is valid; unknown plans return a real 404; health endpoint; SEO: one `h1`, snippet-length title and description, canonical and social tags, JSON-LD with the CSP nonce, robots/sitemap/manifest agree, plan pages stay unindexed. Stable across `--repeat-each=3` (78/78). |

## Coverage

`npm run test:coverage` enforces two thresholds: **100 %** on `src/lib/engine` (the code that
produces every rupee and date: 412/412 statements, 164/164 branches) and **≥ 80 %** on all of
`src/lib` (server, AI, store, security, contracts, client helpers). Measured for `src/lib`:

```
Statements   : 98.34% ( 1362/1385 )
Branches     : 96.29% ( 675/701 )
Functions    : 98.80% ( 413/418 )
Lines        : 98.82% ( 1170/1184 )
```

## Real AI

`tests/ai/live.test.ts` calls the real model and is skipped unless `LIVE_AI_TOKEN` is set,
so CI never depends on a network service. End-to-end tests run in template mode on purpose:
deterministic output, no quota, no flakiness. The live deployment uses Gemini on Vertex AI.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs lint (ESLint + size rules),
typecheck, the coverage-gated unit suite and the production build, then the Playwright suite.
A green run on `main` triggers the Cloud Run deploy, which smoke-tests `/api/health` and `/`.
