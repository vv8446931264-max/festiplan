# Contributing to FestiPlan

Thanks for helping. This guide is the human-readable version of the rules in
[`CLAUDE.md`](CLAUDE.md); where the two differ, `CLAUDE.md` wins.

## Setup

```bash
npm ci                         # Node ≥ 22 (CI uses Node 24)
cp .env.example .env.local     # optional: GEMINI_API_KEY; without it you get labelled template plans
npm run dev                    # http://localhost:3000
npx playwright install chromium   # once, for the end-to-end tests
```

No cloud account is needed for development. Without credentials the app uses the
in-memory store and the deterministic template plans.

## Scripts

| Script | What it does |
|---|---|
| `npm run format` / `format:check` | Prettier (100 columns, Tailwind class order) — write or check |
| `npm run lint` | ESLint (typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, jsx-a11y `strict`, Next.js rules) and the size rules in `scripts/check-size.mjs` |
| `npm run typecheck` | `tsc --noEmit` in strict mode |
| `npm test` / `test:coverage` | Vitest unit and component tests; coverage enforces 100 % on `src/lib/engine` and ≥ 80 % on `src/lib` |
| `npm run test:e2e` | Playwright on a production build, desktop and mobile, with axe |
| `npm run verify` | format check + lint + typecheck + tests + build: **must pass before every push** |

## Code style

- **AI ideates, code calculates.** Gemini returns ideas, weights and task lists as
  Zod-validated JSON. Every rupee, date, percentage, count and sort order comes from pure
  functions in `src/lib/engine`, which do no I/O and take `today` as an argument.
- TypeScript strict, no `any`, no non-null assertions, `type` aliases, `import type` for
  type-only imports.
- Files stay under 200 lines and functions in `src/` under 40 lines (enforced). Split by
  responsibility: a component per concern, a module per idea.
- Named exports only, except where Next.js requires a default export (pages, layouts,
  route metadata files, config). Every exported function or component has a JSDoc line.
- Descriptive names (no single-letter variables beyond loop indices), named constants
  instead of magic numbers, comments only for the non-obvious *why*.
- Server Components by default; interactive islands live in `src/components` with
  `"use client"`. `three` is only ever loaded with `next/dynamic({ ssr: false })`.
- Every request body: byte cap, then a Zod `.strict()` schema. User text reaches the model
  only inside a delimited block marked as data.
- Accessibility is part of done: landmarks, labels, visible focus, `aria-live` for async
  results, `lang` on non-English output, 44 px targets, reduced-motion fallbacks.

## Tests

New logic comes with tests in `tests/`, mirroring `src/`. Engine code keeps 100 %
coverage. UI behaviour is tested through roles and labels (Testing Library), and new
screens pass axe. User-visible flows get a Playwright check in `e2e/`.

## Commits and branches

- One branch: `main`. Keep commits small and keep `main` green. Every push to `main` runs
  CI and, when it passes, deploys.
- [Conventional commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `test:`,
  `perf:`, `docs:`, `refactor:`, `chore:`, `ci:`, `style:`.
- Never commit `.env*` files (except `.env.example`), keys, `node_modules`, `.next`,
  `coverage` or `test-results`. The repository stays under 10 MB, and 3D geometry is
  procedural (no binary models).

## Definition of done

`npm run verify` passes · tests cover the new logic · docs updated if behaviour changed ·
`CHANGELOG.md` updated · committed and pushed to `main`.

Security issues: please follow [`SECURITY.md`](SECURITY.md) instead of opening an issue.
