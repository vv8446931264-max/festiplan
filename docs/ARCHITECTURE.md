# FestiPlan — Architecture

```mermaid
flowchart LR
  U[Browser] -->|every page| X[src/proxy.ts<br/>per-request nonce CSP]
  U -->|POST /api/plan| R[Route handlers<br/>src/app/api]
  R --> G[Guards<br/>src/lib/security<br/>same-origin · rate limit · byte cap · Zod strict]
  G --> S[Plan service<br/>src/lib/server]
  S --> A[AI layer<br/>src/lib/ai]
  A -->|JSON mode + schema| V[(Gemini on Vertex AI)]
  A -->|googleMaps tool| M[(Grounding with Google Maps)]
  A -.->|Zod fail twice / no backend| T[Templates<br/>src/lib/ai/templates]
  S --> E[Engine — pure TS<br/>src/lib/engine]
  S --> F[(Cloud Firestore<br/>plans/{id} · TTL)]
  X -->|GET /plan/id| P[RSC share page] --> F
```

**AI ideates, code calculates.** The model returns `AiPlan` (ideas, weights, task
list, vendor guidance). Every rupee, date, percentage and sort order comes from
`src/lib/engine`, which has no I/O and takes `today` as an argument.

## Contracts — `src/lib/contracts`

Single source of truth for types and Zod schemas: `PlanInput`, `PlanPatch`, `AiPlan`,
`Plan`, `PublicPlan`, `Allocation`, `ScheduledTask`, `VendorItem`, `VendorQuery`,
`VendorResult`, `Health`, plus `PLAN_ID_RE` (the plan-id shape shared by routes and schemas).
Dates are ISO `YYYY-MM-DD` strings; date maths is UTC-day arithmetic.

`VendorQuery` (body of `POST /api/vendors`) is `{ planId, category }`, a strict object.
The lookup is bound to a stored plan: the route reads the city and event type from
that plan (404 when it does not exist), so the endpoint is never an open Maps search.

## Engine — `src/lib/engine` (pure, 100 % branch coverage)

| Module | Exports |
|---|---|
| `dates.ts` | `addDays(iso, n)`, `diffDays(from, to)`, `maxDate(a, b)`, `minDate(a, b)` |
| `largest-remainder.ts` | `largestRemainder(total, weights)` → whole-rupee parts that always sum to `total` (also used for particle counts) |
| `budget.ts` | `allocateBudget({ totalINR, weights, guests, contingencyPercent? })` → `{ contingencyINR, allocations }`, `withDerived(allocations, totalINR, guests)` |
| `budget-edit.ts` | `rebalance(allocations, category, amountINR, { totalINR, guests })`, `setLocked(allocations, category, locked)`, `setActual(allocations, category, actualINR)`, `applyEdits(current, edits, ctx)` → `Allocation[] \| null` |
| `budget-variance.ts` | `budgetVariance(allocations)`, `overspendAlerts(allocations, contingencyINR)` |
| `compression.ts` | `compressionFactor(idealSpanDays, availableDays)` → `1` when the span fits, else `available / ideal`; `scheduleCompression(tasks, eventDate, today)` → `{ compressed, factor, availableDays, idealDays }` (for one honest "compressed" banner); `compressedLeadDays(leadWeeks, factor)` |
| `timeline.ts` | `topoSort(tasks)` → `AiTask[] \| null` (null on cycle), `phaseFor(due, eventDate)`, `scheduleTimeline(tasks, eventDate, today)` (proportional compression), `refreshStatus(timeline, today)`, `setTaskDone(timeline, id, done)` |
| `checklist.ts` | `scheduleVendors(vendors, eventDate, today)` (same compression for `bookBy`), `setVendorDone(items, category, done)`, `progress(items)` → `{ done, total, percent }`, `nextActions(timeline, n = 3)`, `groupByPhase(timeline)` |
| `particles.ts` | `layoutParticles(allocations, n)` → counts per category (largest remainder); `assignParticles(prev, nextCounts)` moves only the delta particles; re-exports `particle-targets.ts` (`targetsFor(assignment, layout)`, column geometry) and `particle-spring.ts` (`createParticleState(n)`, `stepParticles(state, targets, dt)` critically-damped spring with dt clamped, `isSettled`) |
| `ics.ts` | `escapeIcsText(s)`, `foldLine(line)`, `buildIcs({ planId, title, eventDate, city, tasks, url, dtstamp })` |
| `calendar-link.ts` | `googleCalendarUrl({ title, date, endDate?, details?, location? })` |
| `format.ts` | `formatINR(n)` → `₹12,00,000`, `formatINRCompact(n)` → `₹12L` / `₹1.2Cr`, `formatDate(iso)`, `formatDateShort(iso)`, `formatPercent(n)`, `planTitle(input)`, `mapsSearchUrl(query)` |

