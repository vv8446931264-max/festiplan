// @vitest-environment node
import * as crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { hashEditKey, newEditKey, verifyEditKey } from "@/lib/security/edit-key";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

describe("edit keys", () => {
  it("issues 32-byte base64url keys that are unique", () => {
    const keys = new Set(Array.from({ length: 50 }, newEditKey));
    expect(keys.size).toBe(50);
    for (const k of keys) expect(k).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes with SHA-256 hex", () => {
    expect(hashEditKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("verifies the right key with a timing-safe comparison", () => {
    const key = newEditKey();
    const hash = hashEditKey(key);
    const spy = vi.mocked(crypto.timingSafeEqual);
    spy.mockClear();
    expect(verifyEditKey(key, hash)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(verifyEditKey(newEditKey(), hash)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("rejects missing, oversized keys and malformed hashes without comparing", () => {
    const hash = hashEditKey("k");
    expect(verifyEditKey(null, hash)).toBe(false);
    expect(verifyEditKey("", hash)).toBe(false);
    expect(verifyEditKey("k".repeat(500), hashEditKey("k".repeat(500)))).toBe(false);
    expect(verifyEditKey("k", "not-a-hash")).toBe(false);
    expect(verifyEditKey("k", hash.toUpperCase())).toBe(false);
  });
});
