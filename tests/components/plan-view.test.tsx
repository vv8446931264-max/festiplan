import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanView } from "@/components/plan/PlanView";
import { fixturePlan } from "../fixtures/plan";
import { axeViolations } from "./axe";
import { jsonResponse, respondWith } from "./fetch-stubs";

vi.mock("@/components/three/lazy", () => ({
  LazyBudgetFlow: () => null,
  LazySceneBackdrop: () => null,
}));
vi.mock("@/three/bus", () => ({ setPalette: vi.fn(), setMood: vi.fn(), celebrate: vi.fn() }));

const EDIT_KEY = "k".repeat(43);

/** Every budget line plus the contingency, read back from the rendered data attributes. */
const budgetTotal = (container: HTMLElement) => {
  const lines = [...container.querySelectorAll("[data-amount]")].map((element) =>
    Number(element.getAttribute("data-amount")),
  );
  const contingency = Number(
    container.querySelector("[data-contingency]")?.getAttribute("data-contingency"),
  );
  return lines.reduce((sum, amount) => sum + amount, 0) + contingency;
};

const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal(
    "fetch",
    respondWith(() => jsonResponse({ plan: {} })),
  );
});

describe("PlanView", () => {
  it("opens on an overview of every chapter, with no axe violations", async () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={EDIT_KEY} />);
    expect(screen.getByRole("heading", { level: 2, name: "Riya's sangeet" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    const overview = screen.getByRole("tabpanel", { name: "Overview" });
    for (const card of ["Three concepts", "The money", "What's next", "Who to book first"]) {
      expect(within(overview).getByRole("heading", { name: card })).toBeInTheDocument();
    }
    expect(screen.getByText("Ideas by Gemini · gemini-3.5-flash")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("shows one chapter at a time and every chapter passes axe", async () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={EDIT_KEY} />);
    openTab("Ideas");
    expect(screen.getAllByText(/^Issue Nº 0/)).toHaveLength(3);
    expect(screen.queryByRole("tabpanel", { name: "Overview" })).toBeNull();
    openTab("Budget");
    expect(screen.getByRole("heading", { name: /12,00,000, accounted for/ })).toBeInTheDocument();
    openTab("Timeline");
    expect(screen.getAllByRole("group").length).toBeGreaterThan(0);
    expect(window.location.hash).toBe("#timeline");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("supports arrow, Home and End keys and the URL hash", () => {
    window.history.replaceState(null, "", "/#vendors");
    render(<PlanView plan={fixturePlan()} editKey={null} />);
    const vendors = screen.getByRole("tab", { name: "Vendors" });
    expect(vendors).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(vendors, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Ask" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Ask" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Ask" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Share" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Share" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("overview cards open their chapter", () => {
    render(<PlanView plan={fixturePlan()} editKey={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Open the timeline/ }));
    expect(screen.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the budget exact while a slider moves, and respects locks", () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={EDIT_KEY} />);
    openTab("Budget");
    expect(budgetTotal(container)).toBe(1_200_000);
    const venue = screen.getByRole("slider", { name: "Venue" });
    fireEvent.change(venue, { target: { value: "50000" } });
    expect(budgetTotal(container)).toBe(1_200_000);
    expect(container.querySelector('[data-category="venue"]')?.getAttribute("data-amount")).toBe(
      "50000",
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Lock Venue" }));
    expect(venue).toBeDisabled();
  });

  it("is read-only without an edit key", async () => {
    const { container } = render(<PlanView plan={fixturePlan()} editKey={null} />);
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    openTab("Budget");
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    openTab("Timeline");
    expect(
      within(screen.getByRole("tabpanel", { name: "Timeline" })).queryAllByRole("checkbox"),
    ).toHaveLength(0);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("explains a compressed schedule once instead of flagging every task", () => {
    render(<PlanView plan={fixturePlan({ eventDate: "2026-11-05" })} editKey={null} />);
    openTab("Timeline");
    expect(screen.getByRole("note")).toHaveTextContent(/compressed proportionally/);
    expect(screen.queryByText(/Crunch/i)).toBeNull();
  });

  it("labels template plans honestly", () => {
    render(<PlanView plan={fixturePlan({}, "template")} editKey={null} />);
    expect(screen.getByText("Template plan — AI unavailable")).toBeInTheDocument();
  });

  it("marks AI-written text with the plan language", () => {
    const { container } = render(
      <PlanView plan={fixturePlan({ language: "hi" })} editKey={null} />,
    );
    expect(container.querySelectorAll('[lang="hi"]').length).toBeGreaterThan(5);
  });

  it("records actual spend and shows the variance", () => {
    render(<PlanView plan={fixturePlan()} editKey={EDIT_KEY} />);
    openTab("Budget");
    const input = screen.getByRole("textbox", { name: /spent so far on venue/i });
    fireEvent.change(input, { target: { value: "9,99,999" } });
    fireEvent.blur(input);
    expect(screen.getByText(/Venue/, { selector: "strong" })).toBeInTheDocument();
  });
});
