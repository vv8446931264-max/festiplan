import type { AiPlan, PlanInput } from "@/lib/contracts";
import { OTHER_TIPS, OTHER_VENDORS, OTHER_WEIGHTS } from "./guidance";
import { otherIdeas } from "./ideas";
import { OTHER_TASKS } from "./tasks";

/** Deterministic template plan for any other celebration. */
export function otherPlan(input: PlanInput): AiPlan {
  return {
    summary: `A celebration for ${input.guests} guests in ${input.city}: settle the format and venue first, then food, décor and entertainment, and finish with invitations and a clear run-sheet.`,
    ideas: otherIdeas(input),
    budgetWeights: OTHER_WEIGHTS,
    tasks: OTHER_TASKS,
    vendors: OTHER_VENDORS,
    tips: OTHER_TIPS,
  };
}
