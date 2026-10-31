import type { AiTask } from "@/lib/contracts";
import { task } from "../shared";

/** A birthday from guest list to thank-you notes, with the kids/adults split built in. */
export const BIRTHDAY_TASKS: AiTask[] = [
  task("guest-list", "Draft the guest list and split it into kids and adults", "invitations", 8, 3),
  task("pick-theme", "Pick the theme with the guest of honour", "admin", 8, 3),
  task("book-venue", "Book the venue or society clubhouse", "venue", 7, 5, ["guest-list"]),
  task("send-invites", "Send digital invitations with an RSVP date", "invitations", 6, 2, [
    "guest-list",
    "pick-theme",
  ]),
  task("book-entertainer", "Book the entertainer or live act", "entertainment", 6, 3, [
    "book-venue",
  ]),
  task("plan-menu", "Plan separate kids' and adults' menus with the caterer", "catering", 5, 4, [
    "book-venue",
  ]),
  task("order-cake", "Order the theme cake (check eggless and allergy needs)", "catering", 3, 2, [
    "pick-theme",
  ]),
  task("plan-decor", "Plan the backdrop, balloons and photo corner", "decor", 4, 5, [
    "pick-theme",
    "book-venue",
  ]),
  task("plan-activities", "Plan age-appropriate games and a quiet corner", "entertainment", 4, 5, [
    "pick-theme",
  ]),
  task("order-return-gifts", "Order return gifts or favours", "gifts", 4, 7, ["guest-list"]),
  task("book-photographer", "Book a photographer or assign a family member", "photography", 4, 2),
  task(
    "collect-allergies",
    "Collect food allergies and dietary needs from RSVPs",
    "catering",
    2,
    3,
    ["send-invites"],
  ),
  task("arrange-helpers", "Arrange helpers for supervision, food and games", "admin", 2, 3, [
    "plan-activities",
  ]),
  task("confirm-headcount", "Confirm the headcount with the venue and caterer", "catering", 1, 1, [
    "collect-allergies",
  ]),
  task(
    "pack-party-kit",
    "Pack candles, lighter, knife, first aid and spare batteries",
    "misc",
    0,
    1,
  ),
  task("day-schedule", "Share the party run-sheet with helpers", "admin", 0, 1, [
    "arrange-helpers",
  ]),
  task("thank-you-notes", "Send thank-you messages and share photos", "invitations", 0, 2, [
    "book-photographer",
  ]),
];
