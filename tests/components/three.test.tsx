import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetCategory } from "@/lib/contracts";
import type * as TierModule from "@/three/tier";
import type { Tier } from "@/three/tier";
import { celebrate, setMood, setPalette } from "@/three/bus";
import { BudgetFlow } from "@/components/three/BudgetFlow";
import { SceneBackdrop } from "@/components/three/SceneBackdrop";
import { resetTierCache } from "@/components/three/use-tier";

const forced = vi.hoisted(() => ({ tier: null as Tier | null }));
const scenes = vi.hoisted(() => ({ lantern: vi.fn(), flow: vi.fn() }));

vi.mock("@/three/tier", async (importOriginal) => {
  const actual = await importOriginal<typeof TierModule>();
  return { ...actual, detectTier: (win?: Window) => forced.tier ?? actual.detectTier(win) };
});
vi.mock("@/three/lantern-scene", () => ({ createLanternScene: scenes.lantern }));
vi.mock("@/three/budget-flow-scene", () => ({ createBudgetFlowScene: scenes.flow }));

type Options = { onFirstFrame?: () => void };
const methods = ["setScroll", "setPointer", "setPalette", "setMood", "celebrate", "resize", "pause", "resume", "dispose"] as const;
const fakeLantern = () => Object.fromEntries(methods.map((m) => [m, vi.fn()])) as Record<(typeof methods)[number], ReturnType<typeof vi.fn>>;

function fakeFlow() {
  let hover: (c: BudgetCategory | null) => void = () => undefined;
  const api = {
    setAllocations: vi.fn(),
    setHighlight: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    onHover: vi.fn((cb: (c: BudgetCategory | null) => void) => {
      hover = cb;
      return () => undefined;
    }),
  };
  return { api, hover: (c: BudgetCategory | null) => hover(c) };
}

function mockMatchMedia(matching: string[]) {
  const impl = (query: string) => ({ matches: matching.includes(query), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: vi.fn(impl) });
}

const allocations = [
  { category: "venue" as const, amountINR: 400_000 },
  { category: "catering" as const, amountINR: 300_000 },
  { category: "decor" as const, amountINR: 100_000 },
];

beforeEach(() => {
  resetTierCache();
  forced.tier = null;
  scenes.lantern.mockReset();
  scenes.flow.mockReset();
});

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(window, "IntersectionObserver");
  vi.restoreAllMocks();
});

