# FestiPlan — rules for anyone (human or agent) working in this repo

GenAI celebration & event planner for weddings, birthdays and community events:
budgets, timelines, vendor checklists, personalized ideas.
Product spec: `docs/SPEC.md`. Design system: `docs/DESIGN.md`. Read both before
changing product behaviour or UI. Release notes: `CHANGELOG.md`.

## Prime directive — AI ideates, code calculates
Gemini produces ideas, category weights, task lists and vendor guidance as
Zod-validated JSON. Every rupee, date, percentage, count and sort order is computed
by pure TypeScript in `src/lib/engine`. Never ask the model for arithmetic, and never
render a model-invented vendor name — only places returned by Maps grounding.

## Stack (pin exact versions; confirm each with `npm view <pkg> version` first)
Next.js (latest stable, App Router, `output: "standalone"`) · React 19 · TypeScript
strict · Tailwind CSS v4 · Zod v4 · `@google/genai` · `@google-cloud/firestore` ·
`three` (lazy-loaded only) · Vitest + Testing Library + vitest-axe · Playwright +
`@axe-core/playwright`.
No other runtime dependency without a one-line reason in `docs/ARCHITECTURE.md`.
Platform first: `crypto.randomUUID`, `Intl.NumberFormat("en-IN")`,
`AbortSignal.timeout`, native `<input type="range|date">`, CSS scroll-driven animations.

## Commands
`npm run dev` · `lint` · `typecheck` · `test` · `test:e2e` · `build` ·
`verify` (= lint + typecheck + test + build; must pass before every push)

## Layout
- `src/app` — routes; React Server Components by default
- `src/components` — interactive client islands (`"use client"`)
- `src/lib/engine` — pure functions, no I/O, no Date.now() (inject `today`)
- `src/lib/ai` — Gemini client, prompts, schemas, retry, fallback
- `src/lib/store` — Firestore adapter + in-memory adapter (dev/test)
- `src/lib/security` — rate limit, body caps, edit keys, sanitizing
- `src/three` — WebGL scenes, client-only, dynamically imported
- `tests/` mirrors `src/`; `e2e/` holds Playwright specs

## Rules
- No page ships a skeleton-only server render. Shared plans are server-rendered.
- Files < 200 lines, functions < 40 lines, no `any`, no `!` on external data,
  named exports, JSDoc on every exported function.
- Every request body: byte cap + Zod `.strict()`. Every AI output: Zod parse →
  one self-correcting retry → clearly labelled deterministic template fallback.
- User text reaches the model only inside a delimited block marked as data.
- No secrets in code or git. Production auth = ADC on Cloud Run (no API key).
  `GEMINI_API_KEY` is for local/cloud-dev only and server-only. Nothing secret is
  ever `NEXT_PUBLIC_`.
- `three` only via `next/dynamic({ ssr: false })` with named imports. Static
  fallback under `prefers-reduced-motion`, Save-Data or low-power devices.
  Canvases are `aria-hidden`; any data they show also exists in the DOM.
- WCAG 2.2 AA: landmarks, labels, visible focus, `aria-live` on async results,
  `lang` on non-English output, 44px targets, no scroll hijacking.
- Claims must be backed by code or measurement. No vanity numbers in UI or docs.

## Definition of done (every change)
`npm run verify` passes · tests cover new logic · docs updated if behaviour
changed · `CHANGELOG.md` updated · committed and pushed to `main`.

## Git
Single branch `main`. Conventional commits (`feat:` `fix:` `test:` `perf:`
`docs:` `refactor:` `chore:` `ci:`). Commit messages carry no AI-tool names and no
Co-Authored-By trailers (owner preference). Never commit `.env*` (except
`.env.example`), keys, `node_modules`, `.next`, `coverage`, `test-results`.
Repo stays < 10 MB (`git count-objects -vH`); no binary 3D assets — geometry is
procedural.
