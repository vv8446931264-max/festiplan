# Testing

Every number below comes from running the suites (`npm test`, `npm run test:coverage`,
`npm run test:e2e`) on 2026-10-24.

| Layer | Tool | Tests | What they prove |
|---|---|---|---|
| Engine (`tests/engine`, 13 files) | Vitest | 135 | Budget sums are exact over ~500 seeded random cases each for allocation and re-balancing; locked lines never move; no negative amounts; edits that change the total are rejected; topological sort, cycles and unknown dependencies; clamping to today, crunch and phase boundaries (0, 7, 8, 28, 29, 91, 92, 182, 183 days); RFC 5545 escaping and 75-octet folding with ₹ and Devanagari; Indian number formatting; particle layout, delta-only reassignment and spring convergence |
| AI (`tests/ai`, 8 files) | Vitest + fake Gemini client | 63 | JSON-mode request shape, Zod failure → one corrective retry → labelled template fallback, timeout handling, prompt-injection text stays inside the delimited data block, every template passes the schema for many random briefs, only grounded `https` Maps places are returned (duplicates and non-https dropped), refine stream and its template answer |
| Store (`tests/store`) | Vitest | 9 | Memory and Firestore adapters (fake binding): Timestamp ↔ Date for TTL, expired and foreign documents read as missing, transactional `mutate` |
| Security (`tests/security`) | Vitest | 26 | Streaming byte cap (with and without `content-length`), content-type, same-origin rules, fixed-window rate limit and `RATE_LIMIT_SCALE`, spoof-resistant client IP (`TRUSTED_PROXY_HOPS`), edit keys hashed and compared timing-safely |
| Server (`tests/server`) | Vitest | 28 | Plan service end-to-end with the memory store: budget + contingency equals the brief exactly; wrong key → 403; bad edits → 422 and write nothing; **concurrent edits from two phones both survive**; structured logs carry no user text |
| API (`tests/api`) | Vitest, route handlers called with real `Request`s | 23 | Status codes and bodies for every route (201/400/403/404/413/415/422/429 with `Retry-After`), streaming refine, `.ics` headers, health |
| Components (`tests/components`) | Testing Library + axe-core | 32 | The planner form validates, focuses its error summary and maps server issues to fields; a preset posts the right brief, shows staged progress and unfolds the plan; sliders keep the budget exact and respect locks; read-only mode has no controls; template plans are labelled; AI text carries `lang`; **axe finds no WCAG A/AA violations** (colour contrast is checked in the browser suite) |
| 3D (`tests/three`, `tests/components/three.test.tsx`) | Vitest | 31 | Tier gating (reduced motion, Save-Data, ≤ 4 cores, no WebGL → poster), event bus, lantern dimming curve, lazy scene mount/teardown, static budget fallback |
| **Unit + component total** | | **347** (42 files) | |
| End-to-end (`e2e/`) | Playwright, production build, Desktop Chrome 1440×900 **and** Pixel 7 | 7 scenarios × 2 = **14** | Landing passes axe; an empty brief focuses the error summary and its links move focus; **preset → plan → drag a slider → budget still sums to ₹12,00,000 → tick two tasks → saved → the share URL is server-rendered with `X-Robots-Tag: noindex` → the same plan reloads with the ticks → axe passes**; a stranger sees a read-only plan; `.ics` export is valid; unknown plans return a real 404; health endpoint. Stable across `--repeat-each=3` (42/42). |

## Coverage

`npm run test:coverage` enforces a **100 %** threshold on `src/lib/engine` — the code that
produces every rupee and date:

```
Statements   : 100% ( 395/395 )
Branches     : 100% ( 156/156 )
Functions    : 100% ( 137/137 )
Lines        : 100% ( 297/297 )
```

## Real AI

`tests/ai/live.test.ts` calls the real model and is skipped unless `LIVE_AI_TOKEN` is set,
so CI never depends on a network service. End-to-end tests run in template mode on purpose:
deterministic output, no quota, no flakiness. The live deployment uses Gemini on Vertex AI.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs lint (ESLint + size rules),
typecheck, the coverage-gated unit suite and the production build, then the Playwright suite.
A green run on `main` triggers the Cloud Run deploy, which smoke-tests `/api/health` and `/`.
