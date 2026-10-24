// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TtlCache } from "@/lib/ai/cache";

describe("TtlCache", () => {
  it("expires entries after the TTL", () => {
    const cache = new TtlCache<number>(10, 1000);
    cache.set("a", 1, 0);
    expect(cache.get("a", 999)).toBe(1);
    expect(cache.get("a", 1000)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently used entry past the cap", () => {
    const cache = new TtlCache<number>(2, 10_000);
    cache.set("a", 1, 0);
    cache.set("b", 2, 0);
    cache.get("a", 1);
    cache.set("c", 3, 2);
    expect(cache.get("b", 3)).toBeUndefined();
    expect(cache.get("a", 3)).toBe(1);
    expect(cache.get("c", 3)).toBe(3);
  });

  it("hands out copies so callers cannot mutate cached values", () => {
    const cache = new TtlCache<{ n: number }>(2, 10_000);
    const value = { n: 1 };
    cache.set("a", value, 0);
    value.n = 2;
    const got = cache.get("a", 1);
    if (got) got.n = 3;
    expect(cache.get("a", 1)).toEqual({ n: 1 });
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
