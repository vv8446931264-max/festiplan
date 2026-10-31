// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLUMN_LAYOUT,
  assignParticles,
  columnX,
  emptyAssignment,
  hash01,
  stackHeight,
  targetsFor,
} from "@/lib/engine/particles";

describe("hash01", () => {
  it("is deterministic and stays in [0, 1)", () => {
    for (let i = -50; i < 500; i++) {
      const h = hash01(i);
      expect(h).toBe(hash01(i));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    expect(hash01(1)).not.toBe(hash01(2));
  });
});

describe("layout geometry", () => {
  const layout = DEFAULT_COLUMN_LAYOUT;

  it("centres columns and stacks layers", () => {
    expect(columnX(0, 3, layout)).toBeCloseTo(-layout.spacing);
    expect(columnX(1, 3, layout)).toBeCloseTo(0);
    expect(stackHeight(0, layout)).toBe(0);
    expect(stackHeight(layout.perLayer + 1, layout)).toBeCloseTo(2 * layout.layerHeight);
    expect(stackHeight(Number.NaN, layout)).toBe(0);
  });

  it("puts every particle inside its column, parked ones on parkY", () => {
    const a = assignParticles(emptyAssignment(40), [10, 30]);
    const t = targetsFor(a, layout);
    expect(t.length).toBe(120);
    for (let i = 0; i < 40; i++) {
      const [c, x, y] = [a.column[i], t[i * 3], t[i * 3 + 1]];
      expect(Math.abs(x - columnX(c, 2, layout))).toBeLessThanOrEqual(
        layout.radius + layout.jitter,
      );
      expect(y).toBeGreaterThanOrEqual(layout.baseY - layout.jitter);
      expect(y).toBeLessThanOrEqual(
        layout.baseY + stackHeight(a.counts[c], layout) + layout.jitter,
      );
    }
    expect(Array.from(targetsFor(a, layout))).toEqual(Array.from(t));
  });

  it("reuses a correctly sized output buffer and replaces a wrong one", () => {
    const a = assignParticles(emptyAssignment(4), [2]);
    const out = new Float32Array(12);
    expect(targetsFor(a, layout, out)).toBe(out);
    const wrong = new Float32Array(3);
    expect(targetsFor(a, layout, wrong)).not.toBe(wrong);
    expect(targetsFor(a, layout, out)[7]).toBe(layout.parkY);
  });
});
