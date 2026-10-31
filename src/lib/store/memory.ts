import type { Plan } from "@/lib/contracts";
import type { Mutator, PlanStore } from "./types";

/** Oldest plans are evicted past this many, so a dev server cannot grow without bound. */
const DEFAULT_MAX_PLANS = 5_000;

/**
 * Runs synchronous store work behind the async `PlanStore` contract, exactly like an `async`
 * function body: it runs immediately, and a throw becomes a rejection.
 */
function settle<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

/**
 * In-process plan store for development and tests. Plans are deep-cloned in and out,
 * so callers can never mutate stored state by accident. Expired plans read as missing.
 */
export class MemoryStore implements PlanStore {
  private readonly plans = new Map<string, Plan>();

  /**
   * @param now clock used to hide expired plans (injectable for tests)
   * @param maxPlans how many plans to keep before evicting the oldest
   */
  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxPlans = DEFAULT_MAX_PLANS,
  ) {}

  /** Stores a new plan; rejects when the id is taken. */
  create(plan: Plan): Promise<void> {
    return settle(() => {
      if (this.plans.has(plan.id)) throw new Error("Plan already exists");
      this.plans.set(plan.id, structuredClone(plan));
      this.evictOldest();
    });
  }

  /** Returns a copy of the plan, or null when missing or past `expireAt`. */
  get(id: string): Promise<Plan | null> {
    return settle(() => this.read(id));
  }

  /** Read-modify-write with no await in between, so it is atomic within the process. */
  mutate<T>(id: string, decide: Mutator<T>): Promise<T> {
    return settle(() => {
      const { next, result } = decide(this.read(id));
      if (next) this.plans.set(id, structuredClone(next));
      return result;
    });
  }

  /** Number of stored plans (tests). */
  get size(): number {
    return this.plans.size;
  }

  private read(id: string): Plan | null {
    const plan = this.plans.get(id);
    if (!plan) return null;
    if (plan.expireAt.getTime() <= this.now()) {
      this.plans.delete(id);
      return null;
    }
    return structuredClone(plan);
  }

  /** Maps iterate in insertion order, so the first key is the oldest plan. */
  private evictOldest(): void {
    for (const id of this.plans.keys()) {
      if (this.plans.size <= this.maxPlans) return;
      this.plans.delete(id);
    }
  }
}
