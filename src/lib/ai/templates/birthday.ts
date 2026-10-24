import type { AiPlan, Idea, PlanInput } from "@/lib/contracts";
import { briefText, idea, isVegetarian, task, tip, vendor, weight } from "./shared";

/** Reads an age from the title or vibe ("7th birthday", "turning 40", "5 years"). */
export function ageFrom(input: PlanInput): number | null {
  const text = briefText(input);
  const match =
    /\bturning\s+(\d{1,3})\b/.exec(text) ??
    /\b(\d{1,3})(?:st|nd|rd|th)\s+(?:birthday|bday)/.exec(text) ??
    /\b(\d{1,3})\s*(?:years?|yrs?)(?:\s+old)?\b/.exec(text);
  if (!match) return null;
  const age = Number(match[1]);
  return age >= 1 && age <= 110 ? age : null;
}

/** True when the party is for a child (age ≤ 12, or the brief clearly says so). */
export function isKidsParty(input: PlanInput): boolean {
  const age = ageFrom(input);
  if (age !== null) return age <= 12;
  return /\b(kids?|child|children|son|daughter|toddler|school friends)\b/.test(briefText(input));
}

type Theme = { match: RegExp; word: string; name: string; palette: string[]; decor: string[] };

const JUNGLE: Theme = { match: /\b(jungle|safari|animal)/, word: "jungle", name: "Jungle Safari Adventure", palette: ["#33691E", "#FFB300", "#8D6E63", "#C5E1A5"], decor: ["Leafy entrance tunnel", "Animal-print table runners", "Binocular scavenger hunt"] };

const THEMES: Theme[] = [
  { match: /\bdino/, word: "dinosaur", name: "Dino Discovery Dig", palette: ["#2E7D32", "#F9A825", "#6D4C41", "#AED581"], decor: ["Fossil sand-pit dig with toy bones", "Giant footprint trail from the gate", "Volcano cake table with dry-ice mist"] },
  { match: /\b(space|rocket|astronaut|planet)/, word: "space", name: "Space Explorers Mission", palette: ["#1A237E", "#7B6BE0", "#FFD54F", "#ECEFF1"], decor: ["Rocket photo booth", "Glow-in-the-dark star ceiling", "Planet balloon mobiles"] },
  { match: /\bunicorn/, word: "unicorn", name: "Rainbow Unicorn Meadow", palette: ["#F8BBD0", "#B39DDB", "#81D4FA", "#FFF59D"], decor: ["Pastel balloon rainbow arch", "Glitter horn-making table", "Cloud-shaped cushions"] },
  { match: /\bsuper ?hero/, word: "superhero", name: "Superhero Training Academy", palette: ["#D32F2F", "#1976D2", "#FBC02D", "#212121"], decor: ["Obstacle-course hero trials", "City-skyline backdrop", "Cape and mask station"] },
  JUNGLE,
  { match: /\bcricket/, word: "cricket", name: "Backyard Cricket Cup", palette: ["#1B5E20", "#FFFFFF", "#1565C0", "#FFC107"], decor: ["Mini pitch with stumps", "Scoreboard welcome sign", "Team jerseys with names"] },
];

/** "1st", "2nd", "3rd", "11th", "21st" … */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

