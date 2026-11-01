import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ANIMATION_PAUSED_KEY, setAnimationPaused } from "@/components/three/animation-pause";
import { PauseAnimationToggle } from "@/components/three/PauseAnimationToggle";
import { axeViolations } from "./axe";

const NAME = "Pause animation";

/** Storage that refuses every call, as in a locked-down private window. */
function blockStorage() {
  const refuse = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);
}

afterEach(() => {
  vi.restoreAllMocks();
  setAnimationPaused(false);
  localStorage.clear();
});

describe("PauseAnimationToggle", () => {
  it("is a pressed/unpressed button that remembers the choice", async () => {
    const { container } = render(<PauseAnimationToggle />);
    const toggle = screen.getByRole("button", { name: NAME });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(ANIMATION_PAUSED_KEY)).toBe("1");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem(ANIMATION_PAUSED_KEY)).toBe("0");
    expect(toggle).toHaveClass("min-h-11", "min-w-11");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("starts from the stored choice and follows a change made in another tab", () => {
    localStorage.setItem(ANIMATION_PAUSED_KEY, "1");
    render(<PauseAnimationToggle />);
    const toggle = screen.getByRole("button", { name: NAME });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    act(() => {
      localStorage.setItem(ANIMATION_PAUSED_KEY, "0");
      window.dispatchEvent(new StorageEvent("storage", { key: ANIMATION_PAUSED_KEY }));
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("renders as not paused on the server, whatever this browser stored", () => {
    localStorage.setItem(ANIMATION_PAUSED_KEY, "1");
    expect(renderToString(<PauseAnimationToggle />)).toContain('aria-pressed="false"');
  });

  it("still pauses for this page when storage is blocked", () => {
    blockStorage();
    render(<PauseAnimationToggle />);
    const toggle = screen.getByRole("button", { name: NAME });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("sits in the site header shown on the landing page and on shared plans", () => {
    render(<SiteHeader />);
    const banner = screen.getByRole("banner");
    expect(within(banner).getByRole("button", { name: NAME })).toBeInTheDocument();
    expect(within(banner).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
