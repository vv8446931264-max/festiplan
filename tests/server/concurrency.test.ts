// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPlan, getPublicPlan, patchPlan } from "@/lib/server/plan-service";
import { MemoryStore } from "@/lib/store";
import { TODAY, sampleInput } from "./fixtures";

describe("concurrent edits", () => {
  it("two simultaneous checklist saves both survive (atomic read-modify-write)", async () => {
    const store = new MemoryStore();
    const { plan, editKey } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const first = plan.timeline.at(0);
    const second = plan.timeline.at(1);
    if (!first || !second) throw new Error("fixture plan has fewer than two tasks");
    const vendor = plan.vendors.at(0)?.category ?? "venue";

    const results = await Promise.all([
      patchPlan(plan.id, editKey, { tasks: [{ id: first.id, done: true }] }, TODAY, { store }),
      patchPlan(plan.id, editKey, { tasks: [{ id: second.id, done: true }] }, TODAY, { store }),
      patchPlan(plan.id, editKey, { vendors: [{ category: vendor, done: true }] }, TODAY, {
        store,
      }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const saved = await getPublicPlan(plan.id, TODAY, { store });
    const done = saved?.timeline
      .filter((task) => task.done)
      .map((task) => task.id)
      .sort();
    expect(done).toEqual([first.id, second.id].sort());
    expect(saved?.vendors.at(0)?.done).toBe(true);
  });

  it("a rejected edit writes nothing", async () => {
    const store = new MemoryStore();
    const { plan, editKey } = await createPlan(sampleInput(), TODAY, { store, ai: null });
    const before = await store.get(plan.id);
    const res = await patchPlan(
      plan.id,
      editKey,
      { tasks: [{ id: "not-a-task", done: true }] },
      TODAY,
      { store },
    );
    expect(res).toMatchObject({ ok: false, status: 422 });
    expect(await store.get(plan.id)).toEqual(before);
  });
});
