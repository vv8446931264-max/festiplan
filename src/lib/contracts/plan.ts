import type { BudgetCategory, Phase, TaskCategory } from "./constants";
import type { AiPlan } from "./ai";
import type { PlanInput } from "./input";

/** One budget line, computed by `src/lib/engine/budget.ts`. Amounts are whole rupees. */
export type Allocation = {
  category: BudgetCategory;
  amountINR: number;
  /** Share of the total budget (contingency included), one decimal place. */
  percent: number;
  perGuestINR: number;
  rationale: string;
  locked: boolean;
  actualINR: number | null;
};

/** A dated task, computed by `src/lib/engine/timeline.ts`. Dates are ISO `YYYY-MM-DD`. */
export type ScheduledTask = {
  id: string;
  title: string;
  category: TaskCategory;
  start: string;
  due: string;
  phase: Phase;
  done: boolean;
  overdue: boolean;
  /** True when the ideal start date had already passed and was clamped to today. */
  crunch: boolean;
};

/** One vendor checklist row, computed by `src/lib/engine/checklist.ts`. */
export type VendorItem = {
  category: BudgetCategory;
  bookBy: string;
  questions: string[];
  redFlags: string[];
  done: boolean;
  overdue: boolean;
};

/** Where the ideas came from. "template" is always labelled in the UI. */
export type PlanSource = "gemini" | "template";

/** The persisted plan (Firestore `plans/{id}`). */
export type Plan = {
  id: string;
  input: PlanInput;
  ai: AiPlan;
  budget: Allocation[];
  contingencyINR: number;
  timeline: ScheduledTask[];
  vendors: VendorItem[];
  source: PlanSource;
  model: string;
  /** ISO date the schedule was computed against. */
  today: string;
  createdAt: string;
  updatedAt: string;
  expireAt: Date;
  editKeyHash: string;
};

/** What leaves the server: no edit-key hash, dates as strings. */
export type PublicPlan = Omit<Plan, "editKeyHash" | "expireAt"> & { expireAt: string };

/** A place returned by Grounding with Google Maps — never model-invented. */
export type Place = { title: string; uri: string };

/** Response of POST /api/vendors. */
export type VendorResult = {
  places: Place[];
  /** A plain Google Maps search link, always present as a fallback. */
  searchUrl: string;
  source: "maps" | "search";
};

/** Response of GET /api/health. */
export type Health = {
  status: "ok";
  ai: "vertex" | "gemini-api" | "template";
  store: "firestore" | "memory";
  model: string;
};
