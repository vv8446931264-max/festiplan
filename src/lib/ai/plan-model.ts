import { FinishReason } from "@google/genai";
import type { Content } from "@google/genai";
import type { AiPlan, Lang } from "@/lib/contracts";
import { thinkingFor } from "./client";
import type { AiHandle, AiResponse, AiUsage } from "./client";
import { parseAiPlan } from "./plan-parse";
import { SYSTEM_PLAN } from "./prompts";
import { AI_PLAN_JSON_SCHEMA } from "./schema";

/** Ceiling for any plan call, including the larger retry after a cut-off reply. */
export const MAX_PLAN_TOKENS = 24_576;

/** Appended to the brief when the previous reply hit the token limit (the cut-off text is not resent). */
export const CONCISE_NOTE =
  "Your previous reply was too long and was cut off. Reply again with the complete JSON object only, and keep it concise: short sentences, list lengths near the minimum, no repetition.";

/** First-attempt output budget: Indian-language scripts take roughly twice the tokens of English. */
export function planTokenBudget(lang: Lang): number {
  return lang === "en" ? 8192 : 16_384;
}

/** The budget for the retry after a cut-off reply: ×1.5, capped at `MAX_PLAN_TOKENS`. */
export function raisedBudget(budget: number): number {
  return Math.min(MAX_PLAN_TOKENS, Math.ceil(budget * 1.5));
}

/** True when Gemini stopped because it reached `maxOutputTokens`, so the JSON is incomplete. */
export function isTruncated(res: AiResponse): boolean {
  return res.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS;
}

/** Token counts summed over every attempt of one plan request (numbers only, safe to log). */
export type TokenTotals = Required<AiUsage>;

const NO_TOKENS: TokenTotals = {
  promptTokenCount: 0,
  candidatesTokenCount: 0,
  thoughtsTokenCount: 0,
};

/** Adds one reply's `usageMetadata` to the running totals; missing counts add 0. */
export function addUsage(total: TokenTotals, usage: AiUsage | undefined): TokenTotals {
  return {
    promptTokenCount: total.promptTokenCount + (usage?.promptTokenCount ?? 0),
    candidatesTokenCount: total.candidatesTokenCount + (usage?.candidatesTokenCount ?? 0),
    thoughtsTokenCount: total.thoughtsTokenCount + (usage?.thoughtsTokenCount ?? 0),
  };
}

function correction(error: string): string {
  return `Your previous reply failed validation: ${error.slice(0, 1500)}\nReply again with the complete corrected JSON object only. Keep exactly 3 ideas, 12 to 30 tasks with unique kebab-case ids, unique categories, and no rupee amounts or dates.`;
}

type Step = { contents: Content[]; budget: number; reason: string };

/** The next request after an invalid reply: a concise re-ask with a bigger budget when cut off, else a correction turn. */
function nextStep(prompt: string, step: Step, res: AiResponse, error: string): Step {
  if (isTruncated(res)) {
    const contents: Content[] = [
      { role: "user", parts: [{ text: prompt }, { text: CONCISE_NOTE }] },
    ];
    return { contents, budget: raisedBudget(step.budget), reason: "max_tokens" };
  }
  const text = res.text?.trim() ? res.text.slice(0, 30_000) : "";
  const echo: Content[] = text ? [{ role: "model", parts: [{ text }] }] : [];
  const fix: Content = { role: "user", parts: [{ text: correction(error) }] };
  return { contents: [...step.contents, ...echo, fix], budget: step.budget, reason: "invalid" };
}

async function callModel(handle: AiHandle, step: Step, signal: AbortSignal): Promise<AiResponse> {
  return handle.client.models.generateContent({
    model: handle.model,
    contents: step.contents,
    config: {
      systemInstruction: SYSTEM_PLAN,
      responseMimeType: "application/json",
      responseJsonSchema: AI_PLAN_JSON_SCHEMA,
      thinkingConfig: thinkingFor(handle.model),
      maxOutputTokens: step.budget,
      abortSignal: signal,
    },
  });
}

/** Outcome of the model attempts: the plan (or null), calls made, why it failed, and token totals. */
export type Run = { ai: AiPlan | null; attempts: number; reason: string; usage: TokenTotals };

/**
 * At most two model calls under one deadline. An invalid reply gets one self-correcting
 * retry; a reply cut off at the token limit is not echoed back — the brief is asked again
 * with a 1.5× budget and a note to be concise. A thrown call (timeout, network) is final.
 */
export async function runAttempts(
  handle: AiHandle,
  prompt: string,
  opts: { lang: Lang; timeoutMs: number },
): Promise<Run> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let step: Step = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    budget: planTokenBudget(opts.lang),
    reason: "invalid",
  };
  let usage = NO_TOKENS;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: AiResponse;
    try {
      res = await callModel(handle, step, signal);
    } catch (err) {
      return {
        ai: null,
        attempts: attempt,
        reason: err instanceof Error ? err.name : "error",
        usage,
      };
    }
    usage = addUsage(usage, res.usageMetadata);
    const parsed = parseAiPlan(res.text);
    if (parsed.ok) return { ai: parsed.ai, attempts: attempt, reason: "", usage };
    step = nextStep(prompt, step, res, parsed.error);
  }
  return { ai: null, attempts: 2, reason: step.reason, usage };
}
