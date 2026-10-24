import { FirestoreStore } from "./firestore";
import { MemoryStore } from "./memory";
import type { PlanStore, StoreKind } from "./types";

export type { PlanStore, StoreKind } from "./types";
export { MemoryStore } from "./memory";
export { FirestoreStore } from "./firestore";

type Env = Record<string, string | undefined>;

let singleton: { kind: StoreKind; store: PlanStore } | null = null;

/** Firestore when `GOOGLE_CLOUD_PROJECT` is set, otherwise the in-memory store. */
export function storeKind(env: Env = process.env): StoreKind {
  return env.GOOGLE_CLOUD_PROJECT?.trim() ? "firestore" : "memory";
}

/** The process-wide plan store (created on first use, matching `storeKind()`). */
export function getStore(env: Env = process.env): PlanStore {
  const kind = storeKind(env);
  if (singleton?.kind !== kind) {
    singleton = { kind, store: kind === "firestore" ? new FirestoreStore() : new MemoryStore() };
  }
  return singleton.store;
}
