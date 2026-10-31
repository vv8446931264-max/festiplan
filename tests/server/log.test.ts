// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { formatLog, logEvent } from "@/lib/server/log";
import { dtstamp, todayIST } from "@/lib/time";

describe("logEvent", () => {
  it("writes one Cloud Logging JSON line with httpRequest fields", () => {
    const lines: string[] = [];
    logEvent(
      {
        severity: "INFO",
        message: "request",
        route: "POST /api/plan",
        method: "POST",
        status: 201,
        latencyMs: 1234,
        requestId: "r1",
      },
      (l) => lines.push(l),
    );
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry).toMatchObject({
      severity: "INFO",
      message: "request",
      requestId: "r1",
      httpRequest: {
        requestMethod: "POST",
        requestUrl: "POST /api/plan",
        status: 201,
        latency: "1.234s",
      },
    });
  });

  it("omits httpRequest for non-request events and clamps long values", () => {
    const entry = JSON.parse(
      formatLog({ severity: "WARNING", message: "x".repeat(500), reason: "y".repeat(500) }),
    );
    expect(entry.httpRequest).toBeUndefined();
    expect(entry.message).toHaveLength(200);
    expect(entry.reason).toHaveLength(200);
  });

  it("is silent under NODE_ENV=test without a sink, and writes to stdout otherwise", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logEvent({ severity: "INFO", message: "quiet" });
    expect(write).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    logEvent({ severity: "ERROR", message: "loud" });
    expect(write).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
    write.mockRestore();
  });
});

describe("time", () => {
  it("returns the Asia/Kolkata calendar date", () => {
    expect(todayIST(new Date("2026-10-24T18:29:59Z"))).toBe("2026-10-24");
    expect(todayIST(new Date("2026-10-24T18:30:00Z"))).toBe("2026-10-25");
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats an RFC 5545 DTSTAMP in UTC", () => {
    expect(dtstamp(new Date("2026-10-24T11:34:05.123Z"))).toBe("20261024T113405Z");
  });
});
