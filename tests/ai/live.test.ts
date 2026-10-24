// @vitest-environment node
/**
 * Live smoke test against the real Gemini backend. Excluded from the default run
 * (vitest.config.ts) and skipped unless LIVE_AI_TOKEN is set, e.g.
 *   LIVE_AI_TOKEN=1 GEMINI_API_KEY=… npx vitest run tests/ai/live.test.ts
 */
import { describe, expect, it } from "vitest";
import { getAi } from "@/lib/ai/client";
import { generateAiPlan } from "@/lib/ai/plan";
import { findVendors } from "@/lib/ai/vendors";
import { AiPlanSchema } from "@/lib/contracts";
import { TODAY, sampleInput } from "../server/fixtures";

describe.skipIf(!process.env.LIVE_AI_TOKEN)("live Gemini", () => {
  it("generates a schema-valid plan", { timeout: 60_000 }, async () => {
    const ai = getAi();
    expect(ai).not.toBeNull();
    const result = await generateAiPlan(sampleInput(), { ai, today: TODAY, cache: null });
    expect(result.source).toBe("gemini");
    expect(AiPlanSchema.safeParse(result.ai).success).toBe(true);
  });

  it("finds grounded vendors with https Maps links", { timeout: 60_000 }, async () => {
    const result = await findVendors({ city: "Jaipur", category: "catering", eventType: "wedding" }, { cache: null });
    expect(result.searchUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    for (const p of result.places) expect(p.uri.startsWith("https://")).toBe(true);
  });
});
