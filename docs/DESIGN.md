# FestiPlan — Design System

Direction: **an editorial dusk celebration** — the craft of a WebGL studio site
(reference: oryzo.ai by Lusion) applied to a planning tool that must stay fast,
accessible and honest.

## 1. What the reference actually does (measured, Oct 2026)

- Astro static site + one custom three.js r178 bundle (~1.1 MB). A single fixed
  full-viewport canvas sits behind the DOM; a ~40,000 px scroll page (≈45 screens)
  drives the camera and scene changes chapter by chapter.
- Materials: `MeshPhysicalMaterial` with `transmission` (glass), env maps, matcaps,
  bloom post-processing. `InstancedMesh` for crowds of objects; curl-noise drift;
  `lerp`/`damp` smoothing everywhere; draggable physics objects; raycast picking;
  sound design.
- Palette: cream `#FFEDD7` on espresso `#100904`, orange `#DC5000`, olive
  `#445231`/`#5D6C49`, brown `#382416`, and a dusk gradient
  `#FFBF02 → #E9500E → #CD197D → #8C019C → #250187`.
- Type: a variable grotesk display (Halyard) at huge fluid sizes plus a serif
  (Literata) for editorial accents; all-caps micro-labels; magazine-cover blocks.
- Grid: 16 columns desktop / 4 columns mobile; a `--screen-unit` derived from viewport
  width drives every font size, so the composition scales as one picture.
- Tone: deadpan, witty product copy ("Made for mugs. Built for tables.").

## 2. What we borrow, what we refuse

| Borrow | Refuse (it costs Efficiency or Accessibility points) |
|---|---|
| one persistent background canvas, scroll-choreographed chapters | wheel/scroll hijacking — we use native scroll and damp the *camera*, not the page |
| glass + warm emissive light, bloom on desktop | a 1 MB eager bundle — `three` is a lazy chunk after first paint |
| instanced particle crowds, damped motion, drag-to-spin | autoplay sound |
| fluid screen-unit type scale, 16/4 column grid | text baked into canvas — all content is DOM |
| magazine/editorial blocks, witty micro-copy | low-contrast cream-on-orange text |

## 3. Tokens (contrast measured against WCAG 2.2)

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--espresso` | `#100904` | page background | — |
| `--cream` | `#FFEDD7` | body text on espresso | 17.26:1 |
| `--muted` | `#BBAC97` | secondary text | 8.90:1 |
| `--ember` | `#DC5000` | button fill (espresso label), accents | label 4.88:1 |
| `--ember-bright` | `#FF7A2E` | links/focus ring on espresso | 7.60:1 |
| `--ember-deep` | `#B54200` | links on cream sections | 4.90:1 |
| `--gold` | `#FFBF02` | highlights, numbers | 11.95:1 |
| `--olive` | `#445231` | surfaces (cream text) | 7.35:1 |
| `--brown` | `#382416` | cards (cream text) | 12.81:1 |
| `--line` | `#6C5F51` | borders, dividers (non-text) | 3.19:1 |
| `--dusk` | `#FFBF02 → #E9500E → #CD197D → #8C019C → #250187` | sky gradient, hero | decorative |

Never place cream text on ember (3.53:1). Category colours for budget charts are
drawn from the dusk gradient stops + olive + gold, each paired with a pattern or
label so colour is never the only signal.

## 4. Type

- Display: **Hanken Grotesk** (variable, 500–800), tracking −0.03em at large sizes.
- Editorial accent: **Literata** italic (400) for pull-quotes and one word per headline.
- Mono micro-labels: **JetBrains Mono** 500, uppercase, +0.08em tracking.
- Loaded with `next/font/google` (self-hosted at build, `display: swap`, latin +
  devanagari subsets only where used).
- Fluid scale (mirrors the reference): `--unit: min((100vw - 2*pad) / 1800, 100svh / 820)`;
  h1 = 164u, h2 = 68u, h3 = 45u, body-L = 24u, body = 18u, with `clamp()` floors so
  body text never drops below 16px.

## 5. Landing storyboard (single entry point, native scroll)

