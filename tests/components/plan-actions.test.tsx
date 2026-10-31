import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskSection } from "@/components/plan/AskSection";
import { countdownLabel } from "@/components/plan/PlanHeader";
import { ShareSection } from "@/components/plan/ShareSection";
import { VendorFinder } from "@/components/plan/VendorFinder";
import { createPlan } from "@/lib/client/api";
import { FIXTURE_INPUT } from "../fixtures/plan";
import { failWith, jsonResponse, requestBody, respondWith } from "./fetch-stubs";

vi.mock("@/three/bus", () => ({ setPalette: vi.fn(), setMood: vi.fn(), celebrate: vi.fn() }));

const PLAN_ID = "Ab3dEf9hIj2k";
const EDIT_KEY = "k".repeat(43);

/** A streamed body that delivers `parts`, then closes or drops the connection. */
function streamOf(parts: string[], dropAtEnd = false) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
      if (dropAtEnd) controller.error(new Error("connection reset"));
      else controller.close();
    },
  });
}

/** Replaces a navigator API for one test (jsdom lacks clipboard and share). */
function stubNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

afterEach(() => vi.unstubAllGlobals());

describe("AskSection", () => {
  it("streams an answer for a suggested question and re-enables the buttons", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(() => new Response(streamOf(["Swap disposables ", "for steel."]))),
    );
    render(<AskSection planId={PLAN_ID} lang="hi" />);
    fireEvent.click(screen.getByRole("button", { name: "Make it zero-waste" }));
    expect(await screen.findByText("Swap disposables for steel.")).toHaveAttribute("lang", "hi");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled());
  });

  it("explains a cut-off stream instead of hanging", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(() => new Response(streamOf(["Half an ans"], true))),
    );
    render(<AskSection planId={PLAN_ID} />);
    fireEvent.change(screen.getByLabelText("Your question about this plan"), {
      target: { value: "Rain plan?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText(/cut off/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled();
  });

  it("shows the server's plain-language error and asks for a real question", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(() => jsonResponse({ error: "Too many questions — wait a minute." }, 429)),
    );
    render(<AskSection planId={PLAN_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Type a question first.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What could go wrong on the day?" }));
    expect(await screen.findByText("Too many questions — wait a minute.")).toBeInTheDocument();
  });
});

describe("VendorFinder", () => {
  it("lists only grounded places with Maps links", async () => {
    const fetchMock = respondWith(() =>
      jsonResponse({
        places: [{ title: "Rambagh Lawns", uri: "https://maps.google.com/?cid=1" }],
        searchUrl: "https://www.google.com/maps/search/?api=1&query=x",
        source: "maps",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<VendorFinder planId={PLAN_ID} category="venue" city="Jaipur" />);
    fireEvent.click(screen.getByRole("button", { name: "Find real venue in Jaipur" }));
    const link = await screen.findByRole("link", { name: /Rambagh Lawns/ });
    expect(link).toHaveAttribute("href", "https://maps.google.com/?cid=1");
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(requestBody(init)).toEqual({ planId: PLAN_ID, category: "venue" });
  });

  it("falls back to a Maps search link, and reports errors", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(() =>
        jsonResponse({
          places: [],
          searchUrl: "https://www.google.com/maps/search/?api=1&query=y",
          source: "search",
        }),
      ),
    );
    const { unmount } = render(<VendorFinder planId={PLAN_ID} category="decor" city="Pune" />);
    fireEvent.click(screen.getByRole("button", { name: "Find real décor in Pune" }));
    expect(
      await screen.findByRole("link", { name: /Search décor in Pune on Google Maps/ }),
    ).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", failWith(new TypeError("offline")));
    render(<VendorFinder planId={PLAN_ID} category="decor" city="Pune" />);
    fireEvent.click(screen.getByRole("button", { name: "Find real décor in Pune" }));
    expect(await screen.findByText(/couldn't reach FestiPlan/)).toBeInTheDocument();
  });
});

describe("ShareSection", () => {
  it("copies the read-only link and keeps the edit link out of print", async () => {
    stubNavigator("clipboard", { writeText: vi.fn(() => Promise.resolve()) });
    render(<ShareSection planId={PLAN_ID} editKey={EDIT_KEY} />);
    const shareUrl = `http://localhost:3000/plan/${PLAN_ID}`;
    expect(screen.getByLabelText("Read-only link")).toHaveValue(shareUrl);
    const editLink = screen.getByLabelText("Edit link — keep it private");
    expect(editLink).toHaveValue(`${shareUrl}#edit=${EDIT_KEY}`);
    expect(editLink.closest(".panel")).toHaveClass("no-print");
    fireEvent.click(screen.getByRole("button", { name: "Copy Read-only link" }));
    expect(await screen.findByText("Share link copied.")).toBeInTheDocument();
  });

  it("uses the native share sheet when present, and explains a failed copy", async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator("share", share);
    stubNavigator("clipboard", { writeText: vi.fn(() => Promise.reject(new Error("denied"))) });
    render(<ShareSection planId={PLAN_ID} editKey={null} />);
    expect(screen.queryByLabelText(/Edit link/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "Our celebration plan",
        url: `http://localhost:3000/plan/${PLAN_ID}`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy Read-only link" }));
    expect(await screen.findByText(/Couldn't copy automatically/)).toBeInTheDocument();
    stubNavigator("share", undefined);
  });
});

describe("client API errors", () => {
  /** Calls createPlan with the given fetch stub and checks the plain-language failure. */
  async function expectCreateFailure(fetchStub: typeof fetch, status: number, message: RegExp) {
    vi.stubGlobal("fetch", fetchStub);
    const result = await createPlan(FIXTURE_INPUT);
    if (result.ok) throw new Error("Expected createPlan to fail");
    expect(result.status).toBe(status);
    expect(result.error).toMatch(message);
  }

  it("turns failures into plain-language messages", async () => {
    await expectCreateFailure(failWith(new TypeError("offline")), 0, /connection/);
    const notJson = respondWith(() => new Response("not json", { status: 429 }));
    await expectCreateFailure(notJson, 429, /Wait a minute/);
    const empty = respondWith(() => new Response("", { status: 500 }));
    await expectCreateFailure(empty, 500, /our side/);
  });
});

describe("countdownLabel", () => {
  it("speaks like a person", () => {
    expect([150, 1, 0, -3].map(countdownLabel)).toEqual([
      "150 days",
      "Tomorrow",
      "Today",
      "Celebrated",
    ]);
  });
});
