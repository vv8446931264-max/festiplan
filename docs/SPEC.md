# FestiPlan — Product Spec

> **Made for moments. Built for budgets.**

## 1. Problem statement (verbatim)

> **[Challenge 5] Celebration & Event Planner** — Create a GenAI-powered planning
> assistant that helps users organize weddings, birthdays, and community events with
> budgets, timelines, vendor checklists, and personalized ideas.

## 2. Requirement → feature map (every row must ship and be demoable)

| Statement phrase | Feature | Where the logic lives |
|---|---|---|
| GenAI-powered planning assistant | Gemini turns a free-text brief into a structured plan; "Ask FestiPlan" refines it in conversation | `src/lib/ai/plan.ts`, `src/lib/ai/refine.ts` |
| weddings | Wedding mode: multi-function events (haldi, mehendi, sangeet, pheras, reception), family roles, muhurat-aware date notes | prompt + `templates/wedding` |
| birthdays | Birthday mode: age-aware themes, kids/adult splits, return gifts | prompt + `templates/birthday` |
| community events | Community mode: festivals, society melas, fundraisers, volunteer roles, permits, sponsor tiers | prompt + `templates/community` |
| budgets | Exact rupee allocation across categories, 10% contingency, per-guest cost, live re-balancing sliders, planned-vs-actual tracker, overspend alerts | `src/lib/engine/budget.ts` |
| timelines | Tasks scheduled backwards from the event date with dependencies, phases, overdue/crunch detection, Google Calendar links and `.ics` export | `src/lib/engine/timeline.ts`, `ics.ts` |
| vendor checklists | Per-category checklist: book-by date, questions to ask, red flags, tick-off state saved; real nearby vendors via Gemini + Grounding with Google Maps | `src/lib/engine/checklist.ts`, `src/lib/ai/vendors.ts` |
| personalized ideas | Three distinct concepts (name, palette, décor, food, music, signature moment) shaped by vibe, culture, constraints, language | `src/lib/ai/plan.ts` |

Everything lives behind **one entry point** (`/`): brief → plan unfolds in place.
`/plan/[id]` is the server-rendered, shareable view of the same plan.

## 3. Personas

- **Priya, 27, Jaipur** — planning her sister's sangeet for 180 guests on ₹12 lakh;
  family spread across cities; wants it to feel personal, not Pinterest-generic.
- **Rahul, 35, Bengaluru** — his son's 7th birthday, dinosaur theme, 30 kids, ₹40,000;
  has two weekends to pull it off.
- **Meera, 52, Pune** — housing-society Diwali mela, 400 residents, ₹2.5 lakh pooled
  funds, volunteers, a stage and food stalls; must report spending to the committee.

The three demo presets are exactly these briefs (one per event type).

## 4. Demo win-condition (the 30-second judge test)

