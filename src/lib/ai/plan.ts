import { createHash } from "node:crypto";
import type { Content } from "@google/genai";
import { AiPlanSchema } from "@/lib/contracts";
import type { AiPlan, PlanInput, PlanSource } from "@/lib/contracts";
import { logEvent } from "@/lib/server/log";
import { TtlCache } from "./cache";
import { getAi, thinkingFor } from "./client";
import type { AiHandle } from "./client";
import { SYSTEM_PLAN, briefBlock } from "./prompts";
import { AI_PLAN_JSON_SCHEMA } from "./schema";
import { templatePlan } from "./templates";

/** What `generateAiPlan` resolves to. `attempts` counts model calls (0 = cache hit or no backend). */
export type AiPlanResult = { ai: AiPlan; source: PlanSource; model: string; attempts: number };

/** Injectable dependencies (tests pass a fake client and a private cache). */
export type PlanDeps = {
  /** Gemini handle; `null` forces template mode; omitted → `getAi()`. */
  ai?: AiHandle | null;
  /** Overall deadline for both attempts, in milliseconds. */
  timeoutMs?: number;
  /** ISO date used to tell the model how many weeks away the event is. */
  today?: string;
  /** Result cache; `null` disables caching; omitted → the shared process cache. */
  cache?: TtlCache<AiPlan> | null;
};

export const PLAN_TIMEOUT_MS = 25_000;
const sharedCache = new TtlCache<AiPlan>(50, 60 * 60 * 1000);

/** Empties the shared plan cache (tests and admin use). */
export function clearPlanCache(): void {
  sharedCache.clear();
}

/** Stable cache key: SHA-256 of the whitespace-normalised input, model and lead time. */
export function planCacheKey(input: PlanInput, model: string, weeksAway?: number): string {
  const squash = (s: string) => s.trim().replace(/\s+/g, " ");
  const normalised = [
    input.eventType,
    squash(input.title ?? ""),
    input.eventDate,
    squash(input.city).toLowerCase(),
    input.guests,
    input.budgetINR,
    squash(input.vibe),
    input.constraints.map((c) => squash(c).toLowerCase()).sort(),
    input.language,
    model,
    weeksAway ?? null,
  ];
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}

/** Whole weeks from `today` to `eventDate` (both ISO dates), never negative. */
export function weeksUntil(eventDate: string, today: string): number {
  const days = (Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(days) ? Math.max(0, Math.floor(days / 7)) : 0;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Drops `dependsOn` entries that do not name another task in the list (and self-references),
 * de-duplicates them and keeps at most five. Works on raw model output before Zod parsing.
 */
export function sanitizeDependsOn(raw: unknown): unknown {
  if (!isRecord(raw) || !Array.isArray(raw.tasks)) return raw;
  const ids = new Set(raw.tasks.filter(isRecord).map((t) => t.id).filter((id) => typeof id === "string"));
  const tasks = raw.tasks.map((t) => {
    if (!isRecord(t) || !Array.isArray(t.dependsOn)) return t;
    const deps = t.dependsOn.filter((d): d is string => typeof d === "string" && d !== t.id && ids.has(d));
    return { ...t, dependsOn: [...new Set(deps)].slice(0, 5) };
  });
  return { ...raw, tasks };
}

/** Parses and validates model text into an `AiPlan`, or returns a short error summary. */
export function parseAiPlan(text: string | undefined): { ok: true; ai: AiPlan } | { ok: false; error: string } {
  const body = (text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!body) return { ok: false, error: "The reply was empty." };
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return { ok: false, error: "The reply was not valid JSON." };
  }
  const parsed = AiPlanSchema.safeParse(sanitizeDependsOn(raw));
  if (parsed.success) return { ok: true, ai: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 12)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
  return { ok: false, error: issues.join("; ") };
}

function correction(error: string): string {
  return `Your previous reply failed validation: ${error.slice(0, 1500)}\nReply again with the complete corrected JSON object only. Keep exactly 3 ideas, 12 to 30 tasks with unique kebab-case ids, unique categories, and no rupee amounts or dates.`;
}

async function callModel(handle: AiHandle, contents: Content[], signal: AbortSignal): Promise<string | undefined> {
  const res = await handle.client.models.generateContent({
    model: handle.model,
    contents,
    config: {
      systemInstruction: SYSTEM_PLAN,
      responseMimeType: "application/json",
      responseJsonSchema: AI_PLAN_JSON_SCHEMA,
      thinkingConfig: thinkingFor(handle.model),
      maxOutputTokens: 8192,
      abortSignal: signal,
    },
  });
  return res.text;
}

type Run = { ai: AiPlan | null; attempts: number; reason: string };

async function runAttempts(handle: AiHandle, prompt: string, timeoutMs: number): Promise<Run> {
  const signal = AbortSignal.timeout(timeoutMs);
  const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];
  let reason = "invalid";
  for (let attempt = 1; attempt <= 2; attempt++) {
    let text: string | undefined;
    try {
      text = await callModel(handle, contents, signal);
    } catch (err) {
      return { ai: null, attempts: attempt, reason: err instanceof Error ? err.name : "error" };
    }
    const parsed = parseAiPlan(text);
    if (parsed.ok) return { ai: parsed.ai, attempts: attempt, reason: "" };
    reason = "invalid";
    if (text?.trim()) contents.push({ role: "model", parts: [{ text: text.slice(0, 30_000) }] });
    contents.push({ role: "user", parts: [{ text: correction(parsed.error) }] });
  }
  return { ai: null, attempts: 2, reason };
}

/**
 * Asks Gemini for an `AiPlan` (JSON mode + schema, timeout), validates it with Zod,
 * retries once with the validation errors, and falls back to a deterministic template.
 */
export async function generateAiPlan(input: PlanInput, deps: PlanDeps = {}): Promise<AiPlanResult> {
  const handle = deps.ai === undefined ? getAi() : deps.ai;
  if (!handle) return { ai: templatePlan(input), source: "template", model: "template", attempts: 0 };
  const weeks = deps.today ? weeksUntil(input.eventDate, deps.today) : undefined;
  const cache = deps.cache === undefined ? sharedCache : deps.cache;
  const key = planCacheKey(input, handle.model, weeks);
  const hit = cache?.get(key);
  if (hit) return { ai: hit, source: "gemini", model: handle.model, attempts: 0 };
  const run = await runAttempts(handle, briefBlock(input, weeks), deps.timeoutMs ?? PLAN_TIMEOUT_MS);
  if (run.ai) {
    cache?.set(key, run.ai);
    return { ai: run.ai, source: "gemini", model: handle.model, attempts: run.attempts };
  }
  logEvent({ severity: "WARNING", message: "ai_plan_fallback", reason: run.reason, attempts: run.attempts, model: handle.model });
  return { ai: templatePlan(input), source: "template", model: "template", attempts: run.attempts };
}
