// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compressedLeadDays } from "@/lib/engine/compression";
import { addDays, diffDays } from "@/lib/engine/dates";
import { DAYS_PER_WEEK, DAY_MS } from "@/lib/time";

/** The calendar units live in `src/lib/time.ts`; the engine reads them from there. */
describe("calendar units", () => {
  it("DAY_MS is twenty-four hours of milliseconds", () => {
    expect(DAY_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("date arithmetic moves by DAY_MS per day", () => {
    const midnight = Date.parse("2027-02-14T00:00:00Z");
    expect(addDays("2027-02-14", 3)).toBe(
      new Date(midnight + 3 * DAY_MS).toISOString().slice(0, 10),
    );
    expect(
      diffDays("2027-02-14", new Date(midnight + 40 * DAY_MS).toISOString().slice(0, 10)),
    ).toBe(40);
  });

  it("DAYS_PER_WEEK is seven, and lead times in weeks are counted with it", () => {
    expect(DAYS_PER_WEEK).toBe(7);
    expect(compressedLeadDays(3, 1)).toBe(3 * DAYS_PER_WEEK);
  });
});
