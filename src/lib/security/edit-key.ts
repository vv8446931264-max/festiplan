import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256 random bits per key: far beyond brute force, so an unsalted SHA-256 is enough. */
const EDIT_KEY_BYTES = 32;
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Longer than any key we issue (43 chars); anything bigger is rejected before hashing. */
const MAX_KEY_LENGTH = 128;

/** A fresh edit key: 32 random bytes, base64url (43 characters). Returned to the owner once. */
export function newEditKey(): string {
  return randomBytes(EDIT_KEY_BYTES).toString("base64url");
}

/** SHA-256 hex digest of an edit key; only this is stored. */
export function hashEditKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Constant-time check that `key` hashes to `hash`. Missing or oversized keys fail. */
export function verifyEditKey(key: string | null | undefined, hash: string): boolean {
  if (!key || key.length > MAX_KEY_LENGTH || !SHA256_HEX.test(hash)) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(hashEditKey(key), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
