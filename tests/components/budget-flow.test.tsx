import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as TierModule from "@/three/tier";
import type { Tier } from "@/three/tier";
import { setAnimationPaused } from "@/components/three/animation-pause";
import { BudgetFlow } from "@/components/three/BudgetFlow";
import { resetTierCache } from "@/components/three/use-tier";
import {
  ALLOCATIONS,
  fakeFlow,
  installIntersectionObserver,
  restoreBrowserFakes,
  type SceneOptions,
} from "./three-fakes";

const forced = vi.hoisted(() => ({ tier: null as Tier | null }));
const createBudgetFlowScene = vi.hoisted(() => vi.fn());

vi.mock("@/three/tier", async (importOriginal) => {
  const actual = await importOriginal<typeof TierModule>();
  return { ...actual, detectTier: (win?: Window) => forced.tier ?? actual.detectTier(win) };
});
vi.mock("@/three/budget-flow-scene", () => ({ createBudgetFlowScene }));

beforeEach(() => {
  resetTierCache();
  forced.tier = null;
  createBudgetFlowScene.mockReset();
});

afterEach(() => {
  act(() => setAnimationPaused(false));
  restoreBrowserFakes();
});

describe("BudgetFlow", () => {
  it("renders an aria-hidden static fallback with one bar per category", () => {
    forced.tier = "off";
    const onHighlight = vi.fn();
    const { container } = render(
      <BudgetFlow allocations={ALLOCATIONS} highlight="decor" onHighlight={onHighlight} />,
    );
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveAttribute("data-budget-flow", "off");
    const bars = container.querySelectorAll("[data-category]");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveAttribute("opacity", "0.38");
    expect(bars[2]).toHaveAttribute("opacity", "1");
    fireEvent.pointerEnter(bars[1]);
    expect(onHighlight).toHaveBeenLastCalledWith("catering");
    fireEvent.pointerLeave(bars[1]);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    expect(createBudgetFlowScene).not.toHaveBeenCalled();
  });

  it("keeps a fixed 4:3 box unless the caller passes an aspect class", () => {
    forced.tier = "off";
    const plain = render(<BudgetFlow allocations={[]} highlight={null} />);
    expect(plain.container.firstElementChild).toHaveClass("aspect-[4/3]");
    const sized = render(
      <BudgetFlow allocations={[]} highlight={null} className="aspect-[16/9] w-full" />,
    );
    expect(sized.container.firstElementChild).toHaveClass("aspect-[16/9]");
    expect(sized.container.firstElementChild).not.toHaveClass("aspect-[4/3]");
  });

  it("loads the scene when visible, syncs props, reports hover and pauses off-screen", async () => {
    forced.tier = "high";
    const intersect = installIntersectionObserver();
    const flow = fakeFlow();
    createBudgetFlowScene.mockImplementation(
      (_canvas: HTMLCanvasElement, options: SceneOptions) => {
        options.onFirstFrame?.();
        return flow.api;
      },
    );
    const onHighlight = vi.fn();
    const view = render(
      <BudgetFlow allocations={ALLOCATIONS} highlight={null} onHighlight={onHighlight} />,
    );
    expect(createBudgetFlowScene).not.toHaveBeenCalled();
    act(() => intersect(true));
    await waitFor(() => expect(createBudgetFlowScene).toHaveBeenCalledOnce());
    expect(flow.api.setAllocations).toHaveBeenCalledWith(ALLOCATIONS);
    await waitFor(() => expect(view.container.querySelector("svg")).toHaveClass("opacity-0"));
    act(() => flow.hover("venue"));
    expect(onHighlight).toHaveBeenLastCalledWith("venue");
    const next = ALLOCATIONS.map((line) =>
      line.category === "decor" ? { ...line, amountINR: 250_000 } : line,
    );
    view.rerender(<BudgetFlow allocations={next} highlight="decor" onHighlight={onHighlight} />);
    expect(flow.api.setAllocations).toHaveBeenLastCalledWith(next);
    expect(flow.api.setHighlight).toHaveBeenLastCalledWith("decor");
    act(() => intersect(false));
    expect(flow.api.pause).toHaveBeenCalled();
    view.unmount();
    expect(flow.api.dispose).toHaveBeenCalledOnce();
  });
});
