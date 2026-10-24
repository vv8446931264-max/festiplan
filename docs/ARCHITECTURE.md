# FestiPlan — Architecture

```mermaid
flowchart LR
  U[Browser] -->|POST /api/plan| R[Route handlers<br/>src/app/api]
  R --> G[Guards<br/>src/lib/security<br/>same-origin · rate limit · byte cap · Zod strict]
  G --> S[Plan service<br/>src/lib/server]
  S --> A[AI layer<br/>src/lib/ai]
  A -->|JSON mode + schema| V[(Gemini on Vertex AI)]
  A -->|googleMaps tool| M[(Grounding with Google Maps)]
  A -.->|Zod fail twice / no backend| T[Templates<br/>src/lib/ai/templates]
  S --> E[Engine — pure TS<br/>src/lib/engine]
  S --> F[(Cloud Firestore<br/>plans/{id} · TTL)]
  U -->|GET /plan/id| P[RSC share page] --> F
```

**AI ideates, code calculates.** The model returns `AiPlan` (ideas, weights, task
list, vendor guidance). Every rupee, date, percentage and sort order comes from
`src/lib/engine`, which has no I/O and takes `today` as an argument.

## Contracts — `src/lib/contracts`

Single source of truth for types and Zod schemas: `PlanInput`, `PlanPatch`, `AiPlan`,
`Plan`, `PublicPlan`, `Allocation`, `ScheduledTask`, `VendorItem`, `VendorResult`, `Health`.
Dates are ISO `YYYY-MM-DD` strings; date maths is UTC-day arithmetic.

## Engine — `src/lib/engine` (pure, 100 % branch coverage)

| Module | Exports |
|---|---|
| `dates.ts` | `addDays(iso, n)`, `diffDays(from, to)`, `maxDate(a, b)`, `minDate(a, b)` |
| `budget.ts` | `largestRemainder(total, weights)`, `allocateBudget({ totalINR, weights, guests, contingencyPercent? })` → `{ contingencyINR, allocations }`, `rebalance(allocations, category, amountINR, { totalINR, guests })`, `setLocked(allocations, category, locked)`, `applyEdits(current, edits, ctx)` → `Allocation[] \| null`, `setActual(allocations, category, actualINR)`, `budgetVariance(allocations)`, `overspendAlerts(allocations, contingencyINR)`, `withDerived(allocations, totalINR, guests)` |
| `timeline.ts` | `topoSort(tasks)` → `AiTask[] \| null` (null on cycle), `phaseFor(due, eventDate)`, `scheduleTimeline(tasks, eventDate, today)`, `refreshStatus(timeline, today)`, `setTaskDone(timeline, id, done)` |
| `checklist.ts` | `scheduleVendors(vendors, eventDate, today)`, `setVendorDone(items, category, done)`, `progress(items)` → `{ done, total, percent }`, `nextActions(timeline, n = 3)`, `groupByPhase(timeline)` |
| `particles.ts` | `layoutParticles(allocations, n)` → counts per category (largest remainder); `assignParticles(prev, nextCounts)` moves only the delta particles; `targetsFor(assignment, layout)`; `createParticleState(n)`; `stepParticles(state, targets, dt)` critically-damped spring (dt clamped); `isSettled` |
| `ics.ts` | `escapeIcsText(s)`, `foldLine(line)`, `buildIcs({ planId, title, eventDate, city, tasks, url, dtstamp })` |
| `calendar-link.ts` | `googleCalendarUrl({ title, date, endDate?, details?, location? })` |
| `format.ts` | `formatINR(n)` → `₹12,00,000`, `formatINRCompact(n)` → `₹12L` / `₹1.2Cr`, `formatDate(iso)`, `formatPercent(n)`, `mapsSearchUrl(query)` |

Budget rules: contingency = `round(total × 10 %)`; the rest is split by
largest remainder so the parts plus contingency equal the total **exactly**.
`rebalance` keeps locked lines fixed and scales the unlocked others in
proportion, again with largest remainder, so the sum never drifts by a rupee.

