import type { AiPlan, Idea, PlanInput } from "@/lib/contracts";
import { briefText, idea, isVegetarian, task, tip, vendor, weight } from "./shared";

const FESTIVALS = ["diwali", "holi", "ganesh", "navratri", "durga puja", "onam", "pongal", "eid", "christmas", "lohri", "bihu", "janmashtami"];

/** The festival named in the brief, title-cased, or null. */
export function festivalFrom(input: PlanInput): string | null {
  const text = briefText(input);
  const found = FESTIVALS.find((f) => text.includes(f));
  return found ? found.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

function communityIdeas(input: PlanInput): Idea[] {
  const fest = festivalFrom(input);
  const veg = isVegetarian(input);
  return [
    idea(
      fest ? `${fest} Utsav Mela` : "Neighbourhood Utsav Mela",
      "A festive mela that brings every age group out: food and craft stalls along a lit walkway, a central stage for performances and a children's games zone.",
      ["#FFBF02", "#E9500E", "#CD197D", "#8FA36A"],
      ["Paper-lantern canopy over the stall lane", "Rangoli competition at the entrance", "Marigold-strung stage backdrop", "Clearly signed entry, exit and first-aid points"],
      ["Resident-run regional food stalls", veg ? "Pure-veg chaat and sweets counters" : "Chaat, kebab and sweets counters", "Free drinking-water stations with steel tumblers"],
      "Resident talent show, a local folk troupe and a community dance hour to close.",
      "Every household lights a lamp together at a shared moment, announced from the stage.",
    ),
    idea(
      "Bazaar for a Cause",
      "A fundraiser bazaar where sponsors back stalls, residents sell crafts and home food, and a clear board shows what the money will fund.",
      ["#2F3A56", "#F58A07", "#FFEDD7", "#C9D88F"],
      ["Sponsor wall with tiered recognition", "Progress board for the cause", "Craft and thrift stalls in a grid"],
      ["Home-chef stalls with a hygiene checklist", "Tea and snacks by the volunteer team", "Seasonal fruit and juice stall"],
      "Acoustic sets by resident musicians and a lucky-draw announcement every hour.",
      "The committee announces the total raised live, with the cause's beneficiaries on stage.",
    ),
    idea(
      "Cultural Evening Under the Stars",
      "A seated cultural evening in the society grounds: classical and folk performances, a short play by the children and a community dinner.",
      ["#1A237E", "#C9A227", "#F7F3EA", "#A23BC4"],
      ["Fairy-light canopy over the seating", "Low-height stage with good sightlines", "Diya-lined aisles"],
      ["Community potluck organised by building", "Live jalebi and chai counter", "Khichdi and kadhi dinner served by volunteers"],
      "Classical dance, a folk music group and the children's play.",
      "Elders of the community are felicitated on stage before dinner.",
    ),
  ];
}

const WEIGHTS = [
  weight("venue", 14, "Grounds, tents, chairs and power backup for the crowd."),
  weight("catering", 18, "Food and drinking water for volunteers and guests."),
  weight("decor", 14, "Lighting, stall fronts and the stage backdrop."),
  weight("entertainment", 20, "Stage, sound, lights and performers are the heart of the event."),
  weight("photography", 4, "Photos for sponsors and the committee report."),
  weight("invitations", 4, "Posters, banners and social-media publicity."),
  weight("gifts", 6, "Prizes for competitions and tokens for volunteers."),
  weight("transport", 3, "Moving equipment and stall material."),
  weight("misc", 17, "Permits, security, first aid, insurance, waste management and cleaning."),
];

const TASKS = [
  task("form-committee", "Form the organising committee and assign leads", "admin", 12, 5),
  task("set-budget", "Agree the budget, sponsor targets and an accounts process", "admin", 11, 5, ["form-committee"]),
  task("book-grounds", "Book the grounds or hall and confirm power supply", "venue", 10, 5, ["form-committee"]),
  task("apply-permits", "Apply for police, municipal and loudspeaker permissions", "admin", 9, 21, ["book-grounds"]),
  task("sponsor-tiers", "Prepare sponsor tiers and approach local sponsors", "misc", 9, 21, ["set-budget"]),
  task("recruit-volunteers", "Recruit volunteers and draw up the duty roster", "admin", 8, 14, ["form-committee"]),
  task("allocate-stalls", "Invite stall applications and allocate the layout", "venue", 7, 14, ["book-grounds"]),
  task("book-stage-sound", "Book the stage, sound and lighting", "entertainment", 7, 5, ["book-grounds"]),
  task("plan-programme", "Plan the cultural programme and hold auditions", "entertainment", 6, 21, ["book-stage-sound"]),
  task("food-safety", "Brief food stalls on hygiene, water and food-safety registration", "catering", 5, 7, ["allocate-stalls"]),
  task("publicity", "Design posters and banners and announce on resident groups", "invitations", 5, 7, ["plan-programme"]),
  task("safety-plan", "Plan crowd flow, fire extinguishers, first aid and lost-child desk", "misc", 4, 7, ["apply-permits", "allocate-stalls"]),
  task("book-generator", "Book a generator and a licensed electrician", "venue", 4, 3, ["book-stage-sound"]),
  task("waste-plan", "Arrange segregated bins and a waste pickup", "misc", 3, 5, ["allocate-stalls"]),
  task("order-prizes", "Order competition prizes and volunteer tokens", "gifts", 3, 5),
  task("plan-decor", "Plan lighting, stall fronts and the stage backdrop", "decor", 3, 7, ["allocate-stalls"]),
  task("volunteer-briefing", "Brief volunteers with the run-sheet and emergency contacts", "admin", 1, 1, ["recruit-volunteers", "safety-plan"]),
  task("rehearsal", "Hold a stage and sound rehearsal", "entertainment", 0, 1, ["plan-programme"]),
  task("accounts-report", "Share the spending report with the committee and residents", "admin", 0, 7, ["set-budget"]),
];

const VENDORS = [
  vendor("entertainment", 6, ["What wattage of sound fits our crowd and grounds?", "Do you carry backup microphones and an operator for the whole event?", "Can you meet the loudspeaker time limits?"], ["No operator on site during the show", "Refuses a sound check"]),
  vendor("venue", 8, ["Who handles tents, chairs and power backup?", "What are the clean-up and handover times?"], ["No written permission from the land owner or society"]),
  vendor("decor", 4, ["Is the lighting wiring done by a licensed electrician?", "Can the stall fronts be reused next year?"], ["Open wiring or overloaded extension boards"]),
  vendor("catering", 4, ["Can you supply drinking water for the whole crowd?", "How will food waste be handled?"], ["No food-safety registration"]),
  vendor("misc", 6, ["Can the security agency supply trained staff with IDs?", "Is first-aid staff or an ambulance on call?"], ["Cannot share staff numbers in advance"]),
];

const TIPS = [
  tip("savings", "Offer sponsors stall space, stage mentions and banner spots in clear tiers so local businesses can choose what fits."),
  tip("sustainability", "Ban single-use plastic at stalls, run a steel-tumbler water station and keep segregated bins every 30 steps."),
  tip("accessibility", "Keep a step-free route, reserved seating near the stage for elders and wheelchair users, and a quiet first-aid tent."),
  tip("culture", "Rotate the cultural programme across communities in the neighbourhood so every group sees itself on stage."),
  tip("savings", "Record every payment with a receipt in a shared sheet so the committee report is ready the day after."),
];

/** Deterministic template plan for community events: permits, volunteers, sponsors, stalls, stage, safety. */
export function communityPlan(input: PlanInput): AiPlan {
  const fest = festivalFrom(input);
  return {
    summary: `A ${fest ? `${fest} ` : ""}community event in ${input.city} for about ${input.guests} people: form the committee, secure permits and sponsors early, then stalls, stage, volunteers and a safety plan.`,
    ideas: communityIdeas(input),
    budgetWeights: structuredClone(WEIGHTS),
    tasks: structuredClone(TASKS),
    vendors: structuredClone(VENDORS),
    tips: structuredClone(TIPS),
  };
}
