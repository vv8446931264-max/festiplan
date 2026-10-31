import type { PlanPatch } from "@/lib/contracts";

/** Combines two edit lists; for entries with the same key, the newer one wins. */
function mergeBy<T>(
  older: T[] | undefined,
  newer: T[] | undefined,
  keyOf: (entry: T) => string,
): T[] | undefined {
  if (!older) return newer;
  if (!newer) return older;
  const byKey = new Map(older.map((entry) => [keyOf(entry), entry]));
  for (const entry of newer) byKey.set(keyOf(entry), entry);
  return [...byKey.values()];
}

/**
 * Merges a queued patch with a newer one: later task/vendor/actual entries win per
 * key, and the newest full allocation list replaces the older one. Keys absent from
 * both patches stay absent, so the PATCH body never carries `undefined`.
 */
export function mergePatch(older: PlanPatch | null, newer: PlanPatch): PlanPatch {
  if (!older) return newer;
  const tasks = mergeBy(older.tasks, newer.tasks, (task) => task.id);
  const vendors = mergeBy(older.vendors, newer.vendors, (vendor) => vendor.category);
  const actuals = mergeBy(older.actuals, newer.actuals, (actual) => actual.category);
  const allocations = newer.allocations ?? older.allocations;
  return {
    ...(tasks && { tasks }),
    ...(vendors && { vendors }),
    ...(actuals && { actuals }),
    ...(allocations && { allocations }),
  };
}