Timeline rules: Kahn topological sort (stable; unknown deps ignored; a cycle drops
all dependencies). `start = max(event − leadWeeks·7, today, max(dep.due))`,
`due = min(start + durationDays, event)`, `crunch` when the ideal start had
passed, `overdue = !done && due < today`. Phases by days before the event:
0 day-of · ≤7 final-week · ≤28 2-4w · ≤91 1-3m · ≤182 3-6m · else 6m+.

## AI — `src/lib/ai`

| Module | Responsibility |
|---|---|
| `client.ts` | `getAi()` → `{ client, backend: "vertex" \| "gemini-api", model } \| null` from env (`GOOGLE_GENAI_USE_VERTEXAI` + ADC, else `GEMINI_API_KEY`, else null) |
| `prompts.ts` | system instruction + `briefBlock(input)` — user text only inside a delimited block marked as data |
| `schema.ts` | JSON `responseSchema` mirroring `AiPlanSchema` |
| `plan.ts` | `generateAiPlan(input)` → `{ ai, source, model }`: JSON mode, timeout, Zod parse → one corrective retry → template fallback |
| `templates/` | deterministic `AiPlan` per event type, labelled "Template plan — AI unavailable" in UI |
| `vendors.ts` | `findVendors({ city, category, eventType })` → `VendorResult`; only `groundingChunks[].maps` places; 24 h cache |
| `refine.ts` | `refineStream(plan, question)` → `ReadableStream<Uint8Array>` grounded in plan JSON; template answer when no backend |

## Server — `src/lib/server`, `src/lib/store`, `src/lib/security`

- `store/` — `PlanStore { create, get, update }` with `MemoryStore` (dev/test) and
  `FirestoreStore` (`new Firestore({ databaseId: FIRESTORE_DATABASE })`, collection `plans`).
- `security/` — `rateLimit(key, limit, windowMs)`, `readJson(req, maxBytes)`,
  `isSameOrigin(req)`, `newEditKey()` / `hashEditKey()` / `verifyEditKey()` (timing-safe), `clientIp(req)`.
- `server/plan-service.ts` — `createPlan(input, today)`, `patchPlan(id, editKey, patch, today)`, `toPublic(plan)`.
- `server/log.ts` — structured JSON logs for Cloud Logging (severity, route, status, latency; never user text).

## UI — `src/app`, `src/components`, `src/three`

- `/` — RSC landing chapters + `PlannerApp` client island (form → staged progress → plan).
- `/plan/[id]` — RSC share page; the plan is in the server HTML. Owners holding the edit key
  (stored in `localStorage`) get editable controls after hydration.
- `src/three/` — lantern field, confetti and budget-flow scenes; loaded with
  `next/dynamic({ ssr: false })`, gated by reduced motion / Save-Data / ≤ 4 cores / no WebGL
  (static poster captured from the real scene instead), paused when hidden or off-screen.
  Lanterns dim from 100 % to 30 % as you scroll into the working chapters. Glow is additive
  sprites rather than bloom (bloom does not composite over a transparent canvas and costs
  ~20 KB). Canvases are `aria-hidden`; the DOM holds every number.

## Process-wide state

Next.js bundles each route separately, so module-level singletons would be per-route.
`src/lib/server/singleton.ts` keeps the plan store on `globalThis` so the API and the
share page see the same in-memory store in dev/test (production uses Firestore).
Plan edits go through `PlanStore.mutate` — a Firestore transaction in production — so
two phones ticking different items at the same moment never overwrite each other.

## Runtime dependencies

| Package | Why |
|---|---|
| `next`, `react`, `react-dom` | framework |
| `zod` | request and AI-output validation |
| `@google/genai` | Gemini on Vertex AI (ADC) and Maps grounding |
| `@google-cloud/firestore` | plan persistence with TTL |
| `three` | lazy-loaded WebGL scenes |
