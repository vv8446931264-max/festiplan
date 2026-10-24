import type { Plan } from "@/lib/contracts";

/** Persistence for plans. Implementations: `MemoryStore` (dev/test) and `FirestoreStore`. */
export interface PlanStore {
  /** Stores a new plan; rejects if a plan with the same id already exists. */
  create(plan: Plan): Promise<void>;
  /** Returns the plan, or null when it does not exist. */
  get(id: string): Promise<Plan | null>;
  /** Replaces an existing plan. */
  update(plan: Plan): Promise<void>;
}

/** Which store backs this process, for `/api/health`. */
export type StoreKind = "firestore" | "memory";
