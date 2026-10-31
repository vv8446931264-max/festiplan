import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskSection } from "@/components/plan/AskSection";
import { countdownLabel } from "@/components/plan/PlanHeader";
import { ShareSection } from "@/components/plan/ShareSection";
import { VendorFinder } from "@/components/plan/VendorFinder";
import { createPlan } from "@/lib/client/api";
import { FIXTURE_INPUT } from "../fixtures/plan";

vi.mock("@/three/bus", () => ({ setPalette: vi.fn(), setMood: vi.fn(), celebrate: vi.fn() }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function streamOf(parts: string[], failAfter = false) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      parts.forEach((p) => controller.enqueue(new TextEncoder().encode(p)));
      if (failAfter) controller.error(new Error("connection reset"));
      else controller.close();
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("AskSection", () => {
  it("streams an answer for a suggested question and re-enables the buttons", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(streamOf(["Swap disposables ", "for steel."]))),
    );
    render(<AskSection planId="Ab3dEf9hIj2k" lang="hi" />);
    fireEvent.click(screen.getByRole("button", { name: "Make it zero-waste" }));
    expect(await screen.findByText("Swap disposables for steel.")).toHaveAttribute("lang", "hi");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled());
  });

  it("explains a cut-off stream instead of hanging", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(streamOf(["Half an ans"], true))),
    );
    render(<AskSection planId="Ab3dEf9hIj2k" />);
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
      vi.fn(async () => json({ error: "Too many questions — wait a minute." }, 429)),
    );
    render(<AskSection planId="Ab3dEf9hIj2k" />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Type a question first.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What could go wrong on the day?" }));
    expect(await screen.findByText("Too many questions — wait a minute.")).toBeInTheDocument();
  });
});

describe("VendorFinder", () => {
  it("lists only grounded places with Maps links", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        places: [{ title: "Rambagh Lawns", uri: "https://maps.google.com/?cid=1" }],
        searchUrl: "https://www.google.com/maps/search/?api=1&query=x",
        source: "maps",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<VendorFinder planId="Ab3dEf9hIj2k" category="venue" city="Jaipur" />);
    fireEvent.click(screen.getByRole("button", { name: "Find real venue in Jaipur" }));
    const link = await screen.findByRole("link", { name: /Rambagh Lawns/ });
    expect(link).toHaveAttribute("href", "https://maps.google.com/?cid=1");
    expect(
      JSON.parse(String((fetchMock.mock.calls[0] as unknown[] as [string, RequestInit])[1].body)),
    ).toEqual({
      planId: "Ab3dEf9hIj2k",
      category: "venue",
    });
  });

  it("falls back to a Maps search link, and reports errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          places: [],
          searchUrl: "https://www.google.com/maps/search/?api=1&query=y",
          source: "search",
        }),
      ),
    );
    const { unmount } = render(<VendorFinder planId="Ab3dEf9hIj2k" category="decor" city="Pune" />);
    fireEvent.click(screen.getByRole("button", { name: "Find real décor in Pune" }));
    expect(
      await screen.findByRole("link", { name: /Search décor in Pune on Google Maps/ }),
    ).toBeInTheDocument();
    unmount();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    render(<VendorFinder planId="Ab3dEf9hIj2k" category="decor" city="Pune" />);
    fireEvent.click(screen.getByRole("button", { name: "Find real décor in Pune" }));
    expect(await screen.findByText(/couldn't reach FestiPlan/)).toBeInTheDocument();
  });
});

describe("ShareSection", () => {
  it("copies the read-only link and keeps the edit link out of print", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ShareSection planId="Ab3dEf9hIj2k" editKey={"k".repeat(43)} />);
    expect(screen.getByLabelText("Read-only link")).toHaveValue(
      "http://localhost:3000/plan/Ab3dEf9hIj2k",
    );
    expect(screen.getByLabelText("Edit link — keep it private")).toHaveValue(
      `http://localhost:3000/plan/Ab3dEf9hIj2k#edit=${"k".repeat(43)}`,
    );
    expect(screen.getByLabelText("Edit link — keep it private").closest(".panel")).toHaveClass(
      "no-print",
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy Read-only link" }));
    expect(await screen.findByText("Share link copied.")).toBeInTheDocument();
  });

  it("uses the native share sheet when present, and explains a failed copy", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
      configurable: true,
    });
    render(<ShareSection planId="Ab3dEf9hIj2k" editKey={null} />);
    expect(screen.queryByLabelText(/Edit link/)).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share" })));
    expect(share).toHaveBeenCalledWith({
      title: "Our celebration plan",
      url: "http://localhost:3000/plan/Ab3dEf9hIj2k",
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy Read-only link" }));
    expect(await screen.findByText(/Couldn't copy automatically/)).toBeInTheDocument();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
});

describe("client API errors", () => {
  it("turns failures into plain-language messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    expect(await createPlan(FIXTURE_INPUT)).toMatchObject({
      ok: false,
      status: 0,
      error: expect.stringMatching(/connection/),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 429 })),
    );
    expect(await createPlan(FIXTURE_INPUT)).toMatchObject({
      ok: false,
      status: 429,
      error: expect.stringMatching(/Wait a minute/),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    expect(await createPlan(FIXTURE_INPUT)).toMatchObject({
      ok: false,
      status: 500,
      error: expect.stringMatching(/our side/),
    });
  });
});

describe("countdownLabel", () => {
  it("speaks like a person", () => {
    expect([countdownLabel(150), countdownLabel(1), countdownLabel(0), countdownLabel(-3)]).toEqual(
      ["150 days", "Tomorrow", "Today", "Celebrated"],
    );
  });
});
