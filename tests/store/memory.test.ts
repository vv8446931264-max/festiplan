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
  it("creates, reads and updates deep copies", async () => {
    const store = new MemoryStore(() => Date.parse("2026-10-25T00:00:00Z"));
    const plan = await storedPlan(store);
    expect(plan.expireAt).toBeInstanceOf(Date);
    plan.input.city = "Mutated";
    expect((await store.get(plan.id))?.input.city).toBe("Jaipur");
    await store.update({ ...plan, model: "updated" });
    expect((await store.get(plan.id))?.model).toBe("updated");
  });

  it("rejects duplicate creates and updates of missing plans", async () => {
    const store = new MemoryStore(() => Date.parse("2026-10-25T00:00:00Z"));
    const plan = await storedPlan(store);
    await expect(store.create(plan)).rejects.toThrow(/exists/);
    await expect(store.update({ ...plan, id: "missing-id" })).rejects.toThrow(/not found/);
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
