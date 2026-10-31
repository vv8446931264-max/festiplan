import {
  CONTINGENCY_PERCENT,
  EVENT_TYPE_LABELS,
  LIMITS,
  PLAN_TTL_DAYS,
} from "@/lib/contracts/constants";
import { formatINR } from "@/lib/engine";
import { PLAN_LANGUAGES } from "./copy";

/** One question and its plain-text answer, rendered on the landing page and in `FAQPage` JSON-LD. */
export type FaqItem = { readonly id: string; readonly question: string; readonly answer: string };

const formatCount = (value: number) => new Intl.NumberFormat("en-IN").format(value);
const languages = new Intl.ListFormat("en", { type: "disjunction" }).format(PLAN_LANGUAGES);

/**
 * The landing-page FAQ. Every number comes from the constants the engine and schemas enforce,
 * so the answers cannot drift from what the product does.
 */
export const FAQ: readonly FaqItem[] = [
  {
    id: "budget-split",
    question: "How does FestiPlan split my budget?",
    answer: `Gemini only suggests how much each category matters for your event. Tested code does the maths: it holds back ${CONTINGENCY_PERCENT}% as contingency and splits the rest into whole rupees that add up exactly to your total. Sliders rebalance instantly, with no further AI call.`,
  },
  {
    id: "free",
    question: "Is FestiPlan free to use?",
    answer:
      "Yes. No sign-up, no account and nothing to pay: describe the event and get three concepts, a budget, a dated timeline and a vendor checklist.",
  },
  {
    id: "events",
    question: "Which events can I plan with FestiPlan?",
    answer: `Weddings (haldi, mehendi, sangeet, reception), birthdays for kids or adults, and community events like society Diwali melas and fundraisers. Anything else works under “${EVENT_TYPE_LABELS.other}”, for ${formatCount(LIMITS.guestsMin)} to ${formatCount(LIMITS.guestsMax)} guests and budgets of ${formatINR(LIMITS.budgetMin)} to ${formatINR(LIMITS.budgetMax)}.`,
  },
  {
    id: "languages",
    question: "Which languages does FestiPlan support?",
    answer: `The site is in English. Gemini can write your plan in ${languages}, with amounts in Indian digit grouping like ${formatINR(1_200_000)}. If Gemini is unavailable, you get a labelled template plan in English.`,
  },
  {
    id: "vendors",
    question: "Are the vendors FestiPlan suggests real businesses?",
    answer:
      "Yes. Vendors come only from Grounding with Google Maps, each linked to its Maps listing so you can check reviews and prices yourself. FestiPlan never invents a business; if Maps finds nothing, you get a Google Maps search for your city.",
  },
  {
    id: "privacy",
    question: "Is my event plan private?",
    answer: `Plans are not listed anywhere and search engines are told not to index them. Each lives at a hard-to-guess link: share the read-only link with family and keep the edit link for whoever does the work. Plans are set to expire after ${PLAN_TTL_DAYS} days.`,
  },
];
