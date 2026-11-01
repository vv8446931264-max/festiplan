import type { PlanInput } from "@/lib/contracts";
import { addDays } from "@/lib/engine";

/** Constraint tags offered as toggles in the brief form. */
export const CONSTRAINT_OPTIONS = [
  "Vegetarian menu",
  "Jain food",
  "Nut-free",
  "Alcohol-free",
  "Wheelchair access",
  "Elderly guests",
  "Kid-friendly",
  "Eco-friendly",
  "Budget-conscious",
  "Outdoor venue",
] as const;

/** A one-tap demo brief; the event date is set relative to today when it is used. */
export type Preset = {
  id: "sangeet" | "birthday" | "mela";
  label: string;
  daysAhead: number;
  input: Omit<PlanInput, "eventDate">;
};

/** The three demo briefs from docs/SPEC.md §3 — one per event type. */
export const PRESETS: readonly Preset[] = [
  {
    id: "sangeet",
    label: "Priya's sangeet · Jaipur · 180 guests · ₹12L",
    daysAhead: 150,
    input: {
      eventType: "wedding",
      title: "Riya's sangeet",
      city: "Jaipur",
      guests: 180,
      budgetINR: 1_200_000,
      vibe: "My sister Riya's sangeet. Rajasthani folk meets Bollywood — marigolds, mirror-work, a family dance-off between both sides. Cousins flying in from Pune and Delhi. It should feel personal, not Pinterest-generic.",
      constraints: ["Vegetarian menu", "Elderly guests"],
      language: "en",
    },
  },
  {
    id: "birthday",
    label: "Rahul's dino birthday · Bengaluru · 30 kids · ₹40K",
    daysAhead: 14,
    input: {
      eventType: "birthday",
      title: "Aarav turns 7",
      city: "Bengaluru",
      guests: 30,
      budgetINR: 40_000,
      vibe: "My son Aarav turns 7 and he is obsessed with dinosaurs. 30 kids from his class plus a few parents. I have two weekends to pull it off, and I need an indoor backup in case it rains.",
      constraints: ["Kid-friendly", "Nut-free"],
      language: "en",
    },
  },
  {
    id: "mela",
    label: "Meera's Diwali mela · Pune · 400 residents · ₹2.5L",
    daysAhead: 45,
    input: {
      eventType: "community",
      title: "Sunshine Society Diwali Mela",
      city: "Pune",
      guests: 400,
      budgetINR: 250_000,
      vibe: "Housing-society Diwali mela for 400 residents. Food stalls run by residents, a small stage for the kids' performances, a rangoli contest. Pooled funds — I have to report every rupee to the committee.",
      constraints: ["Eco-friendly", "Wheelchair access", "Alcohol-free"],
      language: "en",
    },
  },
];

/** Builds a complete PlanInput for a preset, dated `daysAhead` days after `today` (ISO). */
export function presetInput(preset: Preset, today: string): PlanInput {
  return { ...preset.input, eventDate: addDays(today, preset.daysAhead) };
}
