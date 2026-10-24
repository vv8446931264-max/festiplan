import type { Plan } from "@/lib/contracts";

/** Persistence for plans. Implementations: `MemoryStore` (dev/test) and `FirestoreStore`. */
export interface PlanStore {
  /** Stores a new plan; rejects if a plan with the same id already exists. */
  create(plan: Plan): Promise<void>;
  /** Returns the plan, or null when it does not exist. */
  get(id: string): Promise<Plan | null>;
  /**
   * Atomically reads a plan (null when missing), lets `fn` decide, and writes `next`
   * when it is non-null — concurrent edits never overwrite each other.
   */
  mutate<T>(id: string, fn: Mutator<T>): Promise<T>;
}

/** Decides a read-modify-write: the plan to write (or null for no write) and a result. */
export type Mutator<T> = (plan: Plan | null) => { next: Plan | null; result: T };

/** Which store backs this process, for `/api/health`. */
export type StoreKind = "firestore" | "memory";
