import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskSection } from "@/components/plan/AskSection";
import { splitTemplateAnswer, TEMPLATE_ANSWER_PREFIX } from "@/lib/ai/answer-source";
import { axeViolations } from "./axe";
import { respondWith } from "./fetch-stubs";

const PLAN_ID = "Ab3dEf9hIj2k";
const QUESTION_LABEL = "Your question about this plan";

/** A streamed answer the test feeds by hand: `send` delivers a chunk, `end` closes the stream. */
function heldStream() {
  const encoder = new TextEncoder();
  const held: { controller: ReadableStreamDefaultController<Uint8Array> | null } = {
    controller: null,
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      held.controller = controller;
    },
  });
  return {
    body,
    send: (text: string) => held.controller?.enqueue(encoder.encode(text)),
    end: () => held.controller?.close(),
  };
}

/** Renders the section, then asks "Rain plan?" with the keyboard focus on the Ask button. */
function startAsking(lang?: string) {
  const stream = heldStream();
  const fetchStub = respondWith(() => new Response(stream.body));
  vi.stubGlobal("fetch", fetchStub);
  const view = render(<AskSection planId={PLAN_ID} lang={lang} />);
  fireEvent.change(screen.getByLabelText(QUESTION_LABEL), { target: { value: "Rain plan?" } });
  const ask = screen.getByRole("button", { name: "Ask" });
  ask.focus();
  fireEvent.click(ask);
  return { ...view, ask, stream, fetchStub };
}

/** Streams `parts` to a finished answer in a plan written in `lang`. */
async function answered(parts: string[], lang: string) {
  const asking = startAsking(lang);
  parts.forEach(asking.stream.send);
  asking.stream.end();
  await screen.findByText("Answer ready.");
  return asking;
}

afterEach(() => vi.unstubAllGlobals());

describe("AskSection question field", () => {
  it("has a visible label, not just a placeholder", () => {
    render(<AskSection planId={PLAN_ID} />);
    const label = screen.getByText(QUESTION_LABEL);
    expect(label.tagName).toBe("LABEL");
    expect(label).not.toHaveClass("sr-only");
    expect(screen.getByLabelText(QUESTION_LABEL)).toHaveAttribute("placeholder");
  });
});

describe("AskSection while an answer streams", () => {
  it("keeps focus on the button, which stays focusable and ignores further presses", async () => {
    const { ask, stream, fetchStub } = startAsking();
    expect(await screen.findByRole("button", { name: "Thinking…" })).toBe(ask);
    expect(ask).toHaveFocus();
    expect(ask).toHaveAttribute("aria-disabled", "true");
    expect(ask).toBeEnabled();
    const suggestions = within(screen.getByRole("list", { name: "Suggested questions" }));
    for (const suggestion of suggestions.getAllByRole("button")) {
      expect(suggestion).toHaveAttribute("aria-disabled", "true");
      expect(suggestion).toBeEnabled();
      fireEvent.click(suggestion);
    }
    fireEvent.click(ask);
    const form = ask.closest("form");
    if (form) fireEvent.submit(form);
    expect(fetchStub).toHaveBeenCalledOnce();
    stream.send("Move the baraat indoors.");
    stream.end();
    await screen.findByText("Answer ready.");
    expect(ask).toHaveFocus();
    expect(ask).toHaveAttribute("aria-disabled", "false");
    expect(ask).toHaveTextContent("Ask");
  });

  it("announces progress and completion in a polite status line, not in the answer", async () => {
    const { container, stream } = startAsking();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Thinking about your question…");
    stream.send("Move the baraat ");
    const answer = await screen.findByText(/Move the baraat/);
    expect(status).toHaveTextContent("Thinking about your question…");
    stream.send("indoors.");
    stream.end();
    await screen.findByText("Answer ready.");
    expect(status).toHaveTextContent(/^Answer ready\.$/);
    // The growing text is never a live region (it would be read out chunk by chunk).
    expect(answer.closest("[aria-live], [aria-busy], [role=status]")).toBeNull();
    expect(container.querySelector("[aria-busy]")).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("reports an empty question in the same status line", () => {
    render(<AskSection planId={PLAN_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("status")).toHaveTextContent("Type a question first.");
  });
});

describe("AskSection answer language", () => {
  it("puts the plan language on the model's text", async () => {
    await answered(["Baraat ko andar le jaaiye."], "hi");
    expect(screen.getByText("Baraat ko andar le jaaiye.")).toHaveAttribute("lang", "hi");
  });

  it("leaves the English template answer without a lang attribute", async () => {
    const { container } = await answered(
      [`${TEMPLATE_ANSWER_PREFIX}\n\nYour biggest line is Venue.`],
      "hi",
    );
    expect(screen.getByText(/Your biggest line is Venue\./)).toBeInTheDocument();
    expect(container.querySelector("[lang]")).toBeNull();
  });

  it("splits a mid-stream fallback: the model part keeps lang, the appended template does not", async () => {
    const parts = ["Aadhi salaah", `\n\n${TEMPLATE_ANSWER_PREFIX}\n\nYour biggest line is Venue.`];
    await answered(parts, "hi");
    expect(screen.getByText("Aadhi salaah")).toHaveAttribute("lang", "hi");
    const template = screen.getByText(/Your biggest line is Venue\./);
    expect(template.closest("[lang]")).toBeNull();
  });
});

describe("splitTemplateAnswer", () => {
  it("separates the model's text from a template answer that starts or follows it", () => {
    const template = `${TEMPLATE_ANSWER_PREFIX}\n\nNext up: book the venue.`;
    expect(splitTemplateAnswer("Plain advice.")).toEqual({ model: "Plain advice.", template: "" });
    expect(splitTemplateAnswer(template)).toEqual({ model: "", template });
    expect(splitTemplateAnswer(`Half an ans\n\n${template}`)).toEqual({
      model: "Half an ans\n\n",
      template,
    });
  });
});
