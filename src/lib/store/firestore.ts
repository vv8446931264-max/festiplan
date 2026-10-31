import type { Plan } from "@/lib/contracts";
import type { Mutator, PlanStore } from "./types";

/** The slice of a Firestore document reference this adapter uses (fakeable in tests). */
export type DocRefLike = {
  create(data: Record<string, unknown>): Promise<unknown>;
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
};

/** One transactional read-modify-write of a raw document (`write` null = no write). */
export type Transact = <T>(
  id: string,
  decide: (data: Record<string, unknown> | undefined) => {
    write: Record<string, unknown> | null;
    result: T;
  },
) => Promise<T>;

/** What the adapter needs from the Firestore SDK: the `plans` collection, transactions and Date → Timestamp. */
export type FirestoreBinding = {
  doc(id: string): DocRefLike;
  transact: Transact;
  toTimestamp(date: Date): unknown;
};

/** Firestore collection that holds one document per plan. */
export const PLANS_COLLECTION = "plans";

const DEFAULT_DATABASE_ID = "festiplan";

/** `FIRESTORE_DATABASE`, or the default database when it is unset or blank. */
function databaseId(env: Record<string, string | undefined>): string {
  const configured = env.FIRESTORE_DATABASE?.trim() ?? "";
  return configured.length > 0 ? configured : DEFAULT_DATABASE_ID;
}

/**
 * Loads `@google-cloud/firestore` lazily (memory mode never imports it) and binds the
 * `plans` collection of the named Native-mode database (`FIRESTORE_DATABASE`, default "festiplan").
 */
export async function loadFirestore(
  env: Record<string, string | undefined> = process.env,
): Promise<FirestoreBinding> {
  const { Firestore, Timestamp } = await import("@google-cloud/firestore");
  const db = new Firestore({
    databaseId: databaseId(env),
    ignoreUndefinedProperties: true,
  });
  const plans = db.collection(PLANS_COLLECTION);
  return {
    doc: (id) => plans.doc(id),
    transact: (id, decide) =>
      db.runTransaction(async (transaction) => {
        const ref = plans.doc(id);
        const snapshot = await transaction.get(ref);
        const { write, result } = decide(snapshot.exists ? snapshot.data() : undefined);
        if (write) transaction.set(ref, write);
        return result;
      }),
    toTimestamp: (date) => Timestamp.fromDate(date),
  };
}

const hasToDate = (value: unknown): value is { toDate(): Date } =>
  typeof value === "object" &&
  value !== null &&
  "toDate" in value &&
  typeof value.toDate === "function";

/** Converts a stored `expireAt` (Firestore Timestamp, Date or ISO string) back to a Date. */
export function toDate(value: unknown): Date {
  if (hasToDate(value)) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(typeof value === "string" || typeof value === "number" ? value : 0);
}

/** Firestore document → `Plan`, or null when the document is not a plan we wrote. */
export function fromDoc(data: Record<string, unknown> | undefined): Plan | null {
  if (!data || typeof data.id !== "string" || typeof data.editKeyHash !== "string") return null;
  // Only this adapter writes plan documents, so one carrying our id and key hash is a Plan.
  return { ...data, expireAt: toDate(data.expireAt) } as Plan;
}

/** The plan unless it is past `expireAt` (Firestore TTL deletion is not instant). */
const unexpired = (plan: Plan | null): Plan | null =>
  plan && plan.expireAt.getTime() > Date.now() ? plan : null;

/**
 * Plans in Cloud Firestore (`plans/{id}`), accessed only from the server with ADC.
 * `expireAt` is stored as a Timestamp so the Firestore TTL policy can delete old plans.
 */
export class FirestoreStore implements PlanStore {
  private binding: Promise<FirestoreBinding> | null = null;

  /** @param load binds the collection; defaults to the real SDK (tests pass a fake) */
  constructor(private readonly load: () => Promise<FirestoreBinding> = () => loadFirestore()) {}

  private bind(): Promise<FirestoreBinding> {
    this.binding ??= this.load().catch((err: unknown) => {
      this.binding = null;
      throw err;
    });
    return this.binding;
  }

  private toDoc(binding: FirestoreBinding, plan: Plan): Record<string, unknown> {
    return { ...plan, expireAt: binding.toTimestamp(plan.expireAt) };
  }

  /** Creates `plans/{id}`; rejects if it already exists. */
  async create(plan: Plan): Promise<void> {
    const binding = await this.bind();
    await binding.doc(plan.id).create(this.toDoc(binding, plan));
  }

  /** Reads `plans/{id}`; null when missing or past `expireAt` (TTL deletion is not instant). */
  async get(id: string): Promise<Plan | null> {
    const binding = await this.bind();
    const snapshot = await binding.doc(id).get();
    return snapshot.exists ? unexpired(fromDoc(snapshot.data())) : null;
  }

  /** Read-modify-write inside a Firestore transaction (retried by the SDK on contention). */
  async mutate<T>(id: string, decide: Mutator<T>): Promise<T> {
    const binding = await this.bind();
    return binding.transact(id, (data) => {
      const { next, result } = decide(unexpired(fromDoc(data)));
      return { write: next ? this.toDoc(binding, next) : null, result };
    });
  }
}
