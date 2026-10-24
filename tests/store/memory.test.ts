// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/store";
import { createPlan } from "@/lib/server/plan-service";
import type { Plan } from "@/lib/contracts";
import { TODAY, sampleInput } from "../server/fixtures";

async function storedPlan(store: MemoryStore): Promise<Plan> {
  const { plan } = await createPlan(sampleInput(), TODAY, { store, ai: null, now: new Date("2026-10-24T06:00:00Z") });
  const found = await store.get(plan.id);
  if (!found) throw new Error("plan was not stored");
  return found;
}

describe("MemoryStore", () => {
  it("creates, reads and mutates deep copies", async () => {
    const store = new MemoryStore(() => Date.parse("2026-10-25T00:00:00Z"));
    const plan = await storedPlan(store);
    expect(plan.expireAt).toBeInstanceOf(Date);
    plan.input.city = "Mutated";
    expect((await store.get(plan.id))?.input.city).toBe("Jaipur");
    const result = await store.mutate(plan.id, (p) => ({ next: p ? { ...p, model: "updated" } : null, result: "saved" }));
    expect(result).toBe("saved");
    expect((await store.get(plan.id))?.model).toBe("updated");
  });

  it("writes nothing when the mutator returns no next plan", async () => {
    const store = new MemoryStore(() => Date.parse("2026-10-25T00:00:00Z"));
    const plan = await storedPlan(store);
    await store.mutate(plan.id, (p) => ({ next: null, result: p?.id }));
    expect((await store.get(plan.id))?.model).toBe(plan.model);
    expect(await store.mutate("missing-id", (p) => ({ next: null, result: p }))).toBeNull();
    expect(store.size).toBe(1);
  });

  it("rejects duplicate creates", async () => {
    const store = new MemoryStore(() => Date.parse("2026-10-25T00:00:00Z"));
    const plan = await storedPlan(store);
    await expect(store.create(plan)).rejects.toThrow(/exists/);
    expect(await store.get("nope-nope")).toBeNull();
  });

  it("hides plans past expireAt", async () => {
    let now = Date.parse("2026-10-25T00:00:00Z");
    const store = new MemoryStore(() => now);
    const plan = await storedPlan(store);
    now = plan.expireAt.getTime();
    expect(await store.get(plan.id)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("evicts the oldest plans past its cap", async () => {
    const store = new MemoryStore(() => Date.parse("2026-10-25T00:00:00Z"), 2);
    const first = await storedPlan(store);
    await storedPlan(store);
    await storedPlan(store);
    expect(store.size).toBe(2);
    expect(await store.get(first.id)).toBeNull();
  });
});
