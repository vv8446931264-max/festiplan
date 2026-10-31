import type { BudgetCategory } from "@/lib/contracts";
import { largestRemainder } from "./largest-remainder";
import { positiveOrZero, sum } from "./shared";

// Budget Flow particle maths (docs/DESIGN.md §6): rupees are particles, categories are columns.
// Pure — no three.js, no I/O, no Math.random (positions come from an integer hash).
// This module decides which column and slot each particle takes; `particle-targets.ts` turns
// that into positions and `particle-spring.ts` moves particles there. Both are re-exported here
// so the scene imports all of the particle maths from one path.
export * from "./particle-spring";
export * from "./particle-targets";

/** One budget line as the particle layout sees it. */
export type ParticleAllocation = { category: BudgetCategory; amountINR: number };

/** Column per particle (-1 = parked, hidden), stack slot (0 = bottom) and particles per column. */
export type ParticleAssignment = { column: Int16Array; slot: Int32Array; counts: number[] };

/** Column index of a parked (hidden) particle. */
const PARKED = -1;

/**
 * Split `count` particles across allocations in proportion to their rupees with the
 * largest-remainder method, so the counts sum to exactly `count` (ties go to the
 * earlier line). Negative or non-finite amounts count as zero; when every amount
 * is zero, or `count` is not a positive number, every count is zero.
 */
export function layoutParticles(
  allocations: readonly ParticleAllocation[],
  count: number,
): number[] {
  const amounts = allocations.map((line) => positiveOrZero(line.amountINR));
  if (sum(amounts) === 0) return amounts.map(() => 0);
  return largestRemainder(Math.floor(positiveOrZero(count)), amounts);
}

/** A fresh assignment with every one of `count` particles parked. */
export function emptyAssignment(count: number): ParticleAssignment {
  const size = Math.floor(positiveOrZero(count));
  return {
    column: new Int16Array(size).fill(PARKED),
    slot: Int32Array.from({ length: size }, (_, particle) => particle),
    counts: [],
  };
}

/** Puts `particle` in `slot` of `column`. */
function seat(next: ParticleAssignment, particle: number, column: number, slot: number): void {
  next.column[particle] = column;
  next.slot[particle] = slot;
  next.counts[column] += 1;
}

/** Keeps every particle whose old slot still exists and is free; returns those that must move. */
function keepStableParticles(
  previous: ParticleAssignment,
  occupied: Uint8Array[],
  next: ParticleAssignment,
): number[] {
  const movers: number[] = [];
  for (let particle = 0; particle < previous.column.length; particle++) {
    const column = previous.column[particle];
    const slot = previous.slot[particle];
    const slots = column >= 0 && column < occupied.length ? occupied[column] : undefined;
    if (slots && slot >= 0 && slot < slots.length && slots[slot] === 0) {
      slots[slot] = 1;
      seat(next, particle, column, slot);
    } else {
      movers.push(particle);
    }
  }
  return movers;
}

/** Seats movers in the lowest free slots, column by column; whoever is left over is parked. */
function seatMovers(movers: number[], occupied: Uint8Array[], next: ParticleAssignment): void {
  let mover = 0;
  occupied.forEach((slots, column) => {
    for (let slot = 0; slot < slots.length && mover < movers.length; slot++) {
      if (slots[slot] === 0) seat(next, movers[mover++], column, slot);
    }
  });
  for (let parkedSlot = 0; mover < movers.length; parkedSlot++) {
    next.slot[movers[mover++]] = parkedSlot;
  }
}

/**
 * Stable re-assignment. A particle keeps its column and slot while that column
 * still has room for it; only the surplus of shrinking columns (top of the stack)
 * and parked particles move, filling the lowest free slots of growing columns in
 * column order. When one slider moves, exactly the delta changes column. `previous`
 * carries the previous counts; `nextCounts` usually comes from {@link layoutParticles}.
 */
export function assignParticles(
  previous: ParticleAssignment,
  nextCounts: readonly number[],
): ParticleAssignment {
  const particleCount = previous.column.length;
  const occupied = nextCounts.map((count) => new Uint8Array(Math.floor(positiveOrZero(count))));
  const next: ParticleAssignment = {
    column: new Int16Array(particleCount).fill(PARKED),
    slot: new Int32Array(particleCount),
    counts: occupied.map(() => 0),
  };
  seatMovers(keepStableParticles(previous, occupied, next), occupied, next);
  return next;
}
