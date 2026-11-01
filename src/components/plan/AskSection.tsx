"use client";

import { memo } from "react";
import { splitTemplateAnswer } from "@/lib/ai/answer-source";
import { LIMITS } from "@/lib/contracts/constants";
import { SectionHead } from "./SectionHead";
import { useAsk } from "./useAsk";

const SUGGESTIONS = [
  "Make it zero-waste",
  "Cut 20% — where should it come from?",
  "What could go wrong on the day?",
  "Ideas for elderly guests",
];

/** Buttons stay focusable while an answer streams (aria-disabled), so focus is never stranded. */
const INACTIVE_LOOK = "aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

type Props = { planId: string; lang?: string };

/** "Ask FestiPlan": a streamed answer grounded in this plan. Suggestions only. */
export const AskSection = memo(function AskSection({ planId, lang }: Props) {
  const conversation = useAsk(planId);
  // A press on an aria-disabled button still arrives here: ignore it until the answer is in.
  const ask = (question: string) => {
    if (!conversation.busy) void conversation.ask(question);
  };
  return (
    <section id="ask" aria-labelledby="ask-title" className="no-print scroll-mt-20">
      <SectionHead
        id="ask"
        number="05"
        kicker="Ask FestiPlan"
        title={
          <>
            Second thoughts? <span className="accent">Ask.</span>
          </>
        }
      >
        Answers are grounded in this plan and are suggestions only — budget changes stay with you
        and the sliders.
      </SectionHead>
      <div className="panel flex flex-col gap-5 p-6 sm:p-8">
        <Suggestions busy={conversation.busy} onAsk={ask} />
        <QuestionForm
          question={conversation.question}
          busy={conversation.busy}
          onChange={conversation.setQuestion}
          onSubmit={() => ask(conversation.question)}
        />
        <AskStatus
          busy={conversation.busy}
          error={conversation.error}
          answered={conversation.answer !== ""}
        />
        <Answer answer={conversation.answer} lang={lang} />
      </div>
    </section>
  );
});

function Suggestions({ busy, onAsk }: { busy: boolean; onAsk: (question: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
      {SUGGESTIONS.map((suggestion) => (
        <li key={suggestion}>
          <button
            type="button"
            className={`btn btn-ghost min-h-11 px-4 py-2 text-sm ${INACTIVE_LOOK}`}
            aria-disabled={busy}
            onClick={() => onAsk(suggestion)}
          >
            {suggestion}
          </button>
        </li>
      ))}
    </ul>
  );
}

type FormProps = {
  question: string;
  busy: boolean;
  onChange: (question: string) => void;
  onSubmit: () => void;
};

function QuestionForm({ question, busy, onChange, onSubmit }: FormProps) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="ask-input" className="font-semibold">
        Your question about this plan
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="ask-input"
          className="field flex-1"
          value={question}
          maxLength={LIMITS.questionMax}
          placeholder="e.g. How do we keep the evening on schedule?"
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" className={`btn btn-primary ${INACTIVE_LOOK}`} aria-disabled={busy}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </div>
    </form>
  );
}

type StatusProps = { busy: boolean; error: string | null; answered: boolean };

/**
 * One polite status line: that an answer is coming, that it is complete, or what went
 * wrong. The streamed text itself is not a live region, so it is never read out chunk by chunk.
 */
function AskStatus({ busy, error, answered }: StatusProps) {
  const failed = !busy && error !== null;
  const message = busy
    ? "Thinking about your question…"
    : (error ?? (answered ? "Answer ready." : ""));
  return (
    <p
      role="status"
      className={`min-h-6 ${failed ? "font-semibold text-ember-bright" : "text-sm text-muted"}`}
    >
      {message}
    </p>
  );
}

/**
 * The streamed answer. A template fallback is always English, so only the model's text
 * carries the plan's `lang`; the template part inherits the page's English.
 */
function Answer({ answer, lang }: { answer: string; lang?: string }) {
  if (!answer) return null;
  const { model, template } = splitTemplateAnswer(answer);
  return (
    <div className="rounded-2xl border border-line bg-espresso p-5 leading-relaxed whitespace-pre-wrap">
      {model && <span lang={lang}>{model}</span>}
      {template}
    </div>
  );
}
