"use client";

import { useEffect, useRef, useState } from "react";
import { askPlan } from "@/lib/client/api";

/** Anything shorter, once trimmed, is treated as no question at all. */
const MIN_QUESTION_LENGTH = 2;

/** Streams one answer at a time; a new question aborts the previous stream. */
export function useAsk(planId: string) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stream = useRef<AbortController | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUESTION_LENGTH) {
      setError("Type a question first.");
      return;
    }
    stream.current?.abort();
    stream.current = new AbortController();
    setQuestion(trimmed);
    setAnswer("");
    setError(null);
    setBusy(true);
    try {
      const failure = await askPlan(planId, trimmed, setAnswer, stream.current.signal);
      if (failure) setError(failure);
    } finally {
      setBusy(false);
    }
  }

  // Leaving the plan cancels an answer that is still streaming.
  useEffect(() => () => stream.current?.abort(), []);
  return { question, setQuestion, answer, error, busy, ask };
}
