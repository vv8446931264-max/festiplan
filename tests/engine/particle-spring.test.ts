// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_DT, createParticleState, isSettled, stepParticles } from "@/lib/engine/particles";

describe("stepParticles", () => {
  const target = Float32Array.from([1, 2, -3]);

  it("starts at the origin or a copy of init", () => {
    expect(Array.from(createParticleState(2).pos)).toEqual([0, 0, 0, 0, 0, 0]);
    const init = Float32Array.from([5, 6, 7, 8, 9, 10, 11]);
    expect(Array.from(createParticleState(2, init).pos)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("converges to the target without overshoot (critically damped)", () => {
    const s = createParticleState(1);
    let maxX = 0;
    for (let i = 0; i < 400; i++) {
      stepParticles(s, target, 1 / 60);
      maxX = Math.max(maxX, s.pos[0]);
    }
    expect(isSettled(s, target)).toBe(true);
    expect(maxX).toBeLessThan(1.01);
  });

  it("clamps dt to MAX_DT and ignores negative or NaN steps", () => {
    const a = stepParticles(createParticleState(1), target, 1);
    const b = stepParticles(createParticleState(1), target, MAX_DT);
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
    expect(Array.from(stepParticles(createParticleState(1), target, -1).pos)).toEqual([0, 0, 0]);
    expect(Array.from(stepParticles(createParticleState(1), target, Number.NaN).pos)).toEqual([
      0, 0, 0,
    ]);
  });

  it("honours custom stiffness, damping and lift", () => {
    const soft = stepParticles(createParticleState(1), target, 1 / 60, {
      stiffness: 5,
      damping: 1,
    });
    const stiff = stepParticles(createParticleState(1), target, 1 / 60, { stiffness: 200 });
    expect(Math.abs(stiff.pos[0])).toBeGreaterThan(Math.abs(soft.pos[0]));
    expect(
      stepParticles(createParticleState(1), Float32Array.from([4, 0, 0]), 1 / 60, { lift: 20 })
        .pos[1],
    ).toBeGreaterThan(0);
  });

  it("reports unsettled on position or velocity", () => {
    const s = createParticleState(1, Float32Array.from([1, 2, -3]));
    expect(isSettled(s, target, 0.01)).toBe(true);
    s.vel[1] = 1;
    expect(isSettled(s, target)).toBe(false);
    expect(isSettled(createParticleState(1), target)).toBe(false);
  });
});