function kidsIdeas(input: PlanInput): Idea[] {
  const veg = isVegetarian(input);
  const text = briefText(input);
  const theme = THEMES.find((t) => t.match.test(text)) ?? JUNGLE;
  const kidsFood = ["Mini pav bhaji and cheese-corn sliders", "Fruit skewers and rainbow sandwiches", veg ? "Eggless theme cake with a paneer-roll counter" : "Theme cake with chicken and paneer rolls"];
  return [
    idea(theme.name, `A hands-on ${theme.word} world where every activity is part of the story, with a calm corner for younger children and comfortable seating for parents.`, theme.palette, theme.decor, kidsFood, "An upbeat kids' playlist, a freeze-dance round and a short magic or puppet show.", "The birthday child leads the final quest and finds the cake as the treasure."),
    idea("Little Chefs Carnival", "A carnival of food stations where children decorate their own cupcakes and pizzas while parents relax at a chai counter.", ["#FF7043", "#FFCA28", "#26A69A", "#FFF8E1"], ["Striped carnival stall fronts", "Chef hats and aprons for every child", "Bunting in bright primaries"], ["Decorate-your-own cupcakes", "Mini pizzas on whole-wheat bases", "Masala chai and samosas for adults"], "Carnival tunes with a tambola round for the adults.", "Every child walks home with the apron and recipe card they made."),
    idea("Art Jam in the Park", "An outdoor art party with giant canvases, chalk murals and clay modelling, ideal for mixed ages and easy to clean up.", ["#8FA36A", "#F58A07", "#CD197D", "#FFEDD7"], ["Giant collaborative canvas", "Clothes-line gallery of the kids' artwork", "Picnic mats under shade"], ["Lemonade and nimbu-pani jars", "Vada pav and fruit chaat", "Jaggery-sweetened laddoos"], "Acoustic sing-along with a ukulele player.", "The group mural is signed by every guest and gifted to the birthday child."),
  ];
}

function adultIdeas(input: PlanInput): Idea[] {
  const veg = isVegetarian(input);
  return [
    idea("Retro Bollywood Night", "A dress-up evening celebrating classic Hindi cinema, with a poster-wall entrance and a dance floor that keeps going.", ["#B71C1C", "#FFBF02", "#212121", "#FFEDD7"], ["Hand-painted film-poster backdrop", "Marquee light letters", "Vintage gramophone props"], ["Bombay street-food counters", veg ? "Paneer tikka and dahi kebabs" : "Seekh kebabs and paneer tikka", "Kulfi falooda bar"], "A DJ spinning seventies to nineties classics with an antakshari break.", "A short video montage of the guest of honour's life, set to their favourite song."),
    idea("Rooftop Chai & Jazz", "An intimate rooftop gathering with fairy lights, low seating and live jazz, built around good conversation.", ["#2F3A56", "#C9A227", "#F7F3EA", "#A23BC4"], ["Fairy-light canopy", "Low floor seating with rugs and bolsters", "Lantern-lit tables"], ["Small-plates menu of regional favourites", "Masala chai and filter coffee bar", "Mocktail station with seasonal fruit"], "A live jazz trio for the evening.", "Guests write wishes on cards that are bound into a keepsake book."),
    idea("Garden Brunch & Games", "A relaxed daytime brunch in a garden with board games, a kids' corner for guests' children and plenty of shade.", ["#8FA36A", "#FFEDD7", "#F58A07", "#C9D88F"], ["Picnic tables with block-print cloths", "Giant Jenga and carrom corner", "Potted-herb centrepieces as favours"], ["Live dosa and appam counter", "Fresh juice bar", "Eggless celebration cake"], "A soft acoustic playlist and a quiz about the guest of honour.", "A toast from the oldest and youngest guests together."),
  ];
}

const WEIGHTS = (kids: boolean) => [
  weight("venue", kids ? 18 : 22, "A safe, easy-to-reach space sized for the guest list."),
  weight("catering", kids ? 24 : 30, "Separate kid-friendly and adult menus, plus the cake."),
  weight("decor", kids ? 16 : 12, "The theme backdrop and photo corner carry the look."),
  weight("entertainment", kids ? 18 : 16, kids ? "An entertainer and planned games keep children engaged." : "Music or a live act sets the mood."),
  weight("photography", 6, "Candid photos of the cake-cutting and games."),
  weight("gifts", kids ? 10 : 4, "Return gifts or favours for every guest."),
  weight("invitations", 2, "Digital invitations with RSVP tracking."),
  weight("misc", kids ? 6 : 8, "First aid, helpers, candles and last-minute supplies."),
];

