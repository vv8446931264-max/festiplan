import type { AiPlan, Idea, PlanInput } from "@/lib/contracts";
import { idea, isVegetarian, task, tip, vendor, weight } from "./shared";

function weddingFood(input: PlanInput): [string[], string[], string[]] {
  const veg = isVegetarian(input);
  return [
    [
      "Regional thali served at the table",
      "Live chaat and kulfi counters",
      veg ? "Paneer tikka and dal baati station" : "Tandoori grill with kebabs and paneer tikka",
    ],
    [
      "Mehendi-afternoon chai, samosa and jalebi cart",
      "Fresh fruit and nimbu-pani bar",
      veg
        ? "Millet khichdi and seasonal sabzi counter"
        : "Biryani handi counter with a veg pulao option",
    ],
    [
      "Small-plates menu of seasonal regional favourites",
      "Sugarcane, aam panna and coconut water bar",
      "Late-night masala chai and bun-maska station",
    ],
  ];
}

function weddingIdeas(input: PlanInput): Idea[] {
  const [food1, food2, food3] = weddingFood(input);
  return [
    idea(
      "Marigold Haveli Nights",
      "A heritage-courtyard celebration in marigold, rani pink and gold, with diyas lining every walkway and folk musicians welcoming guests at the gate.",
      ["#E9500E", "#FFBF02", "#CD197D", "#2E5E4E"],
      [
        "Marigold and mango-leaf torans at every entrance",
        "Hundreds of clay diyas along the steps",
        "Block-print bolsters and low baithaks for elders",
        "Brass urli bowls with floating flowers",
      ],
      food1,
      "Live folk musicians for the welcome, a dhol-led baraat and a Bollywood-and-folk DJ set for the sangeet.",
      "The couple's entry for the pheras under a canopy of falling marigold petals as family sing a traditional geet.",
    ),
    idea(
      "Pastel Garden Mehfil",
      "An open-air garden affair in blush, sage and ivory: floral canopies, fairy lights in the trees and a mehfil-style sangeet with the family on cushions.",
      ["#F4C2C2", "#8FA36A", "#FFEDD7", "#C9A227"],
      [
        "Floral swing for the bride at the mehendi",
        "Fairy-light canopy over the dining lawn",
        "Pastel dupatta drapes on the mandap",
        "Hand-painted welcome board with the couple's monogram",
      ],
      food2,
      "Acoustic ghazals and qawwali for the mehendi, then a family-choreographed sangeet with a live band.",
      "A surprise sangeet act where both families perform a song written about the couple.",
    ),
    idea(
      "Modern Minimal Mandap",
      "A contemporary, low-waste wedding in ivory, deep indigo and soft gold: clean lines, potted plants instead of cut flowers, and a mandap built from reusable wood.",
      ["#F7F3EA", "#2F3A56", "#C9A227", "#8FA36A"],
      [
        "Potted-plant aisle that guests take home as favours",
        "Reusable wooden mandap with fabric drapes",
        "Single-colour lighting washes instead of heavy florals",
      ],
      food3,
      "A string quartet playing Bollywood classics for the reception, and an indie-pop DJ to close the night.",
      "A quiet moment after the pheras where the couple plant a sapling together with their parents.",
    ),
  ];
}

const WEIGHTS = [
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

const TASKS = [
  task(
    "confirm-muhurat",
    "Confirm the muhurat and function dates with family elders",
    "admin",
    52,
    7,
  ),
  task(
    "agree-budget",
    "Agree budget priorities and guest numbers with both families",
    "admin",
    50,
    7,
  ),
  task("draft-guest-list", "Draft the guest list for each function", "invitations", 48, 14, [
    "agree-budget",
  ]),
  task("book-venue", "Visit and book venues for all functions", "venue", 44, 21, [
    "confirm-muhurat",
    "agree-budget",
  ]),
  task("book-caterer", "Hold tastings and book the caterer", "catering", 36, 14, ["book-venue"]),
  task("book-photographer", "Book the photographer and videographer", "photography", 36, 10, [
    "confirm-muhurat",
  ]),
  task("book-decorator", "Finalise the décor concept and book the decorator", "decor", 32, 14, [
    "book-venue",
  ]),
  task("block-rooms", "Block rooms for outstation family and guests", "venue", 30, 7, [
    "draft-guest-list",
  ]),
  task("order-attire", "Order wedding outfits and schedule fittings", "attire", 28, 60, [
    "confirm-muhurat",
  ]),
  task("send-save-dates", "Send save-the-dates", "invitations", 24, 3, ["draft-guest-list"]),
  task("book-music", "Book the DJ, dhol players and baraat band", "entertainment", 20, 7, [
    "book-venue",
  ]),
  task("book-mehendi-makeup", "Book mehendi and make-up artists", "attire", 20, 5),
  task("plan-sangeet", "Plan sangeet performances with a choreographer", "entertainment", 16, 45, [
    "book-music",
  ]),
  task("book-pandit", "Book the pandit and list puja samagri for the pheras", "admin", 12, 3, [
    "confirm-muhurat",
  ]),
  task(
    "send-invitations",
    "Design and send invitations, digital and printed",
    "invitations",
    10,
    14,
    ["send-save-dates"],
  ),
  task("order-gifts", "Order return gifts, welcome hampers and shagun envelopes", "gifts", 8, 14),
  task(
    "plan-transport",
    "Arrange guest shuttles, airport pickups and the baraat ride",
    "transport",
    8,
    7,
    ["block-rooms"],
  ),
  task("plan-reception", "Plan the reception stage, entry and guest flow", "venue", 8, 7, [
    "book-decorator",
  ]),
  task(
    "check-permits",
    "Check music curfew, fire safety and any licences with the venue",
    "admin",
    6,
    7,
    ["book-venue"],
  ),
  task(
    "plan-haldi",
    "Plan the haldi: turmeric paste, marigolds and an easy-clean area",
    "decor",
    5,
    5,
    ["book-decorator"],
  ),
  task("plan-mehendi", "Plan mehendi seating, music and snacks", "decor", 5, 5, [
    "book-mehendi-makeup",
  ]),
  task("final-headcount", "Confirm the final headcount with caterer and venue", "catering", 2, 3, [
    "send-invitations",
    "book-caterer",
  ]),
  task(
    "run-sheet",
    "Share a run-sheet with family coordinators for every function",
    "admin",
    1,
    3,
    ["final-headcount"],
  ),
  task("vendor-payments", "Prepare vendor payment envelopes and a contact sheet", "misc", 1, 2),
  task(
    "emergency-kit",
    "Pack an emergency kit: safety pins, medicines, chargers, snacks",
    "misc",
    0,
    1,
  ),
];

const VENDORS = [
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

const TIPS = [
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

/** Deterministic template plan for weddings: every function from haldi to reception. */
export function weddingPlan(input: PlanInput): AiPlan {
  return {
    summary: `A ${input.guests}-guest wedding in ${input.city} covering haldi, mehendi, sangeet, pheras and the reception. Lock the muhurat, venue and caterer first; décor, attire and entertainment follow.`,
    ideas: weddingIdeas(input),
    budgetWeights: structuredClone(WEIGHTS),
    tasks: structuredClone(TASKS),
    vendors: structuredClone(VENDORS),
    tips: structuredClone(TIPS),
  };
}
