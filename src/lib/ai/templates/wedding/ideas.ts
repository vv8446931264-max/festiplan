import type { Idea, PlanInput } from "@/lib/contracts";
import { isVegetarian } from "@/lib/ai/templates/shared";
import type { Concept } from "@/lib/ai/templates/shared";

const MARIGOLD_HAVELI: Concept = {
  name: "Marigold Haveli Nights",
  concept:
    "A heritage-courtyard celebration in marigold, rani pink and gold, with diyas lining every walkway and folk musicians welcoming guests at the gate.",
  palette: ["#E9500E", "#FFBF02", "#CD197D", "#2E5E4E"],
  decor: [
    "Marigold and mango-leaf torans at every entrance",
    "Hundreds of clay diyas along the steps",
    "Block-print bolsters and low baithaks for elders",
    "Brass urli bowls with floating flowers",
  ],
  music:
    "Live folk musicians for the welcome, a dhol-led baraat and a Bollywood-and-folk DJ set for the sangeet.",
  signatureMoment:
    "The couple's entry for the pheras under a canopy of falling marigold petals as family sing a traditional geet.",
};

const PASTEL_GARDEN: Concept = {
  name: "Pastel Garden Mehfil",
  concept:
    "An open-air garden affair in blush, sage and ivory: floral canopies, fairy lights in the trees and a mehfil-style sangeet with the family on cushions.",
  palette: ["#F4C2C2", "#8FA36A", "#FFEDD7", "#C9A227"],
  decor: [
    "Floral swing for the bride at the mehendi",
    "Fairy-light canopy over the dining lawn",
    "Pastel dupatta drapes on the mandap",
    "Hand-painted welcome board with the couple's monogram",
  ],
  music:
    "Acoustic ghazals and qawwali for the mehendi, then a family-choreographed sangeet with a live band.",
  signatureMoment:
    "A surprise sangeet act where both families perform a song written about the couple.",
};

const MODERN_MINIMAL: Concept = {
  name: "Modern Minimal Mandap",
  concept:
    "A contemporary, low-waste wedding in ivory, deep indigo and soft gold: clean lines, potted plants instead of cut flowers, and a mandap built from reusable wood.",
  palette: ["#F7F3EA", "#2F3A56", "#C9A227", "#8FA36A"],
  decor: [
    "Potted-plant aisle that guests take home as favours",
    "Reusable wooden mandap with fabric drapes",
    "Single-colour lighting washes instead of heavy florals",
  ],
  music:
    "A string quartet playing Bollywood classics for the reception, and an indie-pop DJ to close the night.",
  signatureMoment:
    "A quiet moment after the pheras where the couple plant a sapling together with their parents.",
};

/** One menu per concept, in concept order; meat dishes give way to vegetarian ones on request. */
function weddingMenus(vegetarian: boolean): [string[], string[], string[]] {
  return [
    [
      "Regional thali served at the table",
      "Live chaat and kulfi counters",
      vegetarian
        ? "Paneer tikka and dal baati station"
        : "Tandoori grill with kebabs and paneer tikka",
    ],
    [
      "Mehendi-afternoon chai, samosa and jalebi cart",
      "Fresh fruit and nimbu-pani bar",
      vegetarian
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

/** Three distinct wedding concepts, with menus that respect the brief's dietary needs. */
export function weddingIdeas(input: PlanInput): Idea[] {
  const [haveliMenu, gardenMenu, minimalMenu] = weddingMenus(isVegetarian(input));
  return [
    { ...MARIGOLD_HAVELI, food: haveliMenu },
    { ...PASTEL_GARDEN, food: gardenMenu },
    { ...MODERN_MINIMAL, food: minimalMenu },
  ];
}