const TASKS = [
  task("guest-list", "Draft the guest list and split it into kids and adults", "invitations", 8, 3),
  task("pick-theme", "Pick the theme with the guest of honour", "admin", 8, 3),
  task("book-venue", "Book the venue or society clubhouse", "venue", 7, 5, ["guest-list"]),
  task("send-invites", "Send digital invitations with an RSVP date", "invitations", 6, 2, ["guest-list", "pick-theme"]),
  task("book-entertainer", "Book the entertainer or live act", "entertainment", 6, 3, ["book-venue"]),
  task("plan-menu", "Plan separate kids' and adults' menus with the caterer", "catering", 5, 4, ["book-venue"]),
  task("order-cake", "Order the theme cake (check eggless and allergy needs)", "catering", 3, 2, ["pick-theme"]),
  task("plan-decor", "Plan the backdrop, balloons and photo corner", "decor", 4, 5, ["pick-theme", "book-venue"]),
  task("plan-activities", "Plan age-appropriate games and a quiet corner", "entertainment", 4, 5, ["pick-theme"]),
  task("order-return-gifts", "Order return gifts or favours", "gifts", 4, 7, ["guest-list"]),
  task("book-photographer", "Book a photographer or assign a family member", "photography", 4, 2),
  task("collect-allergies", "Collect food allergies and dietary needs from RSVPs", "catering", 2, 3, ["send-invites"]),
  task("arrange-helpers", "Arrange helpers for supervision, food and games", "admin", 2, 3, ["plan-activities"]),
  task("confirm-headcount", "Confirm the headcount with the venue and caterer", "catering", 1, 1, ["collect-allergies"]),
  task("pack-party-kit", "Pack candles, lighter, knife, first aid and spare batteries", "misc", 0, 1),
  task("day-schedule", "Share the party run-sheet with helpers", "admin", 0, 1, ["arrange-helpers"]),
  task("thank-you-notes", "Send thank-you messages and share photos", "invitations", 0, 2, ["book-photographer"]),
];

const VENDORS = [
  vendor("venue", 6, ["Is the space child-safe — no open water, sharp edges or loose wiring?", "What time can we start setting up?", "Is there a power backup?"], ["No written cancellation terms"]),
  vendor("catering", 4, ["Can you make a separate kids' menu with mild spice?", "Is the cake eggless and nut-free on request?"], ["Cannot list ingredients for allergy checks"]),
  vendor("entertainment", 4, ["Can we see a video of a recent party?", "Is the act right for the guests' ages?"], ["Late confirmation of the performer's name"]),
  vendor("decor", 3, ["Are the balloons and props reusable or biodegradable?", "How long does set-up take?"], ["Charges extra for take-down without saying so"]),
  vendor("photography", 4, ["When will we receive the edited photos?", "Will you cover both the kids' and adults' areas?"], ["No portfolio of event work"]),
];

const TIPS = [
  tip("savings", "A society clubhouse or terrace is often far cheaper than a party hall and is easier for neighbours' families to reach."),
  tip("sustainability", "Choose return gifts children keep using — books, seed kits or art sets — instead of plastic toys."),
  tip("accessibility", "Keep a quiet corner with soft seating for children who get overwhelmed, and an allergy list with the food helpers."),
  tip("culture", "Make space for family traditions such as an aarti or tilak by the grandparents before the cake-cutting."),
];

/** Deterministic template plan for birthdays: age-aware ideas, kids/adult split, return gifts. */
export function birthdayPlan(input: PlanInput): AiPlan {
  const kids = isKidsParty(input);
  const age = ageFrom(input);
  const who = age !== null ? `${ordinal(age)} birthday` : kids ? "children's birthday" : "birthday";
  return {
    summary: `A ${who} for ${input.guests} guests in ${input.city}: pick the theme, book the venue and entertainment early, and plan separate kids' and adults' food plus return gifts.`,
    ideas: kids ? kidsIdeas(input) : adultIdeas(input),
    budgetWeights: WEIGHTS(kids),
    tasks: structuredClone(TASKS),
    vendors: structuredClone(VENDORS),
    tips: structuredClone(TIPS),
  };
}
