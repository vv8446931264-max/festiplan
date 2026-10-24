import type { AiPlan, Idea, PlanInput } from "@/lib/contracts";
import { idea, isVegetarian, task, tip, vendor, weight } from "./shared";

function otherIdeas(input: PlanInput): Idea[] {
  const veg = isVegetarian(input);
  return [
    idea(
      "Warm Courtyard Gathering",
      "An easy, welcoming get-together in an open courtyard or terrace with fairy lights, floor seating and food that keeps coming.",
      ["#FFBF02", "#E9500E", "#FFEDD7", "#8FA36A"],
      ["Fairy lights strung overhead", "Floor seating with rugs and bolsters", "Marigold and mango-leaf toran at the entrance"],
      ["Live chaat counter", veg ? "Paneer and seasonal sabzi starters" : "Tandoori starters with veg options", "Kulfi and paan station"],
      "A curated playlist of old and new Hindi favourites with an antakshari round.",
      "A short toast where the hosts thank each guest group by name.",
    ),
    idea(
      "Elegant Evening Soirée",
      "A polished evening with a defined dress code, soft lighting and a seated dinner, suited to anniversaries, retirements and milestone celebrations.",
      ["#2F3A56", "#C9A227", "#F7F3EA", "#A23BC4"],
      ["Low floral centrepieces", "Candle-lit long tables", "A photo wall with memories through the years"],
      ["Plated regional tasting menu", "Mocktail bar with seasonal fruit", "Mithai platter to close"],
      "A live instrumental duo during dinner.",
      "A memory montage on a screen, followed by a cake or mithai moment.",
    ),
    idea(
      "Daytime Garden Brunch",
      "A relaxed daytime celebration in a garden or lawn, with shade, games for all ages and a long brunch table.",
      ["#8FA36A", "#C9D88F", "#F58A07", "#FFEDD7"],
      ["Shaded seating under canopies", "Lawn games corner", "Potted-plant centrepieces guests can take home"],
      ["Live dosa and appam counter", "Fresh juice and coconut-water bar", "Fruit and jaggery desserts"],
      "Acoustic covers and a light quiz about the hosts.",
      "Guests plant a sapling or sign a keepsake board before leaving.",
    ),
  ];
}

const WEIGHTS = [
  weight("venue", 24, "A comfortable space sized for the guest list."),
  weight("catering", 32, "Food and drinks are what guests remember most."),
  weight("decor", 14, "Lighting and a few strong décor touches set the mood."),
  weight("entertainment", 10, "Music or a live act keeps the energy up."),
  weight("photography", 8, "Photos to share after the event."),
  weight("invitations", 3, "Digital invitations with RSVP tracking."),
  weight("gifts", 4, "Small favours or return gifts."),
  weight("misc", 5, "Supplies, tips for staff and last-minute needs."),
];

const TASKS = [
  task("define-goals", "Agree the purpose, format and guest list", "admin", 12, 3),
  task("set-budget", "Set budget priorities for each category", "admin", 12, 2, ["define-goals"]),
  task("book-venue", "Shortlist, visit and book the venue", "venue", 10, 7, ["set-budget"]),
  task("book-caterer", "Hold a tasting and book the caterer", "catering", 8, 7, ["book-venue"]),
  task("send-save-dates", "Send save-the-dates", "invitations", 8, 2, ["define-goals"]),
  task("plan-decor", "Plan the décor and lighting with the venue", "decor", 6, 7, ["book-venue"]),
  task("book-entertainment", "Book music or a live act", "entertainment", 6, 5, ["book-venue"]),
  task("book-photographer", "Book a photographer", "photography", 6, 3),
  task("send-invitations", "Send invitations with an RSVP date", "invitations", 4, 2, ["send-save-dates"]),
  task("order-favours", "Order favours or return gifts", "gifts", 3, 7),
  task("plan-transport", "Arrange parking or transport for guests who need it", "transport", 2, 3, ["book-venue"]),
  task("confirm-headcount", "Confirm the headcount with venue and caterer", "catering", 1, 2, ["send-invitations", "book-caterer"]),
  task("run-sheet", "Write the run-sheet and share it with helpers", "admin", 1, 2, ["confirm-headcount"]),
  task("pack-kit", "Pack an event kit: tape, scissors, first aid, chargers", "misc", 0, 1),
  task("thank-guests", "Send thank-you messages and share photos", "invitations", 0, 3, ["book-photographer"]),
];

const VENDORS = [
  vendor("venue", 10, ["What is included in the hire — chairs, power backup, staff?", "What are the start and end times?"], ["No written cancellation terms"]),
  vendor("catering", 8, ["Can we do a tasting?", "How do you handle extra guests on the day?"], ["No itemised quote"]),
  vendor("photography", 6, ["Can we see a full event gallery?", "When will we receive the photos?"], ["No delivery date in writing"]),
  vendor("entertainment", 6, ["What sound equipment do you bring?", "Can you share a recent performance video?"], ["Unclear who will actually perform"]),
];

const TIPS = [
  tip("savings", "Weekday or off-season dates often cut venue hire significantly — ask venues for their quiet days."),
  tip("sustainability", "Use digital invitations and ask the caterer for steel or areca-leaf plates instead of plastic."),
  tip("accessibility", "Check step-free access and a nearby accessible toilet before you book the venue."),
];

/** Deterministic template plan for any other celebration. */
export function otherPlan(input: PlanInput): AiPlan {
  return {
    summary: `A celebration for ${input.guests} guests in ${input.city}: settle the format and venue first, then food, décor and entertainment, and finish with invitations and a clear run-sheet.`,
    ideas: otherIdeas(input),
    budgetWeights: structuredClone(WEIGHTS),
    tasks: structuredClone(TASKS),
    vendors: structuredClone(VENDORS),
    tips: structuredClone(TIPS),
  };
}