The judge opens the URL and glass lanterns drift in a dusk sky. They tap
**"Priya's sangeet · Jaipur · 180 guests · ₹12L"**. A staged progress line runs
("Reading the vibe → Drafting concepts → Balancing ₹ → Counting back from the date →
Listing who to book"), confetti bursts, and the plan unfolds: three named concepts,
₹12,00,000 split exactly across categories with per-guest cost, a dated timeline
counting back from the event, a vendor checklist, and real Jaipur venues/caterers
with Google Maps links. They drag the décor slider: particles re-flow between glass
budget columns instantly, numbers update, no AI call. They tick two checklist items,
hit **Share**, open the link on a phone: same plan, server-rendered, read-only.

## 5. Data model

```ts
type EventType = "wedding" | "birthday" | "community" | "other";
type Lang = "en" | "hi" | "bn" | "ta" | "te" | "mr" | "kn" | "gu";
type BudgetCategory = "venue" | "catering" | "decor" | "photography" | "entertainment"
  | "attire" | "invitations" | "gifts" | "transport" | "misc";

/** Validated request body for POST /api/plan (Zod .strict(), ≤ 8 KB). */
type PlanInput = {
  eventType: EventType;
  title?: string;          // ≤ 80 chars, e.g. "Riya & Arjun's sangeet"
  eventDate: string;       // ISO date; tomorrow … +3 years
  city: string;            // 2–60 chars
  guests: number;          // integer 1–5000
  budgetINR: number;       // integer 1,000 – 50,00,00,000
  vibe: string;            // ≤ 600 chars: themes, traditions, must-haves
  constraints: string[];   // ≤ 10 tags: dietary, accessibility, cultural, eco
  language: Lang;
};

/** The ONLY thing the model returns (responseSchema + Zod). No numbers it must add up. */
type AiPlan = {
  summary: string;                                   // ≤ 280 chars
  ideas: Array<{ name: string; concept: string; palette: string[] /* hex */;
    decor: string[]; food: string[]; music: string; signatureMoment: string }>; // exactly 3
  budgetWeights: Array<{ category: BudgetCategory; weight: number /* 1–100 */; rationale: string }>;
  tasks: Array<{ id: string; title: string; category: BudgetCategory | "admin";
    leadWeeks: number /* weeks before event to start */; durationDays: number; dependsOn: string[] }>; // 12–30
  vendors: Array<{ category: BudgetCategory; bookByWeeks: number; questions: string[]; redFlags: string[] }>;
  tips: Array<{ kind: "sustainability" | "accessibility" | "culture" | "savings"; text: string }>;
};

/** Computed by code from AiPlan + PlanInput. Persisted in Firestore `plans/{id}` in the named
 *  Native-mode database `FIRESTORE_DATABASE` (= "festiplan"): `new Firestore({ databaseId })`. */
type Plan = {
  id: string; input: PlanInput; ai: AiPlan;
  budget: Allocation[]; timeline: ScheduledTask[];
  source: "gemini" | "template"; model: string;
  createdAt: string; expireAt: Date /* Firestore TTL, +180 days */;
  editKeyHash: string;     // SHA-256 of the edit key; key itself is returned once
};
type Allocation = { category: BudgetCategory; amountINR: number; percent: number;
  perGuestINR: number; rationale: string; locked: boolean; actualINR: number | null };
type ScheduledTask = { id: string; title: string; category: string; start: string; due: string;
  phase: "6m+" | "3-6m" | "1-3m" | "2-4w" | "final-week" | "day-of"; done: boolean; overdue: boolean };
```

## 6. Deterministic engines (`src/lib/engine`, pure, 100% branch-tested)

- **budget** — normalise weights; reserve contingency (default 10%); allocate integer
  rupees with the largest-remainder method so parts sum exactly to the total;
  per-guest cost; re-balance when one category is changed or locked (others scale
  proportionally, locked ones fixed); planned-vs-actual variance; overspend alerts.
- **timeline** — topological sort of tasks (cycle → reject & fall back), schedule
  backwards from `eventDate` using `leadWeeks`/`durationDays`, never before `today`,
  mark `overdue`/crunch, bucket into phases, sort stable. When the event is closer than
  the longest ideal lead time, all lead times and durations are compressed by the same
  factor (`available days / ideal days`), so steps spread over the time left in their
  original order; only `leadWeeks = 0` tasks fall on the event day. `scheduleCompression`
  reports `{ compressed, factor, availableDays, idealDays }` so the UI can state it once.
- **checklist** — vendor book-by dates (compressed by the same proportional factor,
  never later than the day before the event), progress %, next three actionable items,
  by-category grouping.
- **particles** — `layoutParticles(allocations, n)` (largest remainder of n particles
  across categories) and `stepParticles(state, targets, dt)` spring integration
  for the budget simulation — pure so it is unit-testable.
- **ics** — RFC 5545 VCALENDAR with escaping and 75-octet line folding.
- **calendar-link** — Google Calendar "TEMPLATE" URLs per milestone.
- **format** — `Intl.NumberFormat("en-IN")` rupees (₹12,00,000), lakh/crore labels.

## 7. AI contracts (`src/lib/ai`)

- **client** — `@google/genai`. `GOOGLE_GENAI_USE_VERTEXAI=true` → Vertex AI via ADC
  (production, no key). Else `GEMINI_API_KEY` (dev). Else `null` → template mode.
  Model from `GEMINI_MODEL`. `/api/health` reports which backend is live.
- **plan** — system prompt (role, Indian celebration context, cultural sensitivity,
  no arithmetic, never name vendors, answer in `language`), user brief in a
  delimited data block, JSON mode with `responseSchema`, low thinking budget for
  latency, `AbortSignal.timeout`. Zod parse → one retry with the validation error →
  template fallback labelled "Template plan — AI unavailable".
- **vendors** — Gemini with the `googleMaps` grounding tool for `{category} in {city}`,
  where city and event type come from a **stored plan** (the endpoint takes `{ planId, category }`,
  so it is not an open proxy). Render **only** places from
  `groundingMetadata.groundingChunks` (title + Maps URI). No chunks → a plain Google Maps
  search link. Cached 24 h per (city, category, event type).
- **refine** — "Ask FestiPlan": streaming answer grounded in the stored plan JSON
  (e.g. "make it zero-waste", "cut 20% — where?"). Suggestions only; the user
  applies budget changes with the sliders so numbers stay deterministic.

## 8. API

| Route | Method | Purpose | Guards |
|---|---|---|---|
| `/api/plan` | POST | generate + store plan, returns `{ plan, editKey }` | 5/min/IP, global AI cap, 8 KB cap, Zod strict, same-origin |
| `/api/plan/[id]` | GET / PATCH | public plan; checklist state, actuals, locked/adjusted allocations (one transaction) | `x-edit-key` (timing-safe hash compare), Zod strict, same-origin |
| `/api/plan/[id]/refine` | POST | streaming Ask FestiPlan | 10/min/IP, global AI cap, 2 KB cap, same-origin |
| `/api/vendors` | POST | `{ planId, category }` → Maps-grounded vendors | 10/min/IP, global AI cap, 1 KB cap, plan must exist, cache 24 h |
| `/plan/[id]/calendar.ics` | GET | timeline export | read-only |
| `/api/health` | GET | `{ status, ai: "vertex"|"gemini-api"|"template", store: "firestore"|"memory", model }` | none |

## 9. Google services (each one functional, none decorative)

| Service | Used for |
|---|---|
| Gemini on Vertex AI | structured plan generation (JSON mode + schema), streaming refine |
| Grounding with Google Maps (Vertex AI) | real nearby vendors with Maps links |
| Cloud Firestore | saved, shareable plans; checklist and actuals; TTL expiry |
| Cloud Run | hosting; ADC identity, no API keys in production |
| Cloud Build + Artifact Registry | source deploys from GitHub Actions via Workload Identity Federation |
| Google Calendar | per-milestone "Add to Google Calendar" links |
| Cloud Logging | structured JSON logs (severity, request id, latency; no user text) |
| Google Fonts | self-hosted at build time via `next/font` |

## 10. Non-goals today

Accounts/login, payments, vendor booking, guest RSVP management, native apps.
(Share link + edit key covers collaboration without accounts.)
