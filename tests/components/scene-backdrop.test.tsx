import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as TierModule from "@/three/tier";
import type { Tier } from "@/three/tier";
import { celebrate, setMood, setPalette } from "@/three/bus";
import { ANIMATION_PAUSED_KEY, setAnimationPaused } from "@/components/three/animation-pause";
import { SceneBackdrop } from "@/components/three/SceneBackdrop";
import { resetTierCache } from "@/components/three/use-tier";
import { fakeLantern, mockMatchMedia, restoreBrowserFakes, type SceneOptions } from "./three-fakes";

/** Longer than the idle fallback (200 ms) that gates the scene import in jsdom. */
const PAST_IDLE_MS = 400;

const forced = vi.hoisted(() => ({ tier: null as Tier | null }));
const createLanternScene = vi.hoisted(() => vi.fn());

vi.mock("@/three/tier", async (importOriginal) => {
  const actual = await importOriginal<typeof TierModule>();
  return { ...actual, detectTier: (win?: Window) => forced.tier ?? actual.detectTier(win) };
});
vi.mock("@/three/lantern-scene", () => ({ createLanternScene }));

beforeEach(() => {
  resetTierCache();
  forced.tier = null;
  createLanternScene.mockReset();
});

afterEach(() => {
  restoreBrowserFakes();
  setAnimationPaused(false);
  localStorage.clear();
});

describe("SceneBackdrop", () => {
  it("paints the dusk gradient and the poster under reduced motion", () => {
    mockMatchMedia(["(prefers-reduced-motion: reduce)"]);
    const { container } = render(<SceneBackdrop />);
    const root = container.querySelector("[data-scene-backdrop]");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-tier", "off");
    expect(root?.querySelector("[data-sky]")).toHaveClass("dusk-sky");
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
    expect(createLanternScene).not.toHaveBeenCalled();
  });

  it("lazy-loads the scene after first paint, forwards the bus and cleans up", async () => {
    forced.tier = "high";
    const scene = fakeLantern();
    createLanternScene.mockImplementation((_canvas: HTMLCanvasElement, options: SceneOptions) => {
      options.onFirstFrame?.();
      return scene;
    });
    const { container, unmount } = render(<SceneBackdrop />);
    expect(container.querySelector("img")).toBeNull();
    await waitFor(() => expect(createLanternScene).toHaveBeenCalledOnce());
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
    createLanternScene.mockImplementation(() => {
      throw new Error("no context");
    });
    const { container } = render(<SceneBackdrop />);
    await waitFor(() =>
      expect(container.querySelector("img")).toHaveAttribute("src", "/poster.webp"),
    );
    expect(container.querySelector("canvas")).toBeNull();
  });
});

describe("SceneBackdrop with Pause animation", () => {
  it("stops the scene for the static poster, and resuming brings a live scene back", async () => {
    forced.tier = "high";
    const [first, second] = [fakeLantern(), fakeLantern()];
    createLanternScene.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const { container } = render(<SceneBackdrop />);
    await waitFor(() => expect(createLanternScene).toHaveBeenCalledOnce());
    act(() => setAnimationPaused(true));
    // Disposing the scene disposes its render loop: nothing is drawn while paused.
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", "/poster.webp");
    act(() => setAnimationPaused(false));
    expect(container.querySelector("img")).toBeNull();
    await waitFor(() => expect(createLanternScene).toHaveBeenCalledTimes(2));
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(second.dispose).not.toHaveBeenCalled();
  });

  it("never starts the scene when the visitor paused it on an earlier visit", async () => {
    forced.tier = "high";
    localStorage.setItem(ANIMATION_PAUSED_KEY, "1");
    const { container } = render(<SceneBackdrop />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/poster.webp");
    await new Promise((resolve) => setTimeout(resolve, PAST_IDLE_MS));
    expect(createLanternScene).not.toHaveBeenCalled();
    expect(container.querySelector("canvas")).toBeNull();
  });
});
