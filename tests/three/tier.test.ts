// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { detectTier, hasWebGL, readSignals, tierFrom, type TierSignals } from "@/three/tier";

const good: TierSignals = {
  reducedMotion: false,
  saveData: false,
  hardwareConcurrency: 8,
  webgl: true,
  coarsePointer: false,
  viewportWidth: 1440,
  deviceMemory: 8,
};

type Fake = {
  media?: Record<string, boolean>;
  nav?: Record<string, unknown>;
  width?: number;
  context?: "webgl2" | "webgl" | "none" | "throw";
};

function fakeWindow({
  media = {},
  nav = { hardwareConcurrency: 8 },
  width = 1440,
  context = "webgl2",
}: Fake) {
  const loseContext = vi.fn();
  const getContext = vi.fn((kind: string) => {
    if (context === "throw") throw new Error("blocked");
    return kind === context ? { getExtension: () => ({ loseContext }) } : null;
  });
  const win = {
    matchMedia: (q: string) => ({ matches: media[q] }),
    navigator: nav,
    innerWidth: width,
    document: { createElement: () => ({ getContext }) },
  };
  return { win: win as unknown as Window, getContext, loseContext };
}

describe("tierFrom", () => {
  it("is high on a capable desktop", () => {
    expect(tierFrom(good)).toBe("high");
    expect(tierFrom({ ...good, hardwareConcurrency: undefined, deviceMemory: undefined })).toBe(
      "high",
    );
  });

  it.each<[string, Partial<TierSignals>]>([
    ["reduced motion", { reducedMotion: true }],
    ["Save-Data", { saveData: true }],
    ["no WebGL", { webgl: false }],
    ["four cores", { hardwareConcurrency: 4 }],
    ["two cores", { hardwareConcurrency: 2 }],
  ])("is off with %s", (_, patch) => {
    expect(tierFrom({ ...good, ...patch })).toBe("off");
  });

  it.each<[string, Partial<TierSignals>]>([
    ["a coarse pointer", { coarsePointer: true }],
    ["a narrow viewport", { viewportWidth: 767 }],
    ["4 GiB of memory", { deviceMemory: 4 }],
  ])("is low with %s", (_, patch) => {
    expect(tierFrom({ ...good, ...patch })).toBe("low");
  });

  it("lets off win over low", () => {
    expect(tierFrom({ ...good, coarsePointer: true, reducedMotion: true })).toBe("off");
  });
});

describe("readSignals", () => {
  it("reads media queries and navigator hints", () => {
    const { win } = fakeWindow({
      media: { "(prefers-reduced-motion: reduce)": true, "(pointer: coarse)": true },
      nav: { hardwareConcurrency: 6, deviceMemory: 2, connection: { saveData: true } },
      width: 390,
    });
    expect(readSignals(win)).toEqual({
      reducedMotion: true,
      saveData: true,
      hardwareConcurrency: 6,
      webgl: true,
      coarsePointer: true,
      viewportWidth: 390,
      deviceMemory: 2,
    });
  });

  it("tolerates missing matchMedia and hints, and can skip the WebGL probe", () => {
    const { win, getContext } = fakeWindow({
      nav: { hardwareConcurrency: Number.NaN },
      context: "none",
    });
    (win as unknown as { matchMedia: unknown }).matchMedia = undefined;
    const s = readSignals(win, false);
    expect(s.reducedMotion).toBe(false);
    expect(s.hardwareConcurrency).toBeUndefined();
    expect(s.deviceMemory).toBeUndefined();
    expect(s.saveData).toBe(false);
    expect(s.webgl).toBe(true);
    expect(getContext).not.toHaveBeenCalled();
  });
});

describe("hasWebGL", () => {
  it("prefers WebGL2 and releases the probe context", () => {
    const { win, loseContext } = fakeWindow({ context: "webgl2" });
    expect(hasWebGL(win)).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("falls back to WebGL1, and is false when neither exists or creation throws", () => {
    expect(hasWebGL(fakeWindow({ context: "webgl" }).win)).toBe(true);
    expect(hasWebGL(fakeWindow({ context: "none" }).win)).toBe(false);
    expect(hasWebGL(fakeWindow({ context: "throw" }).win)).toBe(false);
  });
});

describe("detectTier", () => {
  it("does not probe WebGL when cheap signals already say off", () => {
    const { win, getContext } = fakeWindow({ media: { "(prefers-reduced-motion: reduce)": true } });
    expect(detectTier(win)).toBe("off");
    expect(getContext).not.toHaveBeenCalled();
  });

  it("probes WebGL otherwise", () => {
    expect(detectTier(fakeWindow({}).win)).toBe("high");
    expect(detectTier(fakeWindow({ context: "none" }).win)).toBe("off");
    expect(detectTier(fakeWindow({ width: 500 }).win)).toBe("low");
  });
});
