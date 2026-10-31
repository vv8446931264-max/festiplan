import { templatePlan } from "@/lib/ai/templates";
import type { PlanInput, PublicPlan } from "@/lib/contracts";
import { allocateBudget, scheduleTimeline, scheduleVendors } from "@/lib/engine";

export const FIXTURE_TODAY = "2026-10-24";

export const FIXTURE_INPUT: PlanInput = {
  eventType: "wedding",
  title: "Riya's sangeet",
  eventDate: "2027-03-23",
  city: "Jaipur",
  guests: 180,
  budgetINR: 1_200_000,
  vibe: "Rajasthani folk meets Bollywood",
  constraints: ["Vegetarian menu"],
  language: "en",
};

/** A complete public plan built the same way the server builds one (template mode). */
export function fixturePlan(
  overrides: Partial<PlanInput> = {},
  source: PublicPlan["source"] = "gemini",
): PublicPlan {
  const input = { ...FIXTURE_INPUT, ...overrides };
  const ai = templatePlan(input);
  const { contingencyINR, allocations } = allocateBudget({
    totalINR: input.budgetINR,
    weights: ai.budgetWeights,
    guests: input.guests,
  });
  return {
    id: "Ab3dEf9hIj2k",
    input,
    ai,
    budget: allocations,
    contingencyINR,
    timeline: scheduleTimeline(ai.tasks, input.eventDate, FIXTURE_TODAY),
    vendors: scheduleVendors(ai.vendors, input.eventDate, FIXTURE_TODAY),
    source,
    model: source === "gemini" ? "gemini-3.5-flash" : "template",
    today: FIXTURE_TODAY,
    createdAt: "2026-10-24T06:00:00.000Z",
    updatedAt: "2026-10-24T06:00:00.000Z",
    expireAt: "2027-04-22T06:00:00.000Z",
  };
}
