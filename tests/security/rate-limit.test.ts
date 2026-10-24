// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, rateLimitScale, rateLimitSize, resetRateLimits, scaledLimit } from "@/lib/security/rate-limit";

beforeEach(() => resetRateLimits());

describe("rateLimit", () => {
  it("allows `limit` hits per window, then reports Retry-After", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("ip", 5, 60_000, 1_000 + i).ok).toBe(true);
    expect(rateLimit("ip", 5, 60_000, 31_000)).toEqual({ ok: false, retryAfterSec: 30 });
    expect(rateLimit("other", 5, 60_000, 31_000).ok).toBe(true);
  });

  it("opens a fresh window once the old one ends", () => {
    rateLimit("ip", 1, 1_000, 0);
    expect(rateLimit("ip", 1, 1_000, 999).ok).toBe(false);
    expect(rateLimit("ip", 1, 1_000, 1_000).ok).toBe(true);
  });

  it("never reports less than one second", () => {
    rateLimit("ip", 1, 1_000, 0);
    expect(rateLimit("ip", 1, 1_000, 999).retryAfterSec).toBe(1);
  });

  it("refuses everything with a zero limit", () => {
    expect(rateLimit("ip", 0, 2_000, 0)).toEqual({ ok: false, retryAfterSec: 2 });
  });

  it("prunes expired windows periodically", () => {
    for (let i = 0; i < 100; i++) rateLimit(`k${i}`, 1, 1_000, 0);
    expect(rateLimitSize()).toBe(100);
    rateLimit("late", 1, 1_000, 120_000);
    expect(rateLimitSize()).toBe(1);
  });
});

describe("RATE_LIMIT_SCALE", () => {
  it("multiplies limits by a positive integer", () => {
    expect(rateLimitScale({ RATE_LIMIT_SCALE: "50" })).toBe(50);
    expect(scaledLimit(5, { RATE_LIMIT_SCALE: "50" })).toBe(250);
    expect(scaledLimit(10, { RATE_LIMIT_SCALE: " 3 " })).toBe(30);
  });

  it("defaults to 1 when unset or invalid", () => {
    for (const v of [undefined, "", "0", "-2", "1.5", "abc", "1e3", "99999999999999999999"]) {
      expect(rateLimitScale({ RATE_LIMIT_SCALE: v })).toBe(1);
    }
    expect(scaledLimit(5, {})).toBe(5);
  });
});
