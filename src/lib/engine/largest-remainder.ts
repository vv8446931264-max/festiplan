/** Weights are scaled to integers with this many steps per unit before the exact split. */
const WEIGHT_SCALE = 1_000_000;

type Share = { index: number; whole: bigint; remainder: bigint };

/** A weight as an exact integer; negative, zero or non-finite weights count as 0. */
const toScaledWeight = (weight: number): bigint =>
  Number.isFinite(weight) && weight > 0 ? BigInt(Math.round(weight * WEIGHT_SCALE)) : 0n;

/** Exact integer weights; when none is positive, every part weighs the same (an even split). */
function scaledWeights(weights: readonly number[]): bigint[] {
  const scaled = weights.map(toScaledWeight);
  return scaled.some((weight) => weight > 0n) ? scaled : weights.map(() => 1n);
}

/** Largest remainder first; equal remainders go to the lower index. */
function byRemainderThenIndex(a: Share, b: Share): number {
  if (a.remainder === b.remainder) return a.index - b.index;
  return a.remainder > b.remainder ? -1 : 1;
}

/**
 * Splits an integer `total` across `weights` so the parts are non-negative integers
 * that sum exactly to `total`. Uses exact (BigInt) largest-remainder; ties go to the
 * lower index. Zero or invalid weights split evenly. No weights gives `[]`.
 * @param total Integer amount to split (negatives are treated as 0).
 * @param weights Relative weights.
 */
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const scaled = scaledWeights(weights);
  const totalWeight = scaled.reduce((accumulated, weight) => accumulated + weight, 0n);
  const amount = BigInt(Math.max(0, Math.trunc(total)));
  const shares: Share[] = scaled.map((weight, index) => ({
    index,
    whole: (amount * weight) / totalWeight,
    remainder: (amount * weight) % totalWeight,
  }));
  const handedOut = shares.reduce((accumulated, share) => accumulated + share.whole, 0n);
  const leftover = Number(amount - handedOut);
  const parts = shares.map((share) => Number(share.whole));
  for (const share of [...shares].sort(byRemainderThenIndex).slice(0, leftover)) {
    parts[share.index] += 1;
  }
  return parts;
}
