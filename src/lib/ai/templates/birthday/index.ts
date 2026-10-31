import type { AiPlan, PlanInput } from "@/lib/contracts";
import { ageFrom, isKidsParty, ordinal } from "./age";
import { BIRTHDAY_TIPS, BIRTHDAY_VENDORS, birthdayWeights } from "./guidance";
import { adultIdeas, kidsIdeas } from "./ideas";
import { BIRTHDAY_TASKS } from "./tasks";

export { ageFrom, isKidsParty, ordinal } from "./age";

/** "7th birthday", "children's birthday" or plain "birthday", for the summary. */
function occasion(age: number | null, kids: boolean): string {
  if (age !== null) return `${ordinal(age)} birthday`;
  return kids ? "children's birthday" : "birthday";
}

/** Deterministic template plan for birthdays: age-aware ideas, kids/adult split, return gifts. */
export function birthdayPlan(input: PlanInput): AiPlan {
  const kids = isKidsParty(input);
  return {
    summary: `A ${occasion(ageFrom(input), kids)} for ${input.guests} guests in ${input.city}: pick the theme, book the venue and entertainment early, and plan separate kids' and adults' food plus return gifts.`,
    ideas: kids ? kidsIdeas(input) : adultIdeas(input),
    budgetWeights: birthdayWeights(kids),
    tasks: BIRTHDAY_TASKS,
    vendors: BIRTHDAY_VENDORS,
    tips: BIRTHDAY_TIPS,
  };
}
