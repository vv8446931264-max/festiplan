# Performance

Measured on the production build (`npm run build`, Next.js 16.4 with Turbopack) on
2026-10-31: gzip -9 sizes, in KiB, of the files the landing page actually requests.

## Landing page payload

| Asset | gzip | Notes |
|---|---|---|
| HTML (server-rendered) | 10.6 KB | Full content in the first response (FAQ and JSON-LD included); no skeleton |
| CSS | 8.4 KB | Tailwind v4, one file |
| JavaScript — React DOM | 70 KB | framework |
| JavaScript — Next.js runtime | 44 KB | framework |
| JavaScript — FestiPlan code | ~49 KB | planner, tabbed plan workspace, engine, client helpers |
| **Initial JS total (modern browsers)** | **163 KB** | the `nomodule` polyfill chunk is only fetched by legacy browsers |
| three.js scene chunk | 135 KB | **not** in the initial load — imported after first paint via `requestIdleCallback`, and never on reduced-motion, Save-Data, ≤ 4-core or no-WebGL devices |
| Poster (`public/poster.webp`) | 48 KB | static fallback, captured from the real scene |
| Fonts | self-hosted | `next/font`, `display: swap`, Latin subsets only |

DESIGN.md originally budgeted 120 KB for landing JS; React 19 + the Next runtime alone are
114 KB, so the honest budget we hold ourselves to is **≤ 50 KB of our own code on top of the
framework** (currently ~49 KB). One regression we caught and fixed: importing constants
through the contracts barrel pulled Zod (~40 KB) into the browser; a lint rule
(`@typescript-eslint/no-restricted-imports` in `eslint.config.mjs`) now prevents it.

## Rendering

Every page is rendered per request so each response can carry a fresh CSP nonce
(`src/proxy.ts`): no `'unsafe-inline'` scripts. Measured cost on the production build:
**~19 ms** server time for the landing page (median of 5 warm runs, `curl -w %{time_total}`),
and the HTML is still the complete page (10.6 KB gzip).

## Runtime

- **No AI call on interaction.** Slider drags, locks, actuals and ticks run through a pure
  reducer over the engine in the browser instantly; saves are one debounced, ordered PATCH
  (700 ms) per burst, and unchanged inputs send nothing.
- **Minimal re-rendering.** Each plan chapter receives only its own slice of state and stable
  callbacks behind `React.memo`, so dragging a budget slider re-renders only the header and the budget chapter.
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
npm run build && PORT=3300 HOSTNAME=127.0.0.1 npm start &
curl -s 127.0.0.1:3300/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u \
  | while read f; do printf '%s %s\n' "$(gzip -9 -c ".next${f#/_next}" | wc -c)" "$f"; done
```
