import type { BudgetWeight, Tip, VendorGuide } from "@/lib/contracts";
import { tip, vendor, weight } from "../shared";

/** Relative budget priorities; a children's party shifts money towards fun, décor and gifts. */
export function birthdayWeights(kids: boolean): BudgetWeight[] {
  return [
    weight("venue", kids ? 18 : 22, "A safe, easy-to-reach space sized for the guest list."),
    weight("catering", kids ? 24 : 30, "Separate kid-friendly and adult menus, plus the cake."),
    weight("decor", kids ? 16 : 12, "The theme backdrop and photo corner carry the look."),
    weight(
      "entertainment",
      kids ? 18 : 16,
      kids
        ? "An entertainer and planned games keep children engaged."
        : "Music or a live act sets the mood.",
    ),
    weight("photography", 6, "Candid photos of the cake-cutting and games."),
    weight("gifts", kids ? 10 : 4, "Return gifts or favours for every guest."),
    weight("invitations", 2, "Digital invitations with RSVP tracking."),
    weight("misc", kids ? 6 : 8, "First aid, helpers, candles and last-minute supplies."),
  ];
}

/** What to ask each birthday vendor, with child safety and allergies first. */
export const BIRTHDAY_VENDORS: VendorGuide[] = [
  vendor(
    "venue",
    6,
    [
      "Is the space child-safe — no open water, sharp edges or loose wiring?",
      "What time can we start setting up?",
      "Is there a power backup?",
    ],
    ["No written cancellation terms"],
  ),
  vendor(
    "catering",
    4,
    [
      "Can you make a separate kids' menu with mild spice?",
      "Is the cake eggless and nut-free on request?",
    ],
    ["Cannot list ingredients for allergy checks"],
  ),
  vendor(
    "entertainment",
    4,
    ["Can we see a video of a recent party?", "Is the act right for the guests' ages?"],
    ["Late confirmation of the performer's name"],
  ),
  vendor(
    "decor",
    3,
    ["Are the balloons and props reusable or biodegradable?", "How long does set-up take?"],
    ["Charges extra for take-down without saying so"],
  ),
  vendor(
    "photography",
    4,
    ["When will we receive the edited photos?", "Will you cover both the kids' and adults' areas?"],
    ["No portfolio of event work"],
  ),
];

/** Birthday tips across savings, sustainability, accessibility and family tradition. */
export const BIRTHDAY_TIPS: Tip[] = [
  tip(
    "savings",
    "A society clubhouse or terrace is often far cheaper than a party hall and is easier for neighbours' families to reach.",
  ),
  tip(
    "sustainability",
    "Choose return gifts children keep using — books, seed kits or art sets — instead of plastic toys.",
  ),
  tip(
    "accessibility",
    "Keep a quiet corner with soft seating for children who get overwhelmed, and an allergy list with the food helpers.",
  ),
  tip(
    "culture",
    "Make space for family traditions such as an aarti or tilak by the grandparents before the cake-cutting.",
  ),
];
