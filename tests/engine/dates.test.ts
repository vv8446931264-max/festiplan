// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, diffDays, maxDate, minDate } from "@/lib/engine/dates";

describe("addDays", () => {
  it("adds and subtracts whole days", () => {
    expect(addDays("2027-02-14", 0)).toBe("2027-02-14");
    expect(addDays("2027-02-14", 1)).toBe("2027-02-15");
    expect(addDays("2027-02-14", -14)).toBe("2027-01-31");
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("is not affected by daylight-saving changes", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 7)).toBe("2026-10-31");
  });
});

describe("diffDays", () => {
  it("is to minus from", () => {
    expect(diffDays("2026-10-24", "2027-02-14")).toBe(113);
    expect(diffDays("2027-02-14", "2026-10-24")).toBe(-113);
    expect(diffDays("2027-02-14", "2027-02-14")).toBe(0);
  });

  it("round-trips with addDays", () => {
    for (const n of [-400, -1, 0, 1, 59, 366, 1096]) {
      expect(diffDays("2026-10-24", addDays("2026-10-24", n))).toBe(n);
    }
  });
});

describe("maxDate / minDate", () => {
  it("pick the later and earlier date", () => {
    expect(maxDate("2027-01-01", "2026-12-31")).toBe("2027-01-01");
    expect(maxDate("2026-12-31", "2027-01-01")).toBe("2027-01-01");
    expect(minDate("2027-01-01", "2026-12-31")).toBe("2026-12-31");
    expect(minDate("2026-12-31", "2027-01-01")).toBe("2026-12-31");
  });

  it("return the date when both are equal", () => {
    expect(maxDate("2027-01-01", "2027-01-01")).toBe("2027-01-01");
    expect(minDate("2027-01-01", "2027-01-01")).toBe("2027-01-01");
  });
});
