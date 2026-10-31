// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FinishReason } from "@google/genai";
import type { AiResponse } from "@/lib/ai/client";
import { generateAiPlan } from "@/lib/ai/plan";
import {
  CONCISE_NOTE,
  MAX_PLAN_TOKENS,
  addUsage,
  isTruncated,
  planTokenBudget,
  raisedBudget,
} from "@/lib/ai/plan-model";
import { templatePlan } from "@/lib/ai/templates";
import { logEvent } from "@/lib/server/log";
import { fakeAi, jsonReply, promptText, sampleInput } from "../server/fixtures";

vi.mock("@/lib/server/log", () => ({ logEvent: vi.fn() }));

const logged = vi.mocked(logEvent);
const geminiPlan = () => ({ ...templatePlan(sampleInput()), summary: "Straight from Gemini." });
const usage = (p: number, c: number, t?: number) => ({
  promptTokenCount: p,
  candidatesTokenCount: c,
  thoughtsTokenCount: t,
});
const CUT_TEXT = '{"summary":"A sangeet under marigolds","ideas":[{"name":"Rang';
const truncated = (): AiResponse => ({
  text: CUT_TEXT,
  candidates: [{ finishReason: FinishReason.MAX_TOKENS }],
  usageMetadata: usage(900, 8192, 40),
});
const ok = (): AiResponse => ({
  ...jsonReply(geminiPlan()),
  candidates: [{ finishReason: FinishReason.STOP }],
  usageMetadata: usage(950, 5000, 30),
});

beforeEach(() => logged.mockClear());

describe("output budgets", () => {
  it("gives English 8192 tokens and Indian-language scripts 16384", () => {
    expect(planTokenBudget("en")).toBe(8192);
    for (const lang of ["hi", "ta", "bn"] as const) expect(planTokenBudget(lang)).toBe(16_384);
  });

  it("raises a budget by half, capped at 24576", () => {
    expect(raisedBudget(8192)).toBe(12_288);
    expect(raisedBudget(16_384)).toBe(MAX_PLAN_TOKENS);
    expect(MAX_PLAN_TOKENS).toBe(24_576);
  });

  it("detects MAX_TOKENS on the first candidate only", () => {
    expect(isTruncated(truncated())).toBe(true);
    expect(isTruncated(ok())).toBe(false);
    expect(isTruncated({ text: "{}" })).toBe(false);
  });

  it("sums token counts, treating missing ones as zero", () => {
    const zero = { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 };
    expect(addUsage(addUsage(zero, usage(1, 2, 3)), undefined)).toEqual({
      promptTokenCount: 1,
      candidatesTokenCount: 2,
      thoughtsTokenCount: 3,
    });
    expect(addUsage(zero, { promptTokenCount: 5 })).toEqual({ ...zero, promptTokenCount: 5 });
  });
});

describe("a reply cut off at the token limit", () => {
  it("is asked again with 1.5x the budget and a concise note, without resending the cut-off text", async () => {
    const { handle, calls } = fakeAi([truncated(), ok()]);
    const result = await generateAiPlan(sampleInput(), { ai: handle, cache: null });
    expect(result).toMatchObject({ source: "gemini", attempts: 2 });
    expect(calls.map((c) => c.config?.maxOutputTokens)).toEqual([8192, 12_288]);
    const retry = promptText(calls[1]);
    expect(retry).toContain(CONCISE_NOTE);
    expect(retry).toContain("<<<BRIEF");
    expect(retry).not.toContain("Rang");
    expect(retry).not.toContain("failed validation");
    expect(Array.isArray(calls[1]?.contents) ? calls[1].contents : []).toHaveLength(1);
  });

  it("caps a non-English retry at 24576 tokens", async () => {
    const { handle, calls } = fakeAi([truncated(), ok()]);
    await generateAiPlan(sampleInput({ language: "hi" }), { ai: handle, cache: null });
    expect(calls.map((c) => c.config?.maxOutputTokens)).toEqual([16_384, 24_576]);
  });

  it("falls back to the template with reason max_tokens when the retry is cut off too", async () => {
    const { handle, calls } = fakeAi([truncated(), truncated()]);
    const result = await generateAiPlan(sampleInput(), { ai: handle, cache: null });
    expect(result).toMatchObject({ source: "template", model: "template", attempts: 2 });
    expect(calls).toHaveLength(2);
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "WARNING",
        message: "ai_plan_fallback",
        reason: "max_tokens",
        attempts: 2,
        promptTokenCount: 1800,
        candidatesTokenCount: 16_384,
        thoughtsTokenCount: 80,
      }),
    );
  });

  it("still gets the validation-error retry when an uncut reply is invalid", async () => {
    const { handle, calls } = fakeAi([
      { text: "{}", candidates: [{ finishReason: FinishReason.STOP }] },
      ok(),
    ]);
    await generateAiPlan(sampleInput(), { ai: handle, cache: null });
    expect(calls.map((c) => c.config?.maxOutputTokens)).toEqual([8192, 8192]);
    expect(promptText(calls[1])).toContain("failed validation");
  });
});

describe("token logging", () => {
  it("logs token counts (numbers only, never text) on success", async () => {
    const { handle } = fakeAi([truncated(), ok()]);
    await generateAiPlan(sampleInput(), { ai: handle, cache: null });
    expect(logged).toHaveBeenCalledTimes(1);
    const event = logged.mock.calls[0]?.[0];
    expect(event).toEqual({
      severity: "INFO",
      message: "ai_plan",
      attempts: 2,
      model: "gemini-3.5-flash",
      promptTokenCount: 1850,
      candidatesTokenCount: 13_192,
      thoughtsTokenCount: 70,
    });
    expect(JSON.stringify(event)).not.toContain("Jaipur");
  });

  it("logs zero counts when the backend reports no usage", async () => {
    const { handle } = fakeAi([new DOMException("timed out", "TimeoutError")]);
    await generateAiPlan(sampleInput(), { ai: handle, cache: null });
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "TimeoutError",
        attempts: 1,
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        thoughtsTokenCount: 0,
      }),
    );
  });
});
