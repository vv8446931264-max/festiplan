"use client";

import { memo } from "react";
import { LIMITS } from "@/lib/contracts/constants";
import { SectionHead } from "./SectionHead";
import { useAsk } from "./useAsk";

const SUGGESTIONS = [
  "Make it zero-waste",
  "Cut 20% — where should it come from?",
  "What could go wrong on the day?",
  "Ideas for elderly guests",
];

type Props = { planId: string; lang?: string };

/** "Ask FestiPlan": a streamed answer grounded in this plan. Suggestions only. */
export const AskSection = memo(function AskSection({ planId, lang }: Props) {
  const conversation = useAsk(planId);
  const ask = (question: string) => void conversation.ask(question);
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
        <Answer
          answer={conversation.answer}
          error={conversation.error}
          busy={conversation.busy}
          lang={lang}
        />
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
            className="btn btn-ghost min-h-11 px-4 py-2 text-sm"
            disabled={busy}
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
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="ask-input" className="sr-only">
        Your question about this plan
      </label>
      <input
        id="ask-input"
        className="field flex-1"
        value={question}
        maxLength={LIMITS.questionMax}
        placeholder="e.g. How do we keep the evening on schedule?"
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Thinking…" : "Ask"}
      </button>
    </form>
  );
}

type AnswerProps = { answer: string; error: string | null; busy: boolean; lang?: string };

/** The streamed answer (or error), announced politely as it grows. */
function Answer({ answer, error, busy, lang }: AnswerProps) {
  return (
    <div aria-live="polite" aria-busy={busy} className="min-h-12">
      {error && <p className="font-semibold text-ember-bright">{error}</p>}
      {answer && (
        <div
          lang={lang}
          className="rounded-2xl border border-line bg-espresso p-5 leading-relaxed whitespace-pre-wrap"
        >
          {answer}
        </div>
      )}
    </div>
  );
}
