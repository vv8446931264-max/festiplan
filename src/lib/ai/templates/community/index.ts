import type { AiPlan, PlanInput } from "@/lib/contracts";
import { festivalFrom } from "./festival";
import { COMMUNITY_TIPS, COMMUNITY_VENDORS, COMMUNITY_WEIGHTS } from "./guidance";
import { communityIdeas } from "./ideas";
import { COMMUNITY_TASKS } from "./tasks";

export { festivalFrom } from "./festival";

/** Deterministic template plan for community events: permits, volunteers, sponsors, stalls, stage, safety. */
export function communityPlan(input: PlanInput): AiPlan {
  const festival = festivalFrom(input);
  const eventName = festival ? `${festival} community event` : "community event";
  return {
    summary: `A ${eventName} in ${input.city} for about ${input.guests} people: form the committee, secure permits and sponsors early, then stalls, stage, volunteers and a safety plan.`,
    ideas: communityIdeas(input),
    budgetWeights: COMMUNITY_WEIGHTS,
    tasks: COMMUNITY_TASKS,
    vendors: COMMUNITY_VENDORS,
    tips: COMMUNITY_TIPS,
  };
}
