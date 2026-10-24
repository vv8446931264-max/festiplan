// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPlan, getPublicPlan, patchPlan } from "@/lib/server/plan-service";
import { MemoryStore } from "@/lib/store";
import { TODAY, sampleInput } from "./fixtures";

describe("concurrent edits", () => {
  it("two simultaneous checklist saves both survive (atomic read-modify-write)", async () => {
    const store = new MemoryStore();
    const { plan, editKey } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const [a, b] = plan.timeline;
    if (!a || !b) throw new Error("fixture plan has no tasks");

    const results = await Promise.all([
      patchPlan(plan.id, editKey, { tasks: [{ id: a.id, done: true }] }, TODAY, { store }),
      patchPlan(plan.id, editKey, { tasks: [{ id: b.id, done: true }] }, TODAY, { store }),
      patchPlan(plan.id, editKey, { vendors: [{ category: plan.vendors[0]?.category ?? "venue", done: true }] }, TODAY, { store }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    const saved = await getPublicPlan(plan.id, TODAY, { store });
    const done = saved?.timeline.filter((t) => t.done).map((t) => t.id).sort();
    expect(done).toEqual([a.id, b.id].sort());
    expect(saved?.vendors[0]?.done).toBe(true);
  });

  it("a rejected edit writes nothing", async () => {
    const store = new MemoryStore();
    const { plan, editKey } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const before = await store.get(plan.id);
    const res = await patchPlan(plan.id, editKey, { tasks: [{ id: "not-a-task", done: true }] }, TODAY, { store });
    expect(res).toMatchObject({ ok: false, status: 422 });
    expect(await store.get(plan.id)).toEqual(before);
  });
});
