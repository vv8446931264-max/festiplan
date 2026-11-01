import type { Idea, PlanInput } from "@/lib/contracts";
import { isVegetarian } from "@/lib/ai/templates/shared";
import { festivalFrom } from "./festival";

/** The mela minus its name (which carries the festival) and its menu (which follows diet). */
const UTSAV_MELA: Omit<Idea, "name" | "food"> = {
  concept:
    "A festive mela that brings every age group out: food and craft stalls along a lit walkway, a central stage for performances and a children's games zone.",
  palette: ["#FFBF02", "#E9500E", "#CD197D", "#8FA36A"],
  decor: [
    "Paper-lantern canopy over the stall lane",
    "Rangoli competition at the entrance",
    "Marigold-strung stage backdrop",
    "Clearly signed entry, exit and first-aid points",
  ],
  music: "Resident talent show, a local folk troupe and a community dance hour to close.",
  signatureMoment:
    "Every household lights a lamp together at a shared moment, announced from the stage.",
};

const BAZAAR_FOR_A_CAUSE: Idea = {
  name: "Bazaar for a Cause",
  concept:
    "A fundraiser bazaar where sponsors back stalls, residents sell crafts and home food, and a clear board shows what the money will fund.",
  palette: ["#2F3A56", "#F58A07", "#FFEDD7", "#C9D88F"],
  decor: [
    "Sponsor wall with tiered recognition",
    "Progress board for the cause",
    "Craft and thrift stalls in a grid",
  ],
  food: [
    "Home-chef stalls with a hygiene checklist",
    "Tea and snacks by the volunteer team",
    "Seasonal fruit and juice stall",
  ],
  music: "Acoustic sets by resident musicians and a lucky-draw announcement every hour.",
  signatureMoment:
    "The committee announces the total raised live, with the cause's beneficiaries on stage.",
};

const CULTURAL_EVENING: Idea = {
  name: "Cultural Evening Under the Stars",
  concept:
    "A seated cultural evening in the society grounds: classical and folk performances, a short play by the children and a community dinner.",
  palette: ["#1A237E", "#C9A227", "#F7F3EA", "#A23BC4"],
  decor: [
    "Fairy-light canopy over the seating",
    "Low-height stage with good sightlines",
    "Diya-lined aisles",
  ],
  food: [
    "Community potluck organised by building",
    "Live jalebi and chai counter",
    "Khichdi and kadhi dinner served by volunteers",
  ],
  music: "Classical dance, a folk music group and the children's play.",
  signatureMoment: "Elders of the community are felicitated on stage before dinner.",
};

/** Three community concepts; the mela is named after the brief's festival when there is one. */
export function communityIdeas(input: PlanInput): Idea[] {
  const festival = festivalFrom(input);
  const mela: Idea = {
    ...UTSAV_MELA,
    name: festival ? `${festival} Utsav Mela` : "Neighbourhood Utsav Mela",
    food: [
      "Resident-run regional food stalls",
      isVegetarian(input)
        ? "Pure-veg chaat and sweets counters"
        : "Chaat, kebab and sweets counters",
      "Free drinking-water stations with steel tumblers",
    ],
  };
  return [mela, BAZAAR_FOR_A_CAUSE, CULTURAL_EVENING];
}
