import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanView } from "@/components/plan/PlanView";
import { fixturePlan } from "../fixtures/plan";
import { axeViolations } from "./axe";

vi.mock("@/components/three/lazy", () => ({ LazyBudgetFlow: () => null, LazySceneBackdrop: () => null }));
vi.mock("@/three/bus", () => ({ setPalette: vi.fn(), setMood: vi.fn(), celebrate: vi.fn() }));

const sumOf = (container: HTMLElement) => {
  const lines = [...container.querySelectorAll("[data-amount]")].map((el) => Number(el.getAttribute("data-amount")));
  const contingency = Number(container.querySelector("[data-contingency]")?.getAttribute("data-contingency"));
  return lines.reduce((a, b) => a + b, 0) + contingency;
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ plan: {} }), { status: 200 })));
});

describe("PlanView", () => {
  it("renders every chapter of the plan with no axe violations", async () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={"k".repeat(43)} />);
    expect(screen.getByRole("heading", { level: 2, name: "Riya's sangeet" })).toBeInTheDocument();
    expect(screen.getAllByText(/^Issue Nº 0/)).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /12,00,000, accounted for/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Timeline by phase" })).toBeInTheDocument();
    expect(screen.getByText("Ideas by Gemini · gemini-3.5-flash")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("keeps the budget exact while a slider moves, and respects locks", () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={"k".repeat(43)} />);
    expect(sumOf(container)).toBe(1_200_000);
    const venue = screen.getByRole("slider", { name: "Venue" });
    fireEvent.change(venue, { target: { value: "50000" } });
    expect(sumOf(container)).toBe(1_200_000);
    expect(container.querySelector('[data-category="venue"]')?.getAttribute("data-amount")).toBe("50000");
    fireEvent.click(screen.getByRole("checkbox", { name: "Lock Venue" }));
    expect(venue).toBeDisabled();
  });

  it("is read-only without an edit key", async () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={null} />);
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(within(screen.getByRole("region", { name: "Timeline by phase" })).queryAllByRole("checkbox")).toHaveLength(0);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("labels template plans honestly", () => {
    render(<PlanView plan={fixturePlan({}, "template")} editKey={null} />);
    expect(screen.getByText("Template plan — AI unavailable")).toBeInTheDocument();
  });

  it("marks AI-written text with the plan language", () => {
    const { container } = render(<PlanView plan={fixturePlan({ language: "hi" })} editKey={null} />);
    expect(container.querySelectorAll('[lang="hi"]').length).toBeGreaterThan(5);
  });

  it("records actual spend and shows the variance", () => {
    render(<PlanView plan={fixturePlan()} editKey={"k".repeat(43)} />);
    const input = screen.getByRole("textbox", { name: /spent so far on venue/i });
    fireEvent.change(input, { target: { value: "9,99,999" } });
    fireEvent.blur(input);
    expect(screen.getByText(/Venue/, { selector: "strong" })).toBeInTheDocument();
  });
});
