import type { BudgetWeight, Tip, VendorGuide } from "@/lib/contracts";
import { tip, vendor, weight } from "../shared";

/** Relative budget priorities for a multi-function Indian wedding. */
export const WEDDING_WEIGHTS: BudgetWeight[] = [
  weight("venue", 22, "Several functions need spaces that fit the full guest list and the mandap."),
  weight(
    "catering",
    26,
    "Food across every function is the largest per-guest cost at Indian weddings.",
  ),
  weight(
    "decor",
    14,
    "Each function has its own look — haldi, mehendi, sangeet, mandap and reception stage.",
  ),
  weight(
    "photography",
    9,
    "Photo and video coverage of every ceremony is the keepsake families value most.",
  ),
  weight("entertainment", 7, "Sangeet choreography, DJ, dhol and baraat band."),
  weight("attire", 10, "Outfits, jewellery, make-up and mehendi for the couple and close family."),
  weight(
    "invitations",
    2,
    "Save-the-dates and invitations, mostly digital with a few printed cards.",
  ),
  weight("gifts", 4, "Return gifts, welcome hampers and shagun envelopes."),
  weight("transport", 4, "Guest shuttles, airport pickups and the baraat."),
  weight("misc", 2, "Pandit dakshina, puja samagri, permits and small surprises."),
];

/** What to ask each wedding vendor, and the red flags to walk away from. */
export const WEDDING_VENDORS: VendorGuide[] = [
  vendor(
    "venue",
    40,
    [
      "Can one booking cover every function, and what are the time slots?",
      "Is there a music curfew, and what is the backup for rain?",
      "Which vendors are mandatory or in-house?",
    ],
    [
      "Unwilling to put the date and hours in writing",
      "Hidden charges for power backup or extra hours",
    ],
  ),
  vendor(
    "catering",
    32,
    [
      "Can we do a tasting for the whole menu?",
      "How are vegetarian and Jain dishes kept separate?",
      "What is the per-plate count policy for extra guests?",
    ],
    ["No tasting before the advance", "Vague about kitchen hygiene or staff numbers"],
  ),
  vendor(
    "photography",
    32,
    [
      "Can we see two full wedding albums, not just highlights?",
      "How many shooters for each function?",
      "When will edited photos and the film be delivered?",
    ],
    ["Only shows reels, never full galleries", "No delivery date in the contract"],
  ),
  vendor(
    "decor",
    28,
    [
      "Can you share a 3D or sketch mock-up for each function?",
      "What is reused versus newly bought?",
      "Who handles set-up and take-down timing with the venue?",
    ],
    ["Quote without an itemised list", "Pressure to upgrade on the day"],
  ),
  vendor(
    "attire",
    24,
    ["How many fittings are included?", "What is the final alteration deadline?"],
    ["No written delivery date"],
  ),
  vendor(
    "entertainment",
    16,
    ["What is the set list and do you take requests?", "What sound equipment do you bring?"],
    ["Cannot confirm who will actually perform"],
  ),
  vendor(
    "transport",
    8,
    [
      "Are drivers' night allowances and tolls included?",
      "What is the backup if a vehicle breaks down?",
    ],
    ["No commercial permits for the vehicles"],
  ),
];

/** Wedding tips across culture, savings, sustainability and accessibility. */
export const WEDDING_TIPS: Tip[] = [
  tip(
    "culture",
    "Confirm the muhurat and each ritual's order with the family priest early — it shapes the venue timings for every function.",
  ),
  tip(
    "savings",
    "Combining the haldi and mehendi on one day at the same venue saves a décor set-up and a day of venue hire.",
  ),
  tip(
    "sustainability",
    "Send digital invitations and ask the decorator to donate or compost flowers after the reception.",
  ),
  tip(
    "accessibility",
    "Seat elders close to the mandap with shade, water and a clear, step-free path to the washrooms.",
  ),
];
