import type { AiTask } from "@/lib/contracts";
import { task } from "../shared";

/** A general celebration: format and venue first, then food, décor and invitations. */
export const OTHER_TASKS: AiTask[] = [
  task("define-goals", "Agree the purpose, format and guest list", "admin", 12, 3),
  task("set-budget", "Set budget priorities for each category", "admin", 12, 2, ["define-goals"]),
  task("book-venue", "Shortlist, visit and book the venue", "venue", 10, 7, ["set-budget"]),
  task("book-caterer", "Hold a tasting and book the caterer", "catering", 8, 7, ["book-venue"]),
  task("send-save-dates", "Send save-the-dates", "invitations", 8, 2, ["define-goals"]),
  task("plan-decor", "Plan the décor and lighting with the venue", "decor", 6, 7, ["book-venue"]),
  task("book-entertainment", "Book music or a live act", "entertainment", 6, 5, ["book-venue"]),
  task("book-photographer", "Book a photographer", "photography", 6, 3),
  task("send-invitations", "Send invitations with an RSVP date", "invitations", 4, 2, [
    "send-save-dates",
  ]),
  task("order-favours", "Order favours or return gifts", "gifts", 3, 7),
  task("plan-transport", "Arrange parking or transport for guests who need it", "transport", 2, 3, [
    "book-venue",
  ]),
  task("confirm-headcount", "Confirm the headcount with venue and caterer", "catering", 1, 2, [
    "send-invitations",
    "book-caterer",
  ]),
  task("run-sheet", "Write the run-sheet and share it with helpers", "admin", 1, 2, [
    "confirm-headcount",
  ]),
  task("pack-kit", "Pack an event kit: tape, scissors, first aid, chargers", "misc", 0, 1),
  task("thank-guests", "Send thank-you messages and share photos", "invitations", 0, 3, [
    "book-photographer",
  ]),
];
