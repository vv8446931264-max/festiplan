type Entry<V> = { value: V; expiresAt: number };

/**
 * A tiny in-process cache with a time-to-live and least-recently-used eviction.
 * Values are deep-cloned on the way in and out so callers can never mutate a cached entry.
 * Map insertion order doubles as the recency list: a hit is re-inserted at the end.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();

  /**
   * @param maxEntries how many entries to keep before evicting the least recently used
   * @param ttlMs how long an entry stays valid, in milliseconds
   */
  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  /** Returns a copy of the cached value, or undefined when missing or expired. */
  get(key: string, now: number = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= now) return undefined;
    this.entries.set(key, entry);
    return structuredClone(entry.value);
  }

  /** Stores a copy of `value`, evicting the least recently used entries past the cap. */
  set(key: string, value: V, now: number = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value: structuredClone(value), expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  /** Number of entries currently held (expired ones included until touched). */
  get size(): number {
    return this.entries.size;
  }

  /** Drops every entry. */
  clear(): void {
    this.entries.clear();
  }
}
