import { FirestoreStore } from "./firestore";
import { MemoryStore } from "./memory";
import { processSingleton } from "@/lib/server/singleton";
import type { PlanStore, StoreKind } from "./types";

export type { PlanStore, StoreKind } from "./types";
export { MemoryStore } from "./memory";
export { FirestoreStore } from "./firestore";

type Env = Record<string, string | undefined>;

/** Firestore when `GOOGLE_CLOUD_PROJECT` is set, otherwise the in-memory store. */
export function storeKind(env: Env = process.env): StoreKind {
  return env.GOOGLE_CLOUD_PROJECT?.trim() ? "firestore" : "memory";
}

/**
 * The process-wide plan store for `storeKind()`, shared by every route bundle
 * (so a plan created by the API is visible to the share page in memory mode too).
 */
export function getStore(env: Env = process.env): PlanStore {
  const kind = storeKind(env);
  return processSingleton(`store:${kind}`, () =>
    kind === "firestore" ? new FirestoreStore() : new MemoryStore(),
  );
}
