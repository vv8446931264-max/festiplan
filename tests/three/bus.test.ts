// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import * as shared from "@/three/bus";
import { createBus, normalizePalette, type Mood, type SceneEvent } from "@/three/bus";

describe("normalizePalette", () => {
  it("keeps lower-cased #rrggbb colours, at most eight", () => {
    expect(normalizePalette(["#FFBF02", "red", "#12345", "#a1b2c3"])).toEqual(["#ffbf02", "#a1b2c3"]);
    expect(normalizePalette(Array.from({ length: 12 }, () => "#000000"))).toHaveLength(8);
  });

  it("maps null and empty results to null", () => {
    expect(normalizePalette(null)).toBeNull();
    expect(normalizePalette(["nope"])).toBeNull();
    expect(normalizePalette([1 as unknown as string])).toBeNull();
  });
});

describe("createBus", () => {
  it("starts in the hero mood with no palette", () => {
    expect(createBus().getState()).toEqual({ palette: null, mood: "hero", celebrations: 0 });
  });

  it("delivers each change with the state after it", () => {
    const bus = createBus();
    const seen: [SceneEvent, number][] = [];
    bus.subscribe((event, state) => seen.push([event, state.celebrations]));
    bus.celebrate();
    bus.setMood("focus");
    bus.setPalette(["#CD197D"]);
    expect(seen).toEqual([
      [{ type: "celebrate" }, 1],
      [{ type: "mood", mood: "focus" }, 1],
      [{ type: "palette", palette: ["#cd197d"] }, 1],
    ]);
    expect(bus.getState()).toEqual({ palette: ["#cd197d"], mood: "focus", celebrations: 1 });
  });

  it("skips no-op and invalid changes", () => {
    const bus = createBus();
    const listener = vi.fn();
    bus.subscribe(listener);
    bus.setMood("hero");
    bus.setMood("party" as Mood);
    bus.setPalette(null);
    bus.setPalette(["#ffffff"]);
    bus.setPalette(["#FFFFFF"]);
    bus.setPalette(["#ffffff", "#000000"]);
    bus.setPalette(["#000000", "#ffffff"]);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("unsubscribes, even from inside a dispatch", () => {
    const bus = createBus();
    const second = vi.fn();
    const off = bus.subscribe(() => off());
    bus.subscribe(second);
    bus.celebrate();
    bus.celebrate();
    expect(second).toHaveBeenCalledTimes(2);
    const third = vi.fn();
    const offThird = bus.subscribe(third);
    offThird();
    bus.celebrate();
    expect(second).toHaveBeenCalledTimes(3);
    expect(third).not.toHaveBeenCalled();
  });

  it("keeps separate buses isolated", () => {
    const a = createBus();
    const b = createBus();
    a.setMood("plan");
    expect(b.getState().mood).toBe("hero");
  });
});

describe("module-level bus", () => {
  it("is one shared instance behind the named functions", () => {
    const listener = vi.fn();
    const off = shared.subscribe(listener);
    shared.setMood("plan");
    shared.setPalette(["#445231"]);
    shared.celebrate();
    expect(shared.getState()).toMatchObject({ mood: "plan", palette: ["#445231"], celebrations: 1 });
    expect(listener).toHaveBeenCalledTimes(3);
    off();
    shared.setMood("hero");
    shared.setPalette(null);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
