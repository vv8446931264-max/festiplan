import type { Plan } from "@/lib/contracts";
import type { Mutator, PlanStore } from "./types";

/**
 * In-process plan store for development and tests. Plans are deep-cloned in and out,
 * so callers can never mutate stored state by accident. Expired plans read as missing.
 */
export class MemoryStore implements PlanStore {
  private readonly plans = new Map<string, Plan>();

  /**
   * @param now clock used to hide expired plans (injectable for tests)
   * @param maxPlans oldest plans are evicted past this many, so dev servers cannot grow unbounded
   */
  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxPlans = 5000,
  ) {}

  /** Stores a new plan; rejects when the id is taken. */
  async create(plan: Plan): Promise<void> {
    if (this.plans.has(plan.id)) throw new Error("Plan already exists");
    this.plans.set(plan.id, structuredClone(plan));
    while (this.plans.size > this.maxPlans) {
      const oldest = this.plans.keys().next();
      if (oldest.done) break;
      this.plans.delete(oldest.value);
    }
  }

  /** Returns a copy of the plan, or null when missing or past `expireAt`. */
  async get(id: string): Promise<Plan | null> {
    return this.read(id);
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

  /** Read-modify-write with no await in between, so it is atomic within the process. */
  async mutate<T>(id: string, fn: Mutator<T>): Promise<T> {
    const { next, result } = fn(this.read(id));
    if (next) this.plans.set(id, structuredClone(next));
    return result;
  }

  /** Number of stored plans (tests). */
  get size(): number {
    return this.plans.size;
  }
}
