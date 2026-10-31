import type { BudgetWeight, Tip, VendorGuide } from "@/lib/contracts";
import { tip, vendor, weight } from "../shared";

/** Relative budget priorities for a community event; the stage and safety lead. */
export const COMMUNITY_WEIGHTS: BudgetWeight[] = [
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

/** What to ask each community-event vendor, with crowd safety first. */
export const COMMUNITY_VENDORS: VendorGuide[] = [
  vendor(
    "entertainment",
    6,
    [
      "What wattage of sound fits our crowd and grounds?",
      "Do you carry backup microphones and an operator for the whole event?",
      "Can you meet the loudspeaker time limits?",
    ],
    ["No operator on site during the show", "Refuses a sound check"],
  ),
  vendor(
    "venue",
    8,
    ["Who handles tents, chairs and power backup?", "What are the clean-up and handover times?"],
    ["No written permission from the land owner or society"],
  ),
  vendor(
    "decor",
    4,
    [
      "Is the lighting wiring done by a licensed electrician?",
      "Can the stall fronts be reused next year?",
    ],
    ["Open wiring or overloaded extension boards"],
  ),
  vendor(
    "catering",
    4,
    ["Can you supply drinking water for the whole crowd?", "How will food waste be handled?"],
    ["No food-safety registration"],
  ),
  vendor(
    "misc",
    6,
    [
      "Can the security agency supply trained staff with IDs?",
      "Is first-aid staff or an ambulance on call?",
    ],
    ["Cannot share staff numbers in advance"],
  ),
];

/** Community-event tips on sponsors, waste, access, inclusion and transparent accounts. */
export const COMMUNITY_TIPS: Tip[] = [
  tip(
    "savings",
    "Offer sponsors stall space, stage mentions and banner spots in clear tiers so local businesses can choose what fits.",
  ),
  tip(
    "sustainability",
    "Ban single-use plastic at stalls, run a steel-tumbler water station and keep segregated bins every 30 steps.",
  ),
  tip(
    "accessibility",
    "Keep a step-free route, reserved seating near the stage for elders and wheelchair users, and a quiet first-aid tent.",
  ),
  tip(
    "culture",
    "Rotate the cultural programme across communities in the neighbourhood so every group sees itself on stage.",
  ),
  tip(
    "savings",
    "Record every payment with a receipt in a shared sheet so the committee report is ready the day after.",
  ),
];
