import { createHash } from "node:crypto";
import type { AiPlan, PlanInput, PlanSource } from "@/lib/contracts";
import { diffDays } from "@/lib/engine";
import { logEvent } from "@/lib/server/log";
import { TtlCache } from "./cache";
import { getAi } from "./client";
import type { AiHandle } from "./client";
import { runAttempts } from "./plan-model";
import { briefBlock } from "./prompts";
import { templatePlan } from "./templates";

export { parseAiPlan, sanitizeDependsOn } from "./plan-parse";

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

/** Deadline for both attempts together; Cloud Run allows 90 s per request. */
export const PLAN_TIMEOUT_MS = 50_000;
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
  const days = diffDays(today, eventDate);
  return Number.isFinite(days) ? Math.max(0, Math.floor(days / 7)) : 0;
}

/**
 * Asks Gemini for an `AiPlan` (JSON mode + schema, timeout), validates it with Zod,
 * retries once (with the validation errors, or more room when the reply was cut off),
 * and falls back to a deterministic template. Logs token counts, never text.
 */
export async function generateAiPlan(input: PlanInput, deps: PlanDeps = {}): Promise<AiPlanResult> {
  const handle = deps.ai === undefined ? getAi() : deps.ai;
  if (!handle)
    return { ai: templatePlan(input), source: "template", model: "template", attempts: 0 };
  const weeks = deps.today ? weeksUntil(input.eventDate, deps.today) : undefined;
  const cache = deps.cache === undefined ? sharedCache : deps.cache;
  const key = planCacheKey(input, handle.model, weeks);
  const hit = cache?.get(key);
  if (hit) return { ai: hit, source: "gemini", model: handle.model, attempts: 0 };
  const timeoutMs = deps.timeoutMs ?? PLAN_TIMEOUT_MS;
  const run = await runAttempts(handle, briefBlock(input, weeks), {
    lang: input.language,
    timeoutMs,
  });
  const fields = { attempts: run.attempts, model: handle.model, ...run.usage };
  if (run.ai) {
    cache?.set(key, run.ai);
    logEvent({ severity: "INFO", message: "ai_plan", ...fields });
    return { ai: run.ai, source: "gemini", model: handle.model, attempts: run.attempts };
  }
  logEvent({ severity: "WARNING", message: "ai_plan_fallback", reason: run.reason, ...fields });
  return { ai: templatePlan(input), source: "template", model: "template", attempts: run.attempts };
}
