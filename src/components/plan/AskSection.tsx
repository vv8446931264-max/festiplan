"use client";

import { memo, useEffect, useRef, useState } from "react";
import { askPlan } from "@/lib/client/api";
import { LIMITS } from "@/lib/contracts/constants";
import { SectionHead } from "./SectionHead";

const SUGGESTIONS = [
  "Make it zero-waste",
  "Cut 20% — where should it come from?",
  "What could go wrong on the day?",
  "Ideas for elderly guests",
];

/** Streams one answer at a time; a new question aborts the previous stream. */
function useAsk(planId: string) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 2) return setError("Type a question first.");
    abort.current?.abort();
    abort.current = new AbortController();
    setQuestion(trimmed);
    setAnswer("");
    setError(null);
    setBusy(true);
    try {
      const failure = await askPlan(planId, trimmed, setAnswer, abort.current.signal);
      if (failure) setError(failure);
    } finally {
      setBusy(false);
    }
  }
  // Leaving the plan cancels an answer that is still streaming.
  useEffect(() => () => abort.current?.abort(), []);
  return { question, setQuestion, answer, error, busy, ask };
}

/** "Ask FestiPlan": a streamed answer grounded in this plan. Suggestions only. */
export const AskSection = memo(function AskSection({ planId, lang }: { planId: string; lang?: string }) {
  const a = useAsk(planId);
  return (
    <section id="ask" aria-labelledby="ask-title" className="no-print scroll-mt-20">
      <SectionHead id="ask" number="05" kicker="Ask FestiPlan" title={<>Second thoughts? <span className="accent">Ask.</span></>}>
        Answers are grounded in this plan and are suggestions only — budget changes stay with you and the sliders.
      </SectionHead>
      <div className="panel flex flex-col gap-5 p-6 sm:p-8">
        <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button type="button" className="btn btn-ghost min-h-11 px-4 py-2 text-sm" disabled={a.busy} onClick={() => void a.ask(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void a.ask(a.question); }}>
          <label htmlFor="ask-input" className="sr-only">Your question about this plan</label>
          <input id="ask-input" className="field flex-1" value={a.question} maxLength={LIMITS.questionMax}
            placeholder="e.g. How do we keep the evening on schedule?" onChange={(e) => a.setQuestion(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={a.busy}>{a.busy ? "Thinking…" : "Ask"}</button>
        </form>
        <Answer answer={a.answer} error={a.error} busy={a.busy} lang={lang} />
      </div>
    </section>
  );
});

function Answer({ answer, error, busy, lang }: { answer: string; error: string | null; busy: boolean; lang?: string }) {
  return (
    <div aria-live="polite" aria-busy={busy} className="min-h-12">
      {error && <p className="font-semibold text-ember-bright">{error}</p>}
      {answer && (
        <div lang={lang} className="whitespace-pre-wrap rounded-2xl border border-line bg-espresso p-5 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
