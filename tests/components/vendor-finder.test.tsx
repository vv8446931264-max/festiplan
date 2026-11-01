import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VendorFinder } from "@/components/plan/VendorFinder";
import { failWith, jsonResponse } from "./fetch-stubs";

const PLAN_ID = "Ab3dEf9hIj2k";
const FIND_VENUE = "Find real venue in Jaipur";
const PLACES = {
  places: [{ title: "Rambagh Lawns", uri: "https://maps.google.com/?cid=1" }],
  searchUrl: "https://www.google.com/maps/search/?api=1&query=x",
  source: "maps",
};
const NO_PLACES = { ...PLACES, places: [], source: "search" };

/** A fetch whose one response is held until `finish()` delivers `body`. */
function heldSearch(body: unknown) {
  const held: { finish: () => void } = { finish: () => undefined };
  const fetchStub = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        held.finish = () => resolve(jsonResponse(body));
      }),
  );
  vi.stubGlobal("fetch", fetchStub);
  return { fetchStub, finish: () => held.finish() };
}

/** Renders the finder beside another control, so a test can send focus elsewhere. */
function renderFinder() {
  render(
    <>
      <VendorFinder planId={PLAN_ID} category="venue" city="Jaipur" />
      <button type="button">Elsewhere</button>
    </>,
  );
  return screen.getByRole("button", { name: FIND_VENUE });
}

/** Lets React run effects scheduled by the last update. */
const settle = () => act(() => Promise.resolve());

afterEach(() => vi.unstubAllGlobals());

describe("VendorFinder while searching", () => {
  it("stays focusable (aria-disabled), ignores another press, then hands focus to the results", async () => {
    const { fetchStub, finish } = heldSearch(PLACES);
    const find = renderFinder();
    find.focus();
    fireEvent.click(find);
    expect(await screen.findByRole("button", { name: "Searching Google Maps…" })).toBe(find);
    expect(find).toHaveFocus();
    expect(find).toHaveAttribute("aria-disabled", "true");
    expect(find).toBeEnabled();
    fireEvent.click(find);
    expect(fetchStub).toHaveBeenCalledOnce();
    finish();
    const heading = await screen.findByRole("heading", { name: /^From Google Maps/ });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByRole("button", { name: /Find real|Searching/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Rambagh Lawns/ })).toBeInTheDocument();
  });

  it("also takes focus when nothing had it (a mouse press that did not focus the button)", async () => {
    const { finish } = heldSearch(PLACES);
    const find = renderFinder();
    expect(find).not.toHaveFocus();
    fireEvent.click(find);
    await screen.findByRole("button", { name: "Searching Google Maps…" });
    finish();
    const heading = await screen.findByRole("heading", { name: /^From Google Maps/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("does not pull focus back from a control the visitor moved on to", async () => {
    const { finish } = heldSearch(PLACES);
    const find = renderFinder();
    find.focus();
    fireEvent.click(find);
    await screen.findByRole("button", { name: "Searching Google Maps…" });
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    finish();
    await screen.findByRole("heading", { name: /^From Google Maps/ });
    await settle();
    expect(elsewhere).toHaveFocus();
  });
});

describe("VendorFinder results and errors", () => {
  it("shows the Maps search link under the same focusable heading when nothing was grounded", async () => {
    const { finish } = heldSearch(NO_PLACES);
    const find = renderFinder();
    find.focus();
    fireEvent.click(find);
    finish();
    const heading = await screen.findByRole("heading", { name: /^From Google Maps/ });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText(/No grounded matches this time/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Search venue in Jaipur on Google Maps/ }),
    ).toBeVisible();
  });

  it("keeps the button, and focus on it, when the search fails, and announces the error politely", async () => {
    vi.stubGlobal("fetch", failWith(new TypeError("offline")));
    const find = renderFinder();
    find.focus();
    fireEvent.click(find);
    const message = await screen.findByText(/couldn't reach FestiPlan/);
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
    const again = screen.getByRole("button", { name: FIND_VENUE });
    expect(again).toBe(find);
    expect(again).toHaveFocus();
    expect(again).toHaveAttribute("aria-disabled", "false");
  });
});
