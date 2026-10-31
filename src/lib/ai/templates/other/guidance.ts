import type { BudgetWeight, Tip, VendorGuide } from "@/lib/contracts";
import { tip, vendor, weight } from "../shared";

/** Relative budget priorities for a general celebration; food and venue lead. */
export const OTHER_WEIGHTS: BudgetWeight[] = [
  weight("venue", 24, "A comfortable space sized for the guest list."),
  weight("catering", 32, "Food and drinks are what guests remember most."),
  weight("decor", 14, "Lighting and a few strong décor touches set the mood."),
  weight("entertainment", 10, "Music or a live act keeps the energy up."),
  weight("photography", 8, "Photos to share after the event."),
  weight("invitations", 3, "Digital invitations with RSVP tracking."),
  weight("gifts", 4, "Small favours or return gifts."),
  weight("misc", 5, "Supplies, tips for staff and last-minute needs."),
];

/** What to ask each vendor for a general celebration. */
export const OTHER_VENDORS: VendorGuide[] = [
  vendor(
    "venue",
    10,
    [
      "What is included in the hire — chairs, power backup, staff?",
      "What are the start and end times?",
    ],
    ["No written cancellation terms"],
  ),
  vendor(
    "catering",
    8,
    ["Can we do a tasting?", "How do you handle extra guests on the day?"],
    ["No itemised quote"],
  ),
  vendor(
    "photography",
    6,
    ["Can we see a full event gallery?", "When will we receive the photos?"],
    ["No delivery date in writing"],
  ),
  vendor(
    "entertainment",
    6,
    ["What sound equipment do you bring?", "Can you share a recent performance video?"],
    ["Unclear who will actually perform"],
  ),
];

/** General celebration tips on savings, sustainability and access. */
export const OTHER_TIPS: Tip[] = [
  tip(
    "savings",
    "Weekday or off-season dates often cut venue hire significantly — ask venues for their quiet days.",
  ),
  tip(
    "sustainability",
    "Use digital invitations and ask the caterer for steel or areca-leaf plates instead of plastic.",
  ),
  tip(
    "accessibility",
    "Check step-free access and a nearby accessible toilet before you book the venue.",
  ),
];