Budget rules: contingency = `round(total × 10 %)`; the rest is split by
largest remainder so the parts plus contingency equal the total **exactly**.
`rebalance` keeps locked lines fixed and scales the unlocked others in
proportion, again with largest remainder, so the sum never drifts by a rupee.

Timeline rules: Kahn topological sort (stable; unknown deps ignored; a cycle drops
all dependencies). **Proportional compression:** `idealSpan = max(leadWeeks)·7` and
`available = days from today to the event`; `f = compressionFactor(idealSpan, available)`
is 1 when the span fits, else `available / idealSpan`, so a plan that needs 26 weeks and
has 12 days has every lead time and duration scaled by the same `f` and spreads over
those 12 days in its original order. `leadDays = round(leadWeeks·7·f)` (at least 1 for
`leadWeeks ≥ 1`), `start = max(event − leadDays, today, max(dep.due))`,
`due = start + max(1, round(durationDays·f))`, capped at the day before the event for
`leadWeeks ≥ 1` (only `leadWeeks = 0` tasks fall on the event day) and never before
`start`. `crunch` when the uncompressed ideal start (`event − leadWeeks·7`) had already
passed; `overdue = !done && due < today`. Vendor `bookBy` uses the same factor over
`bookByWeeks` and is `max(today, event − round(bookByWeeks·7·f))`, at the latest the day
before the event. Phases by days before the event:
0 day-of · ≤7 final-week · ≤28 2-4w · ≤91 1-3m · ≤182 3-6m · else 6m+.

## AI — `src/lib/ai`

| Module | Responsibility |
|---|---|
| `client.ts` | `getAi()` → `{ client, backend: "vertex" \| "gemini-api", model } \| null` from env (`GOOGLE_GENAI_USE_VERTEXAI` + ADC, else `GEMINI_API_KEY`, else null); `thinkingFor(model)` |
| `prompts.ts` | system instruction + `briefBlock(input)` — user text only inside a delimited block marked as data |
| `schema.ts` | JSON `responseSchema` mirroring `AiPlanSchema` |
| `plan.ts` | `generateAiPlan(input)` → `{ ai, source, model, attempts }`: cache → model attempts → template fallback; logs token counts (`promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`), never text |
| `plan-model.ts` | `runAttempts(handle, prompt, { lang, timeoutMs })`: JSON mode + schema under one deadline, `maxOutputTokens` 8192 (English) / 16384 (other languages). A Zod failure gets one corrective retry. A reply with `finishReason: MAX_TOKENS` is not echoed back: the brief is asked again with ×1.5 budget (cap 24576) and a note to be concise |
| `plan-parse.ts` | `parseAiPlan(text)` (fence-tolerant JSON → `AiPlanSchema`), `sanitizeDependsOn(raw)` |
| `templates/` | `templatePlan(input)` → deterministic `AiPlan`, labelled "Template plan — AI unavailable" in UI; one folder per event type (`wedding/`, `birthday/`, `community/`, `other/`) holding typed `ideas`, `tasks` and `guidance` data |
| `vendors.ts` | `findVendors({ city, category, eventType })` → `VendorResult` (the route fills city and event type from the plan); only `groundingChunks[].maps` places; 24 h cache |
| `refine.ts` | `refineStream(plan, question)` → `ReadableStream<Uint8Array>` grounded in plan JSON; template answer when no backend |

