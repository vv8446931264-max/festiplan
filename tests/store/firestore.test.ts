// @vitest-environment node
import { describe, expect, it } from "vitest";
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

function fakeBinding() {
  const docs = new Map<string, Record<string, unknown>>();
  const doc = (id: string): DocRefLike => ({
    async create(data) {
      if (docs.has(id)) throw new Error("ALREADY_EXISTS");
      docs.set(id, { ...data });
    },
    async get() {
      const data = docs.get(id);
      return { exists: data !== undefined, data: () => data };
    },
  });
  const transact: FirestoreBinding["transact"] = async (id, fn) => {
    const { write, result } = fn(docs.get(id));
    if (write) docs.set(id, { ...write });
    return result;
  };
  const binding: FirestoreBinding = {
    doc,
    transact,
    toTimestamp: (d) => new FakeTimestamp(d.getTime()),
  };
  return { binding, docs };
}

describe("FirestoreStore", () => {
  it("stores expireAt as a Timestamp and reads it back as a Date", async () => {
    const { binding, docs } = fakeBinding();
    const store = new FirestoreStore(async () => binding);
    const { plan } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const raw = docs.get(plan.id);
    expect(raw?.expireAt).toBeInstanceOf(FakeTimestamp);
    expect(raw?.editKeyHash).toMatch(/^[0-9a-f]{64}$/);
    const read = await store.get(plan.id);
    expect(read?.expireAt).toBeInstanceOf(Date);
    expect(read?.expireAt.toISOString()).toBe(plan.expireAt);
    await expect(store.create(read ?? Object.create(null))).rejects.toThrow();
    const seen = await store.mutate(plan.id, (p) => ({
      next: p ? { ...p, model: "changed" } : null,
      result: p?.id,
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
    const store = new FirestoreStore(async () => binding);
    docs.set("old-plan", { id: "old-plan", editKeyHash: "x", expireAt: new FakeTimestamp(0) });
    docs.set("foreign", { hello: "world" });
    expect(await store.get("old-plan")).toBeNull();
    expect(await store.get("foreign")).toBeNull();
  });

  it("retries binding after a failed SDK load", async () => {
    const { binding } = fakeBinding();
    let calls = 0;
    const store = new FirestoreStore(async () => {
      calls += 1;
      if (calls === 1) throw new Error("no credentials");
      return binding;
    });
    await expect(store.get("abcdef")).rejects.toThrow("no credentials");
    expect(await store.get("abcdef")).toBeNull();
    expect(calls).toBe(2);
  });
});

describe("conversions", () => {
  it("converts stored dates", () => {
    expect(toDate(new FakeTimestamp(5)).getTime()).toBe(5);
    const d = new Date(7);
    expect(toDate(d)).toBe(d);
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
