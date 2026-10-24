# Changelog

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
