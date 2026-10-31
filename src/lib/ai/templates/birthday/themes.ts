import type { PlanInput } from "@/lib/contracts";
import { briefText } from "../shared";

/** A kids' party theme: the brief words that pick it, and its look. */
export type Theme = {
  match: RegExp;
  word: string;
  name: string;
  palette: string[];
  decor: string[];
};

const JUNGLE: Theme = {
  match: /\b(jungle|safari|animal)/,
  word: "jungle",
  name: "Jungle Safari Adventure",
  palette: ["#33691E", "#FFB300", "#8D6E63", "#C5E1A5"],
  decor: ["Leafy entrance tunnel", "Animal-print table runners", "Binocular scavenger hunt"],
};

/** Themes in matching priority; the first whose pattern appears in the brief wins. */
const THEMES: Theme[] = [
  {
    match: /\bdino/,
    word: "dinosaur",
    name: "Dino Discovery Dig",
    palette: ["#2E7D32", "#F9A825", "#6D4C41", "#AED581"],
    decor: [
      "Fossil sand-pit dig with toy bones",
      "Giant footprint trail from the gate",
      "Volcano cake table with dry-ice mist",
    ],
  },
  {
    match: /\b(space|rocket|astronaut|planet)/,
    word: "space",
    name: "Space Explorers Mission",
    palette: ["#1A237E", "#7B6BE0", "#FFD54F", "#ECEFF1"],
    decor: ["Rocket photo booth", "Glow-in-the-dark star ceiling", "Planet balloon mobiles"],
  },
  {
    match: /\bunicorn/,
    word: "unicorn",
    name: "Rainbow Unicorn Meadow",
    palette: ["#F8BBD0", "#B39DDB", "#81D4FA", "#FFF59D"],
    decor: ["Pastel balloon rainbow arch", "Glitter horn-making table", "Cloud-shaped cushions"],
  },
  {
    match: /\bsuper ?hero/,
    word: "superhero",
    name: "Superhero Training Academy",
    palette: ["#D32F2F", "#1976D2", "#FBC02D", "#212121"],
    decor: ["Obstacle-course hero trials", "City-skyline backdrop", "Cape and mask station"],
  },
  JUNGLE,
  {
    match: /\bcricket/,
    word: "cricket",
    name: "Backyard Cricket Cup",
    palette: ["#1B5E20", "#FFFFFF", "#1565C0", "#FFC107"],
    decor: ["Mini pitch with stumps", "Scoreboard welcome sign", "Team jerseys with names"],
  },
];

/** The theme the brief asks for, or the jungle safari when it names none. */
export function themeFor(input: PlanInput): Theme {
  const text = briefText(input);
  return THEMES.find((theme) => theme.match.test(text)) ?? JUNGLE;
}
