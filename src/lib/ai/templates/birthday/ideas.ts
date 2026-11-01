import type { Idea, PlanInput } from "@/lib/contracts";
import { isVegetarian } from "@/lib/ai/templates/shared";
import type { Concept } from "@/lib/ai/templates/shared";
import { themeFor } from "./themes";
import type { Theme } from "./themes";

const LITTLE_CHEFS: Idea = {
  name: "Little Chefs Carnival",
  concept:
    "A carnival of food stations where children decorate their own cupcakes and pizzas while parents relax at a chai counter.",
  palette: ["#FF7043", "#FFCA28", "#26A69A", "#FFF8E1"],
  decor: [
    "Striped carnival stall fronts",
    "Chef hats and aprons for every child",
    "Bunting in bright primaries",
  ],
  food: [
    "Decorate-your-own cupcakes",
    "Mini pizzas on whole-wheat bases",
    "Masala chai and samosas for adults",
  ],
  music: "Carnival tunes with a tambola round for the adults.",
  signatureMoment: "Every child walks home with the apron and recipe card they made.",
};

const ART_JAM: Idea = {
  name: "Art Jam in the Park",
  concept:
    "An outdoor art party with giant canvases, chalk murals and clay modelling, ideal for mixed ages and easy to clean up.",
  palette: ["#8FA36A", "#F58A07", "#CD197D", "#FFEDD7"],
  decor: [
    "Giant collaborative canvas",
    "Clothes-line gallery of the kids' artwork",
    "Picnic mats under shade",
  ],
  food: ["Lemonade and nimbu-pani jars", "Vada pav and fruit chaat", "Jaggery-sweetened laddoos"],
  music: "Acoustic sing-along with a ukulele player.",
  signatureMoment: "The group mural is signed by every guest and gifted to the birthday child.",
};

const RETRO_BOLLYWOOD: Concept = {
  name: "Retro Bollywood Night",
  concept:
    "A dress-up evening celebrating classic Hindi cinema, with a poster-wall entrance and a dance floor that keeps going.",
  palette: ["#B71C1C", "#FFBF02", "#212121", "#FFEDD7"],
  decor: ["Hand-painted film-poster backdrop", "Marquee light letters", "Vintage gramophone props"],
  music: "A DJ spinning seventies to nineties classics with an antakshari break.",
  signatureMoment:
    "A short video montage of the guest of honour's life, set to their favourite song.",
};

const ROOFTOP_JAZZ: Idea = {
  name: "Rooftop Chai & Jazz",
  concept:
    "An intimate rooftop gathering with fairy lights, low seating and live jazz, built around good conversation.",
  palette: ["#2F3A56", "#C9A227", "#F7F3EA", "#A23BC4"],
  decor: ["Fairy-light canopy", "Low floor seating with rugs and bolsters", "Lantern-lit tables"],
  food: [
    "Small-plates menu of regional favourites",
    "Masala chai and filter coffee bar",
    "Mocktail station with seasonal fruit",
  ],
  music: "A live jazz trio for the evening.",
  signatureMoment: "Guests write wishes on cards that are bound into a keepsake book.",
};

const GARDEN_BRUNCH: Idea = {
  name: "Garden Brunch & Games",
  concept:
    "A relaxed daytime brunch in a garden with board games, a kids' corner for guests' children and plenty of shade.",
  palette: ["#8FA36A", "#FFEDD7", "#F58A07", "#C9D88F"],
  decor: [
    "Picnic tables with block-print cloths",
    "Giant Jenga and carrom corner",
    "Potted-herb centrepieces as favours",
  ],
  food: ["Live dosa and appam counter", "Fresh juice bar", "Eggless celebration cake"],
  music: "A soft acoustic playlist and a quiz about the guest of honour.",
  signatureMoment: "A toast from the oldest and youngest guests together.",
};

/** The themed adventure built around the brief's theme. */
function themedAdventure(theme: Theme, vegetarian: boolean): Idea {
  return {
    name: theme.name,
    concept: `A hands-on ${theme.word} world where every activity is part of the story, with a calm corner for younger children and comfortable seating for parents.`,
    palette: theme.palette,
    decor: theme.decor,
    food: [
      "Mini pav bhaji and cheese-corn sliders",
      "Fruit skewers and rainbow sandwiches",
      vegetarian
        ? "Eggless theme cake with a paneer-roll counter"
        : "Theme cake with chicken and paneer rolls",
    ],
    music: "An upbeat kids' playlist, a freeze-dance round and a short magic or puppet show.",
    signatureMoment: "The birthday child leads the final quest and finds the cake as the treasure.",
  };
}

/** Three children's party concepts: the brief's theme first, then two crowd-pleasers. */
export function kidsIdeas(input: PlanInput): Idea[] {
  return [themedAdventure(themeFor(input), isVegetarian(input)), LITTLE_CHEFS, ART_JAM];
}

/** Three concepts for an adult or milestone birthday. */
export function adultIdeas(input: PlanInput): Idea[] {
  const bollywoodMenu = [
    "Bombay street-food counters",
    isVegetarian(input) ? "Paneer tikka and dahi kebabs" : "Seekh kebabs and paneer tikka",
    "Kulfi falooda bar",
  ];
  return [{ ...RETRO_BOLLYWOOD, food: bollywoodMenu }, ROOFTOP_JAZZ, GARDEN_BRUNCH];
}
