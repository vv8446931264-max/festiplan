// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Plan } from "@/lib/contracts";
import { FirestoreStore, fromDoc, toDate } from "@/lib/store/firestore";
import type { DocRefLike, FirestoreBinding } from "@/lib/store/firestore";
import { getStore, storeKind, MemoryStore } from "@/lib/store";
import { createPlan } from "@/lib/server/plan-service";
import { TODAY, sampleInput } from "../server/fixtures";

class FakeTimestamp {
  constructor(readonly ms: number) {}
  toDate(): Date {
    return new Date(this.ms);
  }
}

/** An in-memory stand-in for the slice of the SDK the adapter uses. */
function fakeBinding() {
  const docs = new Map<string, Record<string, unknown>>();
  const doc = (id: string): DocRefLike => ({
    create(data) {
      if (docs.has(id)) return Promise.reject(new Error("ALREADY_EXISTS"));
      docs.set(id, { ...data });
      return Promise.resolve();
    },
    get() {
      const data = docs.get(id);
      return Promise.resolve({ exists: data !== undefined, data: () => data });
    },
  });
  const transact: FirestoreBinding["transact"] = (id, decide) => {
    const { write, result } = decide(docs.get(id));
    if (write) docs.set(id, { ...write });
    return Promise.resolve(result);
  };
  const binding: FirestoreBinding = {
    doc,
    transact,
    toTimestamp: (date) => new FakeTimestamp(date.getTime()),
  };
  return { binding, docs };
}

/** A FirestoreStore over a fresh fake, holding one newly created plan. */
async function storeWithPlan() {
  const { binding, docs } = fakeBinding();
  const store = new FirestoreStore(() => Promise.resolve(binding));
  const { plan } = await createPlan(sampleInput(), TODAY, { store, ai: null });
  const stored = await store.get(plan.id);
  if (!stored) throw new Error("plan was not stored");
  return { store, docs, plan, stored };
}

describe("FirestoreStore", () => {
  it("stores expireAt as a Timestamp and reads it back as a Date", async () => {
    const { docs, plan, stored } = await storeWithPlan();
    const raw = docs.get(plan.id);
    expect(raw?.expireAt).toBeInstanceOf(FakeTimestamp);
    expect(raw?.editKeyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.expireAt).toBeInstanceOf(Date);
    expect(stored.expireAt.toISOString()).toBe(plan.expireAt);
  });

  it("rejects a second create with the same id", async () => {
    const { store, stored } = await storeWithPlan();
    await expect(store.create(stored)).rejects.toThrow();
  });

  it("writes through mutate only when the decision has a next plan", async () => {
    const { store, docs, plan } = await storeWithPlan();
    const seen = await store.mutate(plan.id, (current: Plan | null) => ({
      next: current ? { ...current, model: "changed" } : null,
      result: current?.id,
    }));
    expect(seen).toBe(plan.id);
    expect((await store.get(plan.id))?.model).toBe("changed");
    expect(docs.get(plan.id)?.expireAt).toBeInstanceOf(FakeTimestamp);
    await store.mutate(plan.id, () => ({ next: null, result: null }));
    expect((await store.get(plan.id))?.model).toBe("changed");
    expect(await store.get("missing-id")).toBeNull();
  });

  it("treats expired or foreign documents as missing", async () => {
    const { binding, docs } = fakeBinding();
    const store = new FirestoreStore(() => Promise.resolve(binding));
    docs.set("old-plan", { id: "old-plan", editKeyHash: "x", expireAt: new FakeTimestamp(0) });
    docs.set("foreign", { hello: "world" });
    expect(await store.get("old-plan")).toBeNull();
    expect(await store.get("foreign")).toBeNull();
  });

  it("retries binding after a failed SDK load", async () => {
    const { binding } = fakeBinding();
    let calls = 0;
    const store = new FirestoreStore(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("no credentials")) : Promise.resolve(binding);
    });
    await expect(store.get("abcdef")).rejects.toThrow("no credentials");
    expect(await store.get("abcdef")).toBeNull();
    expect(calls).toBe(2);
  });
});

describe("conversions", () => {
  it("converts stored dates", () => {
    expect(toDate(new FakeTimestamp(5)).getTime()).toBe(5);
    const date = new Date(7);
    expect(toDate(date)).toBe(date);
    expect(toDate("2027-01-01T00:00:00.000Z").toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(toDate(null).getTime()).toBe(0);
    expect(fromDoc(undefined)).toBeNull();
  });
});

describe("store selection", () => {
  it("uses memory without a project and Firestore with one", () => {
    expect(storeKind({})).toBe("memory");
    expect(storeKind({ GOOGLE_CLOUD_PROJECT: "demo" })).toBe("firestore");
    expect(getStore({})).toBeInstanceOf(MemoryStore);
    expect(getStore({})).toBe(getStore({}));
    expect(getStore({ GOOGLE_CLOUD_PROJECT: "demo" })).toBeInstanceOf(FirestoreStore);
  });
});
