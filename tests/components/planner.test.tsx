import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerApp } from "@/components/planner/PlannerApp";
import { fixturePlan } from "../fixtures/plan";
import { axeViolations } from "./axe";

vi.mock("@/components/three/lazy", () => ({
  LazyBudgetFlow: () => null,
  LazySceneBackdrop: () => null,
}));
const bus = vi.hoisted(() => ({ setPalette: vi.fn(), setMood: vi.fn(), celebrate: vi.fn() }));
vi.mock("@/three/bus", () => bus);

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => {
  localStorage.clear();
  Object.values(bus).forEach((mock) => mock.mockClear());
});

describe("PlannerApp", () => {
  it("renders the brief form accessibly", async () => {
    const { container } = render(<PlannerApp />);
    expect(screen.getByRole("radio", { name: /Wedding/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /·/ })).toHaveLength(3);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("shows a focused error summary for an empty brief and makes no request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PlannerApp />);
    fireEvent.click(screen.getByRole("button", { name: /plan my celebration/i }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("Choose what you're celebrating.");
    expect(screen.getByLabelText("City")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a preset posts the brief, shows progress, then unfolds the plan and celebrates", async () => {
    const pending = Promise.withResolvers<Response>();
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<PlannerApp />);
    fireEvent.click(screen.getByRole("button", { name: /Priya's sangeet/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Reading the vibe");
    const rawBody = fetchMock.mock.calls[0]?.[1]?.body;
    if (typeof rawBody !== "string") throw new Error("expected a JSON request body");
    const body: unknown = JSON.parse(rawBody);
    expect(body).toMatchObject({
      eventType: "wedding",
      city: "Jaipur",
      guests: 180,
      budgetINR: 1_200_000,
    });
    await act(async () => {
      pending.resolve(jsonResponse({ plan: fixturePlan(), editKey: "k".repeat(43) }, 201));
      await pending.promise;
    });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Riya's sangeet" }),
    ).toBeInTheDocument();
    expect(bus.celebrate).toHaveBeenCalledOnce();
    expect(localStorage.getItem("festiplan:edit:Ab3dEf9hIj2k")).toBe("k".repeat(43));
  });

  it("maps server validation issues back onto the form", async () => {
    const invalid = {
      error: "Check the highlighted fields.",
      issues: [{ path: "city", message: "We don't know that city." }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(invalid, 400))),
    );
    render(<PlannerApp />);
    fireEvent.click(screen.getByRole("button", { name: /Meera's Diwali mela/ }));
    expect(
      await screen.findByText("We don't know that city.", { selector: "a" }),
    ).toBeInTheDocument();
    expect(bus.setMood).toHaveBeenLastCalledWith("hero");
  });
});
