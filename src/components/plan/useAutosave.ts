"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { savePlan } from "@/lib/client/api";
import type { PlanPatch } from "@/lib/contracts";
import { mergePatch } from "./patch";

export type SaveState = "idle" | "saving" | "saved" | "retrying" | "rejected" | "forbidden";

const SAVE_DELAY_MS = 700;
const MAX_RETRIES = 4;
const RETRY_STEP_MS = 2000;

const NETWORK_FAILURE = 0;
const FORBIDDEN = 403;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

/** Network errors, rate limits and server faults are worth retrying; 4xx rejections are not. */
const isTransient = (status: number) =>
  status === NETWORK_FAILURE || status === TOO_MANY_REQUESTS || status >= SERVER_ERROR;

/**
 * Debounced, ordered autosave. Changes merge into one pending patch; saves run one
 * at a time so a newer budget can never be overwritten by an older one; the status
 * reads "saved" only when nothing is pending or in flight; a transient failure puts
 * the change back and retries with backoff; leaving or hiding the page flushes
 * immediately with `keepalive`, so the last tick is never lost. The save chain
 * catches every error, so one unexpected failure can never block later saves.
 */
export function useAutosave(planId: string, editKey: string | null) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [failures, setFailures] = useState(0);
  const pending = useRef<PlanPatch | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const { schedule, cancel: cancelDebounce } = useDebounce();

  const flush = useCallback(
    (keepalive = false) => {
      cancelDebounce();
      const patch = pending.current;
      pending.current = null;
      if (!patch || !editKey) return;
      inFlight.current += 1;
      const save = async () => {
        const outcome = await savePlan(planId, editKey, patch, keepalive);
        inFlight.current -= 1;
        settle(outcome, patch, { pending, inFlight, setSaveState, setFailures });
      };
      chain.current = chain.current.then(save).catch(() => setSaveState("retrying"));
    },
    [cancelDebounce, editKey, planId],
  );

  const queue = useCallback(
    (patch: PlanPatch) => {
      if (!editKey) return;
      pending.current = mergePatch(pending.current, patch);
      setSaveState("saving");
      schedule(() => flush(), SAVE_DELAY_MS);
    },
    [editKey, flush, schedule],
  );

  useRetry(failures, flush);
  useFlushOnLeave(flush, cancelDebounce);
  return { saveState, queue };
}

/** One pending timer at a time: scheduling replaces it, cancelling clears whatever is pending. */
function useDebounce() {
  const timer = useRef<number | undefined>(undefined);
  const cancel = useCallback(() => window.clearTimeout(timer.current), []);
  const schedule = useCallback((run: () => void, delayMs: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(run, delayMs);
  }, []);
  return { schedule, cancel };
}

type SaveOutcome = { ok: true } | { ok: false; status: number };

/** The autosave's bookkeeping that a finished save updates. */
type SaveTracker = {
  pending: RefObject<PlanPatch | null>;
  inFlight: RefObject<number>;
  setSaveState: (state: SaveState) => void;
  setFailures: React.Dispatch<React.SetStateAction<number>>;
};

/** What a finished save means for the status line and the pending patch. */
function settle(outcome: SaveOutcome, patch: PlanPatch, tracker: SaveTracker) {
  const { pending, inFlight, setSaveState, setFailures } = tracker;
  if (outcome.ok) {
    setFailures(0);
    if (!pending.current && inFlight.current === 0) setSaveState("saved");
  } else if (outcome.status === FORBIDDEN) {
    setSaveState("forbidden");
  } else if (!isTransient(outcome.status)) {
    setSaveState("rejected");
  } else {
    // Put the change back underneath anything queued since, and try again later.
    pending.current = pending.current ? mergePatch(patch, pending.current) : patch;
    setSaveState("retrying");
    setFailures((count) => count + 1);
  }
}

/** After the n-th consecutive transient failure, retry in RETRY_STEP_MS × n (up to MAX_RETRIES). */
function useRetry(failures: number, flush: () => void) {
  useEffect(() => {
    if (failures === 0 || failures > MAX_RETRIES) return;
    const retry = window.setTimeout(flush, RETRY_STEP_MS * failures);
    return () => window.clearTimeout(retry);
  }, [failures, flush]);
}

/** Flush with keepalive when the page is hidden or left; cancel the debounce on unmount. */
function useFlushOnLeave(flush: (keepalive?: boolean) => void, cancelDebounce: () => void) {
  useEffect(() => {
    const flushNow = () => flush(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelDebounce();
    };
  }, [flush, cancelDebounce]);
}
