import type { AiTask } from "@/lib/contracts";
import { task } from "../shared";

/** Every wedding function from haldi to reception, counted back from the muhurat. */
export const WEDDING_TASKS: AiTask[] = [
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
