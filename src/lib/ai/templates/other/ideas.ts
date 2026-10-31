import type { Idea, PlanInput } from "@/lib/contracts";
import { isVegetarian } from "../shared";
import type { Concept } from "../shared";

const WARM_COURTYARD: Concept = {
  name: "Warm Courtyard Gathering",
  concept:
    "An easy, welcoming get-together in an open courtyard or terrace with fairy lights, floor seating and food that keeps coming.",
  palette: ["#FFBF02", "#E9500E", "#FFEDD7", "#8FA36A"],
  decor: [
    "Fairy lights strung overhead",
    "Floor seating with rugs and bolsters",
    "Marigold and mango-leaf toran at the entrance",
  ],
  music: "A curated playlist of old and new Hindi favourites with an antakshari round.",
  signatureMoment: "A short toast where the hosts thank each guest group by name.",
};

const ELEGANT_SOIREE: Idea = {
  name: "Elegant Evening Soirée",
  concept:
    "A polished evening with a defined dress code, soft lighting and a seated dinner, suited to anniversaries, retirements and milestone celebrations.",
  palette: ["#2F3A56", "#C9A227", "#F7F3EA", "#A23BC4"],
  decor: [
    "Low floral centrepieces",
    "Candle-lit long tables",
    "A photo wall with memories through the years",
  ],
  food: [
    "Plated regional tasting menu",
    "Mocktail bar with seasonal fruit",
    "Mithai platter to close",
  ],
  music: "A live instrumental duo during dinner.",
  signatureMoment: "A memory montage on a screen, followed by a cake or mithai moment.",
};

const DAYTIME_BRUNCH: Idea = {
  name: "Daytime Garden Brunch",
  concept:
    "A relaxed daytime celebration in a garden or lawn, with shade, games for all ages and a long brunch table.",
  palette: ["#8FA36A", "#C9D88F", "#F58A07", "#FFEDD7"],
  decor: [
    "Shaded seating under canopies",
    "Lawn games corner",
    "Potted-plant centrepieces guests can take home",
  ],
  food: [
    "Live dosa and appam counter",
    "Fresh juice and coconut-water bar",
    "Fruit and jaggery desserts",
  ],
  music: "Acoustic covers and a light quiz about the hosts.",
  signatureMoment: "Guests plant a sapling or sign a keepsake board before leaving.",
};

/** Three concepts that suit any celebration, with a menu that respects dietary needs. */
export function otherIdeas(input: PlanInput): Idea[] {
  const courtyardMenu = [
    "Live chaat counter",
    isVegetarian(input)
      ? "Paneer and seasonal sabzi starters"
      : "Tandoori starters with veg options",
    "Kulfi and paan station",
  ];
  return [{ ...WARM_COURTYARD, food: courtyardMenu }, ELEGANT_SOIREE, DAYTIME_BRUNCH];
}
