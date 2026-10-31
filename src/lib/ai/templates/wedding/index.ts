import type { AiPlan, PlanInput } from "@/lib/contracts";
import { WEDDING_TIPS, WEDDING_VENDORS, WEDDING_WEIGHTS } from "./guidance";
import { weddingIdeas } from "./ideas";
import { WEDDING_TASKS } from "./tasks";

/** Deterministic template plan for weddings: every function from haldi to reception. */
export function weddingPlan(input: PlanInput): AiPlan {
  return {
    summary: `A ${input.guests}-guest wedding in ${input.city} covering haldi, mehendi, sangeet, pheras and the reception. Lock the muhurat, venue and caterer first; décor, attire and entertainment follow.`,
    ideas: weddingIdeas(input),
    budgetWeights: WEDDING_WEIGHTS,
    tasks: WEDDING_TASKS,
    vendors: WEDDING_VENDORS,
    tips: WEDDING_TIPS,
  };
}
