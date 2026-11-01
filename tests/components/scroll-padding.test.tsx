import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanTabs } from "@/components/plan/PlanTabs";

/** Tailwind spacing units (0.25rem each) from a utility such as `py-3` in a class list. */
function units(classes: string, utility: string): number {
  const found = new RegExp(`(?:^|\\s)${utility}-(\\d+)(?:\\s|$)`).exec(classes)?.[1];
  if (found === undefined) throw new Error(`No ${utility}-<n> class in "${classes}"`);
  return Number(found);
}

const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

describe("scroll padding for the sticky plan tab bar (WCAG 2.4.11 Focus Not Obscured)", () => {
  it("equals the bar's height, so a focused element is never scrolled under it", () => {
    render(<PlanTabs active="overview" onSelect={vi.fn()} />);
    const bar = screen.getByRole("tablist");
    expect(bar).toHaveClass("sticky", "top-0");
    const [tab] = screen.getAllByRole("tab");
    // The bar is padded top and bottom around buttons at least `min-h-*` tall.
    const barUnits = 2 * units(bar.className, "py") + units(tab.className, "min-h");
    expect(/STICKY_BAR_SCROLL_PADDING = "scroll-pt-(\d+)"/.exec(layout)?.[1]).toBe(`${barUnits}`);
  });

  it("is applied to the <html> element", () => {
    expect(layout).toMatch(/<html[^>]*className=\{`[^`]*\$\{STICKY_BAR_SCROLL_PADDING\}/);
  });
});