describe("SceneBackdrop", () => {
  it("paints the dusk gradient and the poster under reduced motion", () => {
    mockMatchMedia(["(prefers-reduced-motion: reduce)"]);
    const { container } = render(<SceneBackdrop />);
    const root = container.querySelector("[data-scene-backdrop]");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-tier", "off");
    expect(root?.querySelector("[data-sky]")?.getAttribute("style")).toContain("linear-gradient");
    const poster = container.querySelector("img");
    expect(poster).toHaveAttribute("src", "/poster.webp");
    expect(poster).toHaveAttribute("alt", "");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("never throws in jsdom without WebGL and falls back to the poster", () => {
    vi.spyOn(window.navigator, "hardwareConcurrency", "get").mockReturnValue(8);
    const probe = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(<SceneBackdrop />);
    expect(probe).toHaveBeenCalled();
    expect(container.querySelector("img")).toHaveAttribute("src", "/poster.webp");
    expect(scenes.lantern).not.toHaveBeenCalled();
  });

  it("lazy-loads the scene after first paint, forwards the bus and cleans up", async () => {
    forced.tier = "high";
    const scene = fakeLantern();
    scenes.lantern.mockImplementation((_canvas: HTMLCanvasElement, opts: Options) => {
      opts.onFirstFrame?.();
      return scene;
    });
    const { container, unmount } = render(<SceneBackdrop />);
    expect(container.querySelector("img")).toBeNull();
    await waitFor(() => expect(scenes.lantern).toHaveBeenCalledOnce());
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas?.style.getPropertyValue("--lantern-on")).toBe("1");
    expect(scene.setMood).toHaveBeenCalledWith("hero");
    expect(scene.resume).toHaveBeenCalled();
    act(() => {
      celebrate();
      setPalette(["#CD197D"]);
      setMood("focus");
      fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
      fireEvent.scroll(window);
    });
    expect(scene.celebrate).toHaveBeenCalledOnce();
    expect(scene.setPalette).toHaveBeenLastCalledWith(["#cd197d"]);
    expect(scene.setMood).toHaveBeenLastCalledWith("focus");
    unmount();
    expect(scene.dispose).toHaveBeenCalledOnce();
    expect(canvas?.isConnected).toBe(false);
    setMood("hero");
    setPalette(null);
  });

  it("shows the poster when the WebGL context cannot be created", async () => {
    forced.tier = "low";
    scenes.lantern.mockImplementation(() => {
      throw new Error("no context");
    });
    const { container } = render(<SceneBackdrop />);
    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", "/poster.webp"));
    expect(container.querySelector("canvas")).toBeNull();
  });
});

describe("BudgetFlow", () => {
  it("renders an aria-hidden static fallback with one bar per category", () => {
    forced.tier = "off";
    const onHighlight = vi.fn();
    const { container } = render(<BudgetFlow allocations={allocations} highlight="decor" onHighlight={onHighlight} />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-budget-flow", "off");
    const bars = container.querySelectorAll("[data-category]");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute("opacity", "0.38");
    expect(bars[2]).toHaveAttribute("opacity", "1");
    fireEvent.pointerEnter(bars[1] as Element);
    expect(onHighlight).toHaveBeenLastCalledWith("catering");
    fireEvent.pointerLeave(bars[1] as Element);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    expect(scenes.flow).not.toHaveBeenCalled();
  });

  it("keeps a fixed 4:3 box unless the caller passes an aspect class", () => {
    forced.tier = "off";
    const plain = render(<BudgetFlow allocations={[]} highlight={null} />);
    expect(plain.container.firstElementChild?.getAttribute("style")).toContain("aspect-ratio");
    const sized = render(<BudgetFlow allocations={[]} highlight={null} className="aspect-[16/9] w-full" />);
    expect(sized.container.firstElementChild?.getAttribute("style")).not.toContain("aspect-ratio");
  });

  it("loads the scene when visible, syncs props, reports hover and pauses off-screen", async () => {
    forced.tier = "high";
    const observers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    class FakeIO {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    }
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, writable: true, value: FakeIO });
    const flow = fakeFlow();
    scenes.flow.mockImplementation((_canvas: HTMLCanvasElement, opts: Options) => {
      opts.onFirstFrame?.();
      return flow.api;
    });
    const onHighlight = vi.fn();
    const view = render(<BudgetFlow allocations={allocations} highlight={null} onHighlight={onHighlight} />);
    expect(scenes.flow).not.toHaveBeenCalled();
    act(() => observers.forEach((cb) => cb([{ isIntersecting: true }])));
    await waitFor(() => expect(scenes.flow).toHaveBeenCalledOnce());
    expect(flow.api.setAllocations).toHaveBeenCalledWith(allocations);
    await waitFor(() => expect(view.container.querySelector("svg")?.getAttribute("style")).toContain("opacity: 0"));
    act(() => flow.hover("venue"));
    expect(onHighlight).toHaveBeenLastCalledWith("venue");
    const next = allocations.map((a) => (a.category === "decor" ? { ...a, amountINR: 250_000 } : a));
    view.rerender(<BudgetFlow allocations={next} highlight="decor" onHighlight={onHighlight} />);
    expect(flow.api.setAllocations).toHaveBeenLastCalledWith(next);
    expect(flow.api.setHighlight).toHaveBeenLastCalledWith("decor");
    act(() => observers.forEach((cb) => cb([{ isIntersecting: false }])));
    expect(flow.api.pause).toHaveBeenCalled();
    view.unmount();
    expect(flow.api.dispose).toHaveBeenCalledOnce();
  });
});
