import type { AiTask } from "@/lib/contracts";
import { task } from "@/lib/ai/templates/shared";

/** A community event from committee to accounts: permits, sponsors, stalls, stage and safety. */
export const COMMUNITY_TASKS: AiTask[] = [
  task("form-committee", "Form the organising committee and assign leads", "admin", 12, 5),
  task("set-budget", "Agree the budget, sponsor targets and an accounts process", "admin", 11, 5, [
    "form-committee",
  ]),
  task("book-grounds", "Book the grounds or hall and confirm power supply", "venue", 10, 5, [
    "form-committee",
  ]),
  task("apply-permits", "Apply for police, municipal and loudspeaker permissions", "admin", 9, 21, [
    "book-grounds",
  ]),
  task("sponsor-tiers", "Prepare sponsor tiers and approach local sponsors", "misc", 9, 21, [
    "set-budget",
  ]),
  task("recruit-volunteers", "Recruit volunteers and draw up the duty roster", "admin", 8, 14, [
    "form-committee",
  ]),
  task("allocate-stalls", "Invite stall applications and allocate the layout", "venue", 7, 14, [
    "book-grounds",
  ]),
  task("book-stage-sound", "Book the stage, sound and lighting", "entertainment", 7, 5, [
    "book-grounds",
  ]),
  task("plan-programme", "Plan the cultural programme and hold auditions", "entertainment", 6, 21, [
    "book-stage-sound",
  ]),
  task(
    "food-safety",
    "Brief food stalls on hygiene, water and food-safety registration",
    "catering",
    5,
    7,
    ["allocate-stalls"],
  ),
  task(
    "publicity",
    "Design posters and banners and announce on resident groups",
    "invitations",
    5,
    7,
    ["plan-programme"],
  ),
  task(
    "safety-plan",
    "Plan crowd flow, fire extinguishers, first aid and lost-child desk",
    "misc",
    4,
    7,
    ["apply-permits", "allocate-stalls"],
  ),
  task("book-generator", "Book a generator and a licensed electrician", "venue", 4, 3, [
    "book-stage-sound",
  ]),
  task("waste-plan", "Arrange segregated bins and a waste pickup", "misc", 3, 5, [
    "allocate-stalls",
  ]),
  task("order-prizes", "Order competition prizes and volunteer tokens", "gifts", 3, 5),
  task("plan-decor", "Plan lighting, stall fronts and the stage backdrop", "decor", 3, 7, [
    "allocate-stalls",
  ]),
  task(
    "volunteer-briefing",
    "Brief volunteers with the run-sheet and emergency contacts",
    "admin",
    1,
    1,
    ["recruit-volunteers", "safety-plan"],
  ),
  task("rehearsal", "Hold a stage and sound rehearsal", "entertainment", 0, 1, ["plan-programme"]),
  task(
    "accounts-report",
    "Share the spending report with the committee and residents",
    "admin",
    0,
    7,
    ["set-budget"],
  ),
];
