import type { PlanPatch } from "@/lib/contracts";

function mergeBy<T>(a: T[] | undefined, b: T[] | undefined, key: (t: T) => string): T[] | undefined {
  if (!a) return b;
  if (!b) return a;
  const map = new Map(a.map((t) => [key(t), t]));
  for (const t of b) map.set(key(t), t);
  return [...map.values()];
}

/**
 * Merges a queued patch with a newer one: later task/vendor/actual entries win per
 * key, and the newest full allocation list replaces the older one.
 */
export function mergePatch(older: PlanPatch | null, newer: PlanPatch): PlanPatch {
  if (!older) return newer;
  const merged: PlanPatch = {
    tasks: mergeBy(older.tasks, newer.tasks, (t) => t.id),
    vendors: mergeBy(older.vendors, newer.vendors, (v) => v.category),
    actuals: mergeBy(older.actuals, newer.actuals, (a) => a.category),
    allocations: newer.allocations ?? older.allocations,
  };
  for (const key of Object.keys(merged) as (keyof PlanPatch)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
}
