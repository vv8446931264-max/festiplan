const registry = globalThis as typeof globalThis & { __festiplan?: Map<string, unknown> };

/**
 * One instance per server process. Next.js bundles each route separately, so a plain
 * module-level `let` would give every route its own copy (e.g. its own in-memory store);
 * keeping instances on `globalThis` makes them truly process-wide.
 */
export function processSingleton<T>(key: string, create: () => T): T {
  registry.__festiplan ??= new Map();
  if (!registry.__festiplan.has(key)) registry.__festiplan.set(key, create());
  return registry.__festiplan.get(key) as T;
}
