import type { AiPlan, EventType, PlanInput } from "@/lib/contracts";
import { birthdayPlan } from "./birthday";
import { communityPlan } from "./community";
import { otherPlan } from "./other";
import { clip, constraintTips, mergeTips } from "./shared";
import { weddingPlan } from "./wedding";

const BUILDERS: Record<EventType, (input: PlanInput) => AiPlan> = {
  wedding: weddingPlan,
  birthday: birthdayPlan,
  community: communityPlan,
  other: otherPlan,
};

/** Summary limit from `AiPlanSchema` (kept in step by tests). */
const SUMMARY_MAX = 320;

/**
 * A deterministic, high-quality `AiPlan` for the input's event type, used when Gemini
 * is unavailable or fails validation twice. The UI labels it "Template plan — AI unavailable".
 * Text is English; the brief's constraints add matching tips. Every call returns a fresh deep
 * copy, so callers can never change the shared template data.
 */
export function templatePlan(input: PlanInput): AiPlan {
  const base = BUILDERS[input.eventType](input);
  return structuredClone({
    ...base,
    summary: clip(base.summary, SUMMARY_MAX),
    tips: mergeTips(base.tips, constraintTips(input)),
  });
}

export { ageFrom, isKidsParty, ordinal } from "./birthday";
export { festivalFrom } from "./community";
