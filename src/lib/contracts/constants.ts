/** Closed vocabularies and hard limits shared by the client, the server and the engine. */

export const EVENT_TYPES = ["wedding", "birthday", "community", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const LANGS = ["en", "hi", "bn", "ta", "te", "mr", "kn", "gu"] as const;
export type Lang = (typeof LANGS)[number];

export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "decor",
  "photography",
  "entertainment",
  "attire",
  "invitations",
  "gifts",
  "transport",
  "misc",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const TASK_CATEGORIES = [...BUDGET_CATEGORIES, "admin"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const PHASES = ["6m+", "3-6m", "1-3m", "2-4w", "final-week", "day-of"] as const;
export type Phase = (typeof PHASES)[number];

export const TIP_KINDS = ["sustainability", "accessibility", "culture", "savings"] as const;
export type TipKind = (typeof TIP_KINDS)[number];

/** Input and payload limits. Every number here is enforced by a schema or a guard. */
export const LIMITS = {
  titleMax: 80,
  cityMin: 2,
  cityMax: 60,
  guestsMin: 1,
  guestsMax: 5000,
  budgetMin: 1_000,
  budgetMax: 500_000_000,
  vibeMax: 600,
  constraintsMax: 10,
  constraintMax: 40,
  questionMax: 500,
  maxYearsAhead: 3,
  planBodyBytes: 8 * 1024,
  patchBodyBytes: 16 * 1024,
  refineBodyBytes: 2 * 1024,
  vendorBodyBytes: 1024,
} as const;

/** Share of the total budget held back as contingency, in percent. */
export const CONTINGENCY_PERCENT = 10;

/** Plans expire (Firestore TTL) this many days after creation. */
export const PLAN_TTL_DAYS = 180;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community",
  other: "Something else",
};

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  bn: "বাংলা (Bengali)",
  ta: "தமிழ் (Tamil)",
  te: "తెలుగు (Telugu)",
  mr: "मराठी (Marathi)",
  kn: "ಕನ್ನಡ (Kannada)",
  gu: "ગુજરાતી (Gujarati)",
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  venue: "Venue",
  catering: "Catering",
  decor: "Décor",
  photography: "Photography",
  entertainment: "Entertainment",
  attire: "Attire",
  invitations: "Invitations",
  gifts: "Gifts & favours",
  transport: "Transport",
  misc: "Miscellaneous",
  admin: "Admin",
};

export const PHASE_LABELS: Record<Phase, string> = {
  "6m+": "Six months or more",
  "3-6m": "Three to six months",
  "1-3m": "One to three months",
  "2-4w": "Two to four weeks",
  "final-week": "Final week",
  "day-of": "On the day",
};