## Server — `src/lib/server`, `src/lib/store`, `src/lib/security`

- `store/` — `PlanStore { create, get, mutate }` with `MemoryStore` (dev/test) and
  `FirestoreStore` (`new Firestore({ databaseId: FIRESTORE_DATABASE })`, collection `plans`).
  There is no blind overwrite: every change is `mutate(id, fn)`, where `fn(plan | null)`
  returns `{ next, result }` and `next === null` means write nothing (a Firestore transaction
  in production).
- `security/` — `rateLimit(key, limit, windowMs)`, `readJson(req, maxBytes)`,
  `isSameOrigin(req)`, `newEditKey()` / `hashEditKey()` / `verifyEditKey()` (timing-safe),
  `clientIp(req)` and `clientKey(req)` (the IPv4 address, or the IPv6 /64 network),
  `newNonce()` / `contentSecurityPolicy(nonce)`.
- `server/http.ts` — response helpers and guards: `readBody(req, maxBytes, schema)` (byte cap +
  strict Zod in one step; 400/413/415, or 400 with `issues`), `sameOrigin`,
  `perIpLimit(name, n)` (429), `aiGlobalLimit` (120 AI-backed requests per instance per minute
  × `RATE_LIMIT_SCALE`, 503 + `Retry-After`; checked by plan, refine and vendors after
  validation), `runGuards`, `withRoute` (request id, access log, plain 500).
- `server/plan-service.ts` — `createPlan(input, today)`, `getPublicPlan(id, today)`,
  `patchPlan(id, editKey, patch, today)`, `toPublic(plan)`, and `PLAN_NOT_FOUND`, the one 404
  message every route uses.
- `server/plan-patch.ts` — `applyPatch(plan, patch)` → `{ ok: true, plan }` or a 422
  `PatchRejection`: the pure edit logic, run inside the store transaction.
- `time.ts` — `todayIST()`, `dtstamp()`, `DAY_MS` (the single copy for server and AI code).
- `server/log.ts` — structured JSON logs for Cloud Logging (severity, route, status, latency; never user text).

## Proxy and CSP — `src/proxy.ts`

Runs before every page (the matcher skips `/api`, `_next/static`, `_next/image`, icons and
router prefetches). It mints a 128-bit nonce, sets `Content-Security-Policy` on the request,
where Next.js reads the nonce and stamps it on its own scripts, and on the response. Scripts
need the nonce (`'strict-dynamic'` covers the lazy WebGL chunks those scripts load), so there
is no `'unsafe-inline'` for scripts. The root layout calls `connection()`, which renders every
page per request; a prerendered page would ship scripts without a nonce. The other hardening
headers stay static in `next.config.ts`, and API responses get `default-src 'none'`.

## UI — `src/app`, `src/components`, `src/three`

- `/` — RSC landing chapters + `PlannerApp` client island (form → staged progress → plan).
- `/plan/[id]` — RSC share page; the plan is in the server HTML. Owners holding the edit key
  (stored in `localStorage`) get editable controls after hydration.
- `src/components/plan/` — `PlanView` renders the header, a WAI-ARIA tab bar (`tabs.ts`,
  `useActiveTab.ts`: roving tabindex, arrow/Home/End keys, synced with the URL hash) and one
  panel per tab from `chapters.tsx`, where each memoised chapter receives only its slice of
  the plan. State lives in `usePlanState` (a pure reducer plus debounced, retried autosave);
  `useAsk` and `useShare` hold the streaming answer and the share links.
- `src/three/` — lantern field (`lantern-scene.ts`, with `lanterns.ts`, `lantern-systems.ts`
  and `lantern-tints.ts`), confetti, and the budget flow (`budget-flow-scene.ts` +
  `budget-flow-layout.ts`; `emphasis.ts` is the lit/dimmed rule shared with its SVG
  fallback). Scenes are loaded with
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
