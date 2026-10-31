// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mergePatch } from "@/components/plan/patch";
import { PlanPatchSchema } from "@/lib/contracts";

describe("mergePatch", () => {
  it("returns the newer patch when nothing is queued", () => {
    const patch = { tasks: [{ id: "a", done: true }] };
    expect(mergePatch(null, patch)).toBe(patch);
  });

  it("keeps the latest state per task, vendor and actual", () => {
    const merged = mergePatch(
      {
        tasks: [
          { id: "a", done: true },
          { id: "b", done: true },
        ],
        actuals: [{ category: "venue", actualINR: 5 }],
      },
      {
        tasks: [{ id: "a", done: false }],
        vendors: [{ category: "decor", done: true }],
        actuals: [{ category: "venue", actualINR: null }],
      },
    );
    expect(merged.tasks).toEqual([
      { id: "a", done: false },
      { id: "b", done: true },
    ]);
    expect(merged.vendors).toEqual([{ category: "decor", done: true }]);
    expect(merged.actuals).toEqual([{ category: "venue", actualINR: null }]);
    expect(PlanPatchSchema.safeParse(merged).success).toBe(true);
  });

  it("replaces the allocation list wholesale with the newest one", () => {
    const older = { allocations: [{ category: "venue" as const, amountINR: 1, locked: false }] };
    const newer = { allocations: [{ category: "venue" as const, amountINR: 2, locked: true }] };
    expect(mergePatch(older, newer).allocations).toEqual(newer.allocations);
    expect(mergePatch(older, { tasks: [] }).allocations).toEqual(older.allocations);
  });

  it("drops keys that are absent from both patches", () => {
    expect(Object.keys(mergePatch({ tasks: [] }, { tasks: [] }))).toEqual(["tasks"]);
  });
});
