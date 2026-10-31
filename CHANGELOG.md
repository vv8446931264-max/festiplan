# Changelog

## [1.3.0] — 2026-10-31
### Security
- Deploys run only for CI runs triggered by a push to this repository (or a manual
  dispatch on `main`): a pull request from a fork whose branch is named `main` can no
  longer reach the deploy job and its Google Cloud identity.
- Every GitHub Action is pinned to a full commit SHA; checkouts drop the token; repository
  variables reach shell steps through `env`. New CodeQL workflow (code and workflows).
- CI fails on high or critical advisories in production dependencies (`npm audit
  --omit=dev`); a patched `glob` is pinned under `rimraf` so that tree audits clean.
- `Cross-Origin-Resource-Policy: same-origin`; Permissions-Policy also denies payment and
  USB; CI credential files are kept out of git, Docker and source uploads.
### Changed
- Prettier (100 columns, Tailwind class order) formats the whole codebase and CI checks it;
  `.editorconfig` matches.
- ESLint runs typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` with type
  information, plus `jsx-a11y` strict; every finding was fixed in code, and the only two
  suppressions (`no-img-element` for a decorative poster and an OG-image `<img>`) state why.
- The size rule now covers tests, e2e and scripts (files < 200 lines); large components,
  scenes, templates, engine modules and test suites are split by responsibility, with
  descriptive names and named constants throughout.
### Added
- `CONTRIBUTING.md`; `SECURITY.md` rewritten as a threat model with a control table that
  points at the code; README sections for the chosen vertical, approach, how it works and
  assumptions.

## [1.2.0] — 2026-10-24
### Added
- Tabbed plan workspace: Overview, Ideas, Budget, Timeline, Vendors, Ask and Share are
  separate chapters behind a sticky WAI-ARIA tab bar with roving tabindex, arrow keys,
  Home/End, and URL hash deep links (`#budget` survives a refresh).
- Overview tab shows four summary cards: three concepts, the money, what's next, who to
  book first — each with a button that switches to its chapter.
- Collapsible timeline phases (only the current phase is open) with compact task rows.
- Proportional schedule compression: when time is short, every lead time scales by the
  same factor so dependencies stay ordered; one banner explains the compression.
- SEO: dynamic OpenGraph/Twitter images, JSON-LD (WebApplication + FAQPage),
  robots.txt, sitemap.xml, web manifest, canonical URLs, x-robots-tag noindex on
  share pages. Structured FAQ on the landing page.
- 468 unit tests (engine 100 % coverage), 26 Playwright e2e tests (desktop + mobile)
  with axe-core on every tab.
### Fixed
- Scroll-driven reveal animation left Ideas cards at opacity 0 in headless Chromium,
  failing axe colour-contrast checks. Removed opacity from the animation.
- Panel background was semi-transparent, making axe unable to determine contrast.
  Changed to opaque.
### Changed
- Plan pages show one chapter at a time instead of infinite scroll.
- Vendor questions folded into a disclosure ("What to ask — N questions · M red flags").
- Print styles unfold every tab panel and details group.

## [1.1.0] — 2026-10-24
### Security
- Nonce-based Content-Security-Policy from `src/proxy.ts` (no inline scripts); API responses
  send `default-src 'none'`.
- Vendor lookups take `{ planId, category }` and use the stored plan's city, so the endpoint is
  not an open Gemini proxy; a per-instance global cap on AI calls (503 + `Retry-After`).
- Rate limits key IPv6 clients by /64; the bootstrap creates a least-privilege runtime service
  account that deploys use when `GCP_RUNTIME_SA` is set.
- The private edit link is never printed.
### Fixed
- A failed save is put back and retried with backoff instead of being dropped; rejections are
  reported; "All changes saved" appears only when nothing is pending; pending saves flush with
  `keepalive` when the page is left.
- The countdown is computed from today, not the creation date.
- "Spent so far" validates against the server limit with an inline, announced error.
- "Ask FestiPlan" recovers from a dropped stream and aborts on unmount.
- Gemini replies cut off by the token limit are retried with a larger budget instead of falling
  back; non-English plans get a larger output budget; token usage is logged.
### Changed
- Plan state is a pure reducer; chapters get only their slice of state behind `React.memo`.
- The share page has an `h1`; focus moves sensibly between brief, progress and plan; links are
  underlined; every target is at least 24 px; a new plan's URL survives a refresh.
- Coverage thresholds: engine 100 %, `src/lib` ≥ 80 % (measured 98 %).

## [1.0.0] — 2026-10-24
### Added
- Brief → plan in one place: event-type cards, three one-tap demo briefs, validation with a
  focusable error summary, staged progress and a confetti reveal.
- Gemini (Vertex AI, JSON mode + schema) drafts three concepts, budget weights, a task list
  and vendor guidance; Zod validation, one corrective retry, labelled template fallback.
- Pure TypeScript engine (100 % coverage): exact largest-remainder budget split with 10 %
  contingency, live re-balancing with locks, planned-vs-actual and overspend alerts; timeline
  scheduled backwards from the event date with dependencies, crunch and overdue flags;
  vendor checklist; `.ics` export and Google Calendar links.
- Real vendors from Grounding with Google Maps (only grounded places are shown).
- "Ask FestiPlan": streamed answers grounded in the stored plan.
- Shareable server-rendered `/plan/[id]` (read-only link + private edit link), Firestore
  persistence with TTL, atomic edits.
- WebGL lantern sky, confetti and budget-flow particle simulation, lazy-loaded and gated,
  with a static poster captured from the real scene.
- Security: byte caps, strict schemas, same-origin checks, spoof-resistant per-IP rate
  limits, hashed edit keys with timing-safe comparison, CSP and hardening headers.
- CI (lint, size rules, typecheck, unit + component tests, build, Playwright e2e + axe on
  desktop and mobile) and Cloud Run deploys via Workload Identity Federation.
