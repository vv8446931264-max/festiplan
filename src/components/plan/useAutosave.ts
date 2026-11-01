"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PlanPatch } from "@/lib/contracts";
import { mergePatch } from "./patch";
import { save, type SaveState, type SaveTracker } from "./save-patch";

export type { SaveState } from "./save-patch";

const SAVE_DELAY_MS = 700;
const MAX_RETRIES = 4;
const RETRY_STEP_MS = 2000;

/**
 * Debounced, ordered autosave. Changes merge into one pending patch; saves run one
 * at a time so a newer budget can never be overwritten by an older one; the status
 * reads "saved" only when nothing is pending or in flight; a transient failure puts
 * the change back and retries with backoff. When the retries run out the status says
 * "stalled" and the change stays pending until the window's `online` event or the next
 * edit sends it. Leaving or hiding the page flushes immediately with `keepalive`, so the
 * last tick is never lost. Every save settles in a `finally`, so even an unexpected throw
 * lowers the in-flight counter, restores the change and cannot block later saves.
 */
export function useAutosave(planId: string, editKey: string | null) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [failures, setFailures] = useState(0);
  const pending = useRef<PlanPatch | null>(null);
  const { schedule, cancel: cancelDebounce } = useDebounce();
  const flush = useFlush(
    { planId, editKey, pendingRef: pending, setSaveState, setFailures },
    cancelDebounce,
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

  // The browser says it is back online: send what is waiting now, from a fresh set of retries.
  const resume = useCallback(() => {
    if (!pending.current) return;
    setFailures(0);
    setSaveState("saving");
    flush();
  }, [flush]);

  useRetry(failures, flush);
  useResumeOnline(failures > 0, resume);
  useFlushOnLeave(flush, cancelDebounce);
  return { saveState: retriesExhausted(saveState, failures) ? "stalled" : saveState, queue };
}

/** Whether the last failure was the final one: no retry is scheduled behind a "retrying" status. */
const retriesExhausted = (state: SaveState, failures: number) =>
  state === "retrying" && failures > MAX_RETRIES;

type FlushDeps = {
  planId: string;
  editKey: string | null;
  /** Named `…Ref` so the React Compiler lint accepts writes to `.current` inside the hook. */
  pendingRef: RefObject<PlanPatch | null>;
  setSaveState: SaveTracker["setSaveState"];
  setFailures: SaveTracker["setFailures"];
};

/**
 * `flush` sends the pending patch now. Saves are chained, so they run one at a time in the
 * order they were flushed and a newer budget can never be overwritten by an older one.
 */
function useFlush(deps: FlushDeps, cancelDebounce: () => void) {
  const { planId, editKey, pendingRef, setSaveState, setFailures } = deps;
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  return useCallback(
    (keepalive = false) => {
      cancelDebounce();
      const patch = pendingRef.current;
      pendingRef.current = null;
      if (!patch || !editKey) return;
      inFlight.current += 1;
      const tracker = { pending: pendingRef, inFlight, setSaveState, setFailures };
      chain.current = chain.current
        .then(() => save({ planId, editKey, patch, keepalive }, tracker))
        .catch(() => undefined);
    },
    [cancelDebounce, editKey, planId, pendingRef, setSaveState, setFailures],
  );
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

/** After the n-th consecutive transient failure, retry in RETRY_STEP_MS × n (up to MAX_RETRIES). */
function useRetry(failures: number, flush: () => void) {
  useEffect(() => {
    if (failures === 0 || failures > MAX_RETRIES) return;
    const retry = window.setTimeout(flush, RETRY_STEP_MS * failures);
    return () => window.clearTimeout(retry);
  }, [failures, flush]);
}

/** While a save is failing, `resume` runs as soon as the window reports it is back online. */
function useResumeOnline(failing: boolean, resume: () => void) {
  useEffect(() => {
    if (!failing) return;
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [failing, resume]);
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
