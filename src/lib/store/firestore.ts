import type { Plan } from "@/lib/contracts";
import type { PlanStore } from "./types";

/** The slice of a Firestore document reference this adapter uses (fakeable in tests). */
export type DocRefLike = {
  create(data: Record<string, unknown>): Promise<unknown>;
  set(data: Record<string, unknown>): Promise<unknown>;
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
};

/** What the adapter needs from the Firestore SDK: the `plans` collection and a Date → Timestamp. */
export type FirestoreBinding = {
  doc(id: string): DocRefLike;
  toTimestamp(date: Date): unknown;
};

export const PLANS_COLLECTION = "plans";

/**
 * Loads `@google-cloud/firestore` lazily (memory mode never imports it) and binds the
 * `plans` collection of the named Native-mode database (`FIRESTORE_DATABASE`, default "festiplan").
 */
export async function loadFirestore(env: Record<string, string | undefined> = process.env): Promise<FirestoreBinding> {
  const { Firestore, Timestamp } = await import("@google-cloud/firestore");
  const db = new Firestore({
    databaseId: env.FIRESTORE_DATABASE?.trim() || "festiplan",
    ignoreUndefinedProperties: true,
  });
  const plans = db.collection(PLANS_COLLECTION);
  return {
    doc: (id) => plans.doc(id),
    toTimestamp: (date) => Timestamp.fromDate(date),
  };
}

const hasToDate = (v: unknown): v is { toDate(): Date } =>
  typeof v === "object" && v !== null && "toDate" in v && typeof v.toDate === "function";

/** Converts a stored `expireAt` (Firestore Timestamp, Date or ISO string) back to a Date. */
export function toDate(value: unknown): Date {
  if (hasToDate(value)) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(typeof value === "string" || typeof value === "number" ? value : 0);
}

/** Firestore document → `Plan`, or null when the document is not a plan we wrote. */
export function fromDoc(data: Record<string, unknown> | undefined): Plan | null {
  if (!data || typeof data.id !== "string" || typeof data.editKeyHash !== "string") return null;
  return { ...data, expireAt: toDate(data.expireAt) } as Plan;
}

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

  private toDoc(b: FirestoreBinding, plan: Plan): Record<string, unknown> {
    return { ...plan, expireAt: b.toTimestamp(plan.expireAt) };
  }

  /** Creates `plans/{id}`; rejects if it already exists. */
  async create(plan: Plan): Promise<void> {
    const b = await this.bind();
    await b.doc(plan.id).create(this.toDoc(b, plan));
  }

  /** Reads `plans/{id}`; null when missing or past `expireAt` (TTL deletion is not instant). */
  async get(id: string): Promise<Plan | null> {
    const b = await this.bind();
    const snap = await b.doc(id).get();
    if (!snap.exists) return null;
    const plan = fromDoc(snap.data());
    return plan && plan.expireAt.getTime() > Date.now() ? plan : null;
  }

  /** Replaces `plans/{id}`. */
  async update(plan: Plan): Promise<void> {
    const b = await this.bind();
    await b.doc(plan.id).set(this.toDoc(b, plan));
  }
}
