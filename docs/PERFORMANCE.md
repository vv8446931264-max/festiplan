# Performance

Measured on the production build (`npm run build`, Next.js 16.4 with Turbopack), gzip -9
sizes of the files the landing page actually requests.

## Landing page payload

| Asset | gzip | Notes |
|---|---|---|
| HTML (server-rendered) | 7 KB | Full content in the first response; no skeleton |
| CSS | 7 KB | Tailwind v4, one file |
| JavaScript — React DOM | 70 KB | framework |
| JavaScript — Next.js runtime | 43 KB | framework |
| JavaScript — FestiPlan code | ~41 KB | planner, plan view, engine, client helpers |
| **Initial JS total (modern browsers)** | **154 KB** | the 38 KB `nomodule` polyfill chunk is only fetched by legacy browsers |
| three.js scene chunk | 135 KB | **not** in the initial load — imported after first paint via `requestIdleCallback`, and never on reduced-motion, Save-Data, ≤ 4-core or no-WebGL devices |
| Poster (`public/poster.webp`) | 48.9 KB | static fallback, captured from the real scene |
| Fonts | self-hosted | `next/font`, `display: swap`, Latin subsets only |

DESIGN.md originally budgeted 120 KB for landing JS; React 19 + the Next runtime alone are
113 KB, so the honest budget we hold ourselves to is **≤ 50 KB of our own code on top of the
framework** (currently ~41 KB). One regression we caught and fixed: importing constants
through the contracts barrel pulled Zod (~40 KB) into the browser; a lint rule
(`@typescript-eslint/no-restricted-imports` in `eslint.config.mjs`) now prevents it.

## Runtime

- **No AI call on interaction.** Slider drags, locks, actuals and ticks run through the pure
  engine in the browser instantly; saves are one debounced PATCH (700 ms) per burst.
- **WebGL cost control:** one draw call per instanced system (lanterns, cores, glows, confetti,
  columns, particles); DPR clamped to 1.75 (high) / 1.25 (low); render loops pause when the tab
  is hidden or the canvas is off-screen; the budget scene sleeps once particles settle; bloom
  was replaced by additive sprites (bloom costs ~20 KB and a full-screen pass).
- **Caching:** identical briefs reuse the validated Gemini plan for an hour; Maps-grounded
  vendor lookups are cached for 24 hours per city and category.
- **Server:** Cloud Run, 1 vCPU / 1 GiB, concurrency 40, scale to zero; Firestore reads are
  single-document; plan edits are one transaction.

## Reproduce

```bash
npm run build && npx next start -p 3300 &
curl -s localhost:3300/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u \
  | while read f; do printf '%s %s\n' "$(gzip -9 -c ".next${f#/_next}" | wc -c)" "$f"; done
```
