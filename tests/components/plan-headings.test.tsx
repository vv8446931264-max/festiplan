import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanView } from "@/components/plan/PlanView";
import { VendorsSection } from "@/components/plan/VendorsSection";
import { CATEGORY_LABELS } from "@/lib/contracts/constants";
import { fixturePlan } from "../fixtures/plan";
import { jsonResponse, respondWith } from "./fetch-stubs";

vi.mock("@/components/three/lazy", () => ({
  LazyBudgetFlow: () => null,
  LazySceneBackdrop: () => null,
}));
vi.mock("@/three/bus", () => ({ setPalette: vi.fn(), setMood: vi.fn(), celebrate: vi.fn() }));

/** Chapters whose headline is a SectionHead (the Overview has its own heading markup). */
const SECTION_HEAD_CHAPTERS = ["Ideas", "Budget", "Timeline", "Vendors", "Ask", "Share"];

const PLAN_TITLE = "Riya's sangeet";

const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.stubGlobal(
    "fetch",
    respondWith(() => jsonResponse({ plan: {} })),
  );
});

/** Every SectionHead chapter headline sits one level below the plan title. */
function expectChaptersBelowTitle(chapterLevel: number) {
  for (const name of SECTION_HEAD_CHAPTERS) {
    openTab(name);
    const [headline] = within(screen.getByRole("tabpanel")).getAllByRole("heading");
    expect(headline).toHaveAttribute("id", `${name.toLowerCase()}-title`);
    expect(headline.tagName).toBe(`H${chapterLevel}`);
  }
}

describe("PlanView heading levels", () => {
  it("on the share page (h1 title): chapters are h2 and a vendor card title is h3", () => {
    render(<PlanView plan={fixturePlan()} editKey={null} titleAs="h1" />);
    expect(screen.getByRole("heading", { level: 1, name: PLAN_TITLE })).toBeInTheDocument();
    expectChaptersBelowTitle(2);
    openTab("Vendors");
    const panel = within(screen.getByRole("tabpanel", { name: "Vendors" }));
    expect(panel.getByRole("heading", { level: 3, name: "Venue" })).toBeInTheDocument();
  });

  it("inside the landing page (h2 title, the default): chapters are h3 and a vendor card title is h4", () => {
    render(<PlanView plan={fixturePlan()} editKey={null} />);
    expect(screen.getByRole("heading", { level: 2, name: PLAN_TITLE })).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
    expectChaptersBelowTitle(3);
    openTab("Vendors");
    const panel = within(screen.getByRole("tabpanel", { name: "Vendors" }));
    expect(panel.getByRole("heading", { level: 4, name: "Venue" })).toBeInTheDocument();
  });
});

describe("VendorsSection overdue flag (WCAG 1.4.1 Use of Colour)", () => {
  /** The fixture's vendors: the first late and unbooked, the second late but booked. */
  function renderVendors(lateCount: number) {
    const plan = fixturePlan();
    const vendors = plan.vendors.map((vendor, index) => ({
      ...vendor,
      overdue: index < lateCount,
      done: index === 1,
    }));
    render(
      <VendorsSection
        planId={plan.id}
        input={plan.input}
        vendors={vendors}
        editable={false}
        onToggle={vi.fn()}
      />,
    );
    return vendors;
  }

  it("shows a text badge on exactly the late, unbooked vendor", () => {
    const [late] = renderVendors(2);
    expect(screen.getAllByText("Overdue")).toHaveLength(1);
    const card = screen.getByRole("article", { name: CATEGORY_LABELS[late.category] });
    expect(within(card).getByText("Overdue")).toBeVisible();
  });

  it("shows no badge when nothing is late", () => {
    renderVendors(0);
    expect(screen.queryByText("Overdue")).toBeNull();
  });
});
