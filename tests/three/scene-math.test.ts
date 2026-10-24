// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DUSK_BACKGROUND, DUSK_STOPS, lanternFade, skyFade } from "@/three/dusk";
import { DEPTH_RANGE, emptyPose, placeLights, poseFor } from "@/three/lantern-layout";
import { clamp01, damp, smoothstep, wrap } from "@/three/math";

describe("math helpers", () => {
  it("damps frame-rate independently", () => {
    const once = damp(0, 1, 4, 0.2);
    const twice = damp(damp(0, 1, 4, 0.1), 1, 4, 0.1);
    expect(once).toBeCloseTo(twice, 10);
    expect(damp(3, 7, 4, 0)).toBe(3);
  });

  it("smoothsteps in both directions and wraps into a range", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(1, 0, 0)).toBe(1);
    expect(wrap(12, 0, 10)).toBe(2);
    expect(wrap(-1, 0, 10)).toBe(9);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("dusk sky", () => {
  it("runs top to bottom and ends in espresso", () => {
    expect(DUSK_STOPS[0]?.at).toBe(0);
    expect(DUSK_STOPS.at(-1)).toEqual({ at: 1, color: "#100904" });
    expect(DUSK_BACKGROUND).toContain("linear-gradient(180deg");
  });

  it("fades from full sky to 45 % by a quarter of the page", () => {
    expect(skyFade(0)).toBe(1);
    expect(skyFade(0.25)).toBeCloseTo(0.45);
    expect(skyFade(1)).toBeCloseTo(0.45);
    expect(skyFade(0.1)).toBeLessThan(1);
  });
});

describe("lantern layout", () => {
  const frame = { time: 3, travel: 0, lift: 0, tanHalf: Math.tan(Math.PI / 8), aspect: 1.6 };

  it("is deterministic and keeps lanterns inside the depth range", () => {
    const a = placeLights(120, 20);
    expect(a).toEqual(placeLights(120, 20));
    expect(a.filter((l) => l.body)).toHaveLength(120);
    const pose = emptyPose();
    for (const light of a.filter((l) => l.body)) {
      for (const travel of [0, 7, 33]) {
        poseFor(light, { ...frame, travel }, pose);
        expect(-pose.z).toBeGreaterThanOrEqual(DEPTH_RANGE.near);
        expect(-pose.z).toBeLessThan(DEPTH_RANGE.far);
        expect(pose.fade).toBeGreaterThanOrEqual(0);
        expect(pose.fade).toBeLessThanOrEqual(1);
      }
    }
  });

  it("blurs the foreground more than the distance", () => {
    const pose = emptyPose();
    const near = poseFor({ ...placeLights(1, 0)[0], depth: 5 }, frame, { ...pose }).blur;
    const far = poseFor({ ...placeLights(1, 0)[0], depth: 50 }, frame, { ...pose }).blur;
    expect(near).toBeGreaterThan(far);
  });
});

describe("lanternFade", () => {
  it("is full over the hero and settles at 30% in the working chapters", () => {
    expect(lanternFade(0, 900)).toBe(1);
    expect(lanternFade(450, 900)).toBe(1);
    expect(lanternFade(900, 900)).toBeCloseTo(0.65);
    expect(lanternFade(1350, 900)).toBeCloseTo(0.3);
    expect(lanternFade(9000, 900)).toBeCloseTo(0.3);
    expect(lanternFade(100, 0)).toBe(1);
  });
});