| # | Chapter | DOM | Canvas |
|---|---|---|---|
| 0 | Hero | giant "FestiPlan" wordmark, "Made for moments. Built for budgets.", Start planning CTA, scroll cue | lantern field drifts in dusk sky; pointer parallax |
| 1 | Manifesto | "It isn't just a checklist." editorial block, serif accents | lanterns drift toward camera |
| 2 | The brief | three oversized event cards (Wedding / Birthday / Community), demo-preset chips, the form | scene dims and slows (focus) |
| 3 | The moment | staged progress line while Gemini works | on success: confetti burst (instanced) |
| 4 | The plan workspace | header (title, facts, summary) + a sticky WAI-ARIA tab bar: **Overview · Ideas · Budget · Timeline · Vendors · Ask · Share** — one chapter on screen at a time (the stacked chapters read as an endless scroll in testing) | lanterns rise, then dim to 30 % |
| 4a | Overview | four glance cards — concepts, money, what's next, who to book — plus tips | quiet |
| 4b | Ideas | three concepts as magazine covers ("ISSUE Nº 01 — The Marigold Courtyard"), palette swatches | lanterns tint to the chosen palette |
| 4c | Budget | sliders + exact table + per-guest; contingency chip | **Budget Flow simulation**: particles = rupees, glass columns = categories, re-flow on slider drag |
| 4d | Timeline | one collapsible group per phase (the current one open), compact task rows with a calendar icon button, one banner when the schedule is compressed, .ics | quiet |
| 4e | Vendors | compact cards: book-by date, booked tick, "What to ask" disclosure, "Find real vendors in {city}" | quiet |
| 4f | Ask · Share | streamed Q&A; share link, private edit link, print, export | quiet |
| 9 | Footer | oversized wordmark, disclaimer | — |

## 6. 3D scenes (`src/three`, procedural geometry only, no model files)

- **Lantern field** — one `InstancedMesh` of glass spheres (transmission on desktop,
  matcap/standard on mobile) + one `InstancedMesh` of small emissive cores; sin/curl
  drift; damped camera dolly from scroll progress; pointer parallax; UnrealBloom on
  desktop only. Transparent canvas over a CSS dusk gradient (cheaper than a sky shader).
- **Confetti burst** — `InstancedMesh` of ~1,200 quads (≤ 400 on mobile), gravity +
  drag + spin, self-disposes after ~3 s. Fired once when a plan arrives.
- **Budget Flow** — K translucent columns (one per category) + N particles
  (600 desktop / 250 mobile). Targets from `layoutParticles`, motion from
  `stepParticles` (pure, tested). Dragging a slider moves only the delta particles.
  Hover/focus on a column highlights the matching table row. The canvas is
  `aria-hidden`; the table is the accessible source of truth.

## 7. Motion rules

- Ease `cubic-bezier(.2,.7,.2,1)` for reveals, 600–900 ms; micro-interactions 150–250 ms.
- DOM reveals use CSS `animation-timeline: view()` with an IntersectionObserver
  fallback class. Split-line headline reveals; magnetic primary buttons.
- `prefers-reduced-motion: reduce` → no canvas (static poster `public/poster.webp`,
  captured from the real scene), no parallax, instant reveals.
- Save-Data, `hardwareConcurrency ≤ 4` or WebGL unavailable → poster too.

## 8. Performance budget (verify before claiming)

- Landing JS excluding the 3D chunk ≤ 120 KB gzip; 3D chunk ≤ 180 KB gzip, loaded
  after first paint via `requestIdleCallback`.
- DPR clamp 1.75 desktop / 1.25 mobile; render loop paused when the tab is hidden
  or the canvas is off-screen; one draw call per instanced system.
- LCP < 2.5 s, CLS 0 on a mid-range phone profile; Lighthouse mobile ≥ 90 / 100 / 100 / 100.

## 9. Copy voice

Warm, witty, specific, never generic. Examples: "Made for moments. Built for
budgets." · "₹12,00,000, accounted for down to the last rupee." · "Your aunt will
still have opinions. Your spreadsheet won't." Plain-language errors that say what
happened and what to do next.
