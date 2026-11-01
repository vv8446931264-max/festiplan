// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BUDGET_CATEGORIES } from "@/lib/contracts/constants";
import type { Allocation } from "@/lib/contracts";
import { rebalance, roomFor, setLocked } from "@/lib/engine/budget-edit";
import { allocation, amountsOf, sum } from "./builders";
import { int, mulberry32 } from "./prng";

const context = { totalINR: 1_000, guests: 10 };
const lines = (): Allocation[] => [
  allocation("venue", 400),
  allocation("catering", 300),
  allocation("decor", 200),
  allocation("misc", 100),
];

/** What a slider used to compute for itself: everything allocated, minus the locked lines. */
function sliderMax(allocations: Allocation[], category: Allocation["category"]): number {
  const distributable = sum(amountsOf(allocations));
  const locked = sum(amountsOf(allocations.filter((line) => line.locked)));
  const own = allocations.find((line) => line.category === category);
  return distributable - locked + (own?.locked ? own.amountINR : 0);
}

describe("roomFor", () => {
  it("is everything allocated when nothing is locked", () => {
    for (const { category } of lines()) expect(roomFor(lines(), category)).toBe(1_000);
  });

  it("leaves out what the other locked lines keep", () => {
    const locked = setLocked(lines(), "catering", true);
    expect(roomFor(locked, "venue")).toBe(700);
    expect(roomFor(locked, "misc")).toBe(700);
  });

  it("does not count a line's own lock against itself", () => {
    const locked = setLocked(setLocked(lines(), "catering", true), "venue", true);
    expect(roomFor(locked, "catering")).toBe(600);
    expect(roomFor(locked, "venue")).toBe(700);
    expect(roomFor(locked, "decor")).toBe(300);
  });

  it("is 0 for an empty budget", () => {
    expect(roomFor([], "venue")).toBe(0);
  });

  it("is the amount rebalance clamps a request to", () => {
    const locked = setLocked(lines(), "catering", true);
    const room = roomFor(locked, "venue");
    const asked = (amount: number) => rebalance(locked, "venue", amount, context)[0]?.amountINR;
    expect(asked(room)).toBe(room);
    expect(asked(room + 1)).toBe(room);
    expect(asked(room - 1)).toBe(room - 1);
  });
});

describe("roomFor (property)", () => {
  it("equals the slider's own formula and is the most rebalance gives a line", () => {
    const rand = mulberry32(7);
    for (let run = 0; run < 300; run++) {
      const categories = BUDGET_CATEGORIES.slice(0, int(rand, 2, BUDGET_CATEGORIES.length));
      const allocations = categories.map((category) =>
        allocation(category, int(rand, 0, 5_000_000), { locked: rand() < 0.35 }),
      );
      for (const { category } of allocations) {
        const room = roomFor(allocations, category);
        expect(room).toBe(sliderMax(allocations, category));
        const out = rebalance(allocations, category, room * 2 + 1, context);
        expect(out.find((line) => line.category === category)?.amountINR).toBe(room);
        expect(sum(amountsOf(out))).toBe(sum(amountsOf(allocations)));
      }
    }
  });
});
