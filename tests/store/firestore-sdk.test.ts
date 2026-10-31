// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirestoreStore, PLANS_COLLECTION, loadFirestore } from "@/lib/store/firestore";
import { createPlan, getPublicPlan, patchPlan } from "@/lib/server/plan-service";
import { TODAY, sampleInput } from "../server/fixtures";

type Data = Record<string, unknown>;

/** What the fake SDK saw: documents by path, settings, transactions and transactional writes. */
const sdk = vi.hoisted(() => ({
  docs: new Map<string, Data>(),
  settings: [] as unknown[],
  transactions: 0,
  txReads: [] as string[],
  txWrites: [] as string[],
}));

vi.mock("@google-cloud/firestore", () => {
  class Timestamp {
    constructor(readonly millis: number) {}
    static fromDate(date: Date): Timestamp {
      return new Timestamp(date.getTime());
    }
    toDate(): Date {
      return new Date(this.millis);
    }
  }
  const snapshot = (path: string) => ({
    exists: sdk.docs.has(path),
    data: () => sdk.docs.get(path),
  });
  class DocumentReference {
    constructor(readonly path: string) {}
    create(data: Data): Promise<void> {
      if (sdk.docs.has(this.path)) return Promise.reject(new Error("6 ALREADY_EXISTS"));
      sdk.docs.set(this.path, { ...data });
      return Promise.resolve();
    }
    get() {
      return Promise.resolve(snapshot(this.path));
    }
  }
  class Transaction {
    get(ref: DocumentReference) {
      sdk.txReads.push(ref.path);
      return Promise.resolve(snapshot(ref.path));
    }
    set(ref: DocumentReference, data: Data): void {
      sdk.txWrites.push(ref.path);
      sdk.docs.set(ref.path, { ...data });
    }
  }
  class Firestore {
    constructor(settings: unknown) {
      sdk.settings.push(settings);
    }
    collection(name: string) {
      return { doc: (id: string) => new DocumentReference(`${name}/${id}`) };
    }
    async runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
      sdk.transactions += 1;
      return fn(new Transaction());
    }
  }
  return { Firestore, Timestamp };
});

beforeEach(() => {
  sdk.docs.clear();
  sdk.settings.length = 0;
  sdk.transactions = 0;
  sdk.txReads.length = 0;
  sdk.txWrites.length = 0;
});

describe("loadFirestore (SDK binding)", () => {
  it("opens the named database with undefined properties ignored", async () => {
    await loadFirestore({ FIRESTORE_DATABASE: " plans-db " });
    await loadFirestore({});
    expect(sdk.settings).toEqual([
      { databaseId: "plans-db", ignoreUndefinedProperties: true },
      { databaseId: "festiplan", ignoreUndefinedProperties: true },
    ]);
  });

  it("stores expireAt as an SDK Timestamp in the plans collection", async () => {
    const store = new FirestoreStore();
    const { plan } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const raw = sdk.docs.get(`${PLANS_COLLECTION}/${plan.id}`);
    expect(raw?.expireAt).toHaveProperty("millis", Date.parse(plan.expireAt));
    expect((await store.get(plan.id))?.expireAt.toISOString()).toBe(plan.expireAt);
  });
});

describe("FirestoreStore.mutate inside runTransaction", () => {
  it("reads, decides and writes within one transaction", async () => {
    const store = new FirestoreStore(() => loadFirestore({}));
    const { plan, editKey } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const task = plan.timeline.at(0);
    if (!task) throw new Error("fixture plan has no tasks");
    const res = await patchPlan(plan.id, editKey, { tasks: [{ id: task.id, done: true }] }, TODAY, {
      store,
    });
    expect(res.ok).toBe(true);
    expect(sdk.transactions).toBe(1);
    expect(sdk.txReads).toEqual([`plans/${plan.id}`]);
    expect(sdk.txWrites).toEqual([`plans/${plan.id}`]);
    const saved = await getPublicPlan(plan.id, TODAY, { store });
    expect(saved?.timeline.find((t) => t.id === task.id)?.done).toBe(true);
    expect(sdk.docs.get(`plans/${plan.id}`)?.expireAt).toHaveProperty("millis");
  });

  it("writes nothing when the decision has no next plan (wrong key, bad edit, missing plan)", async () => {
    const store = new FirestoreStore(() => loadFirestore({}));
    const { plan, editKey } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const before = structuredClone(sdk.docs.get(`plans/${plan.id}`));
    const tick = { tasks: [{ id: plan.timeline.at(0)?.id ?? "x", done: true }] };
    expect(await patchPlan(plan.id, "wrong-key", tick, TODAY, { store })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(
      await patchPlan(plan.id, editKey, { tasks: [{ id: "ghost", done: true }] }, TODAY, { store }),
    ).toMatchObject({ status: 422 });
    expect(await patchPlan("missing-plan", editKey, tick, TODAY, { store })).toMatchObject({
      status: 404,
    });
    expect(sdk.transactions).toBe(3);
    expect(sdk.txReads).toHaveLength(3);
    expect(sdk.txWrites).toEqual([]);
    expect(sdk.docs.get(`plans/${plan.id}`)).toEqual(before);
  });
});
