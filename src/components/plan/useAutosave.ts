"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { savePlan } from "@/lib/client/api";
import type { PlanPatch } from "@/lib/contracts";
import { mergePatch } from "./patch";

export type SaveState = "idle" | "saving" | "saved" | "retrying" | "rejected" | "forbidden";
const SAVE_DELAY_MS = 700;
const MAX_RETRIES = 4;

/** Network errors, rate limits and server faults are worth retrying; 4xx rejections are not. */
const isTransient = (status: number) => status === 0 || status === 429 || status >= 500;

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
  const busy = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(
    (keepalive = false) => {
      window.clearTimeout(timer.current);
      const patch = pending.current;
      pending.current = null;
      if (!patch || !editKey) return;
      busy.current += 1;
      const save = async () => {
        const res = await savePlan(planId, editKey, patch, keepalive);
        busy.current -= 1;
        settle(res.ok ? 200 : res.status, patch, { pending, busy, setSaveState, setFailures });
      };
      chain.current = chain.current.then(save).catch(() => setSaveState("retrying"));
    },
    [editKey, planId],
  );

  const queue = useCallback(
    (patch: PlanPatch) => {
      if (!editKey) return;
      pending.current = mergePatch(pending.current, patch);
      setSaveState("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(), SAVE_DELAY_MS);
    },
    [editKey, flush],
  );

  useRetry(failures, flush);
  useFlushOnLeave(flush, timer);
  return { saveState, queue };
}

type Settle = {
  pending: RefObject<PlanPatch | null>;
  busy: RefObject<number>;
  setSaveState: (s: SaveState) => void;
  setFailures: React.Dispatch<React.SetStateAction<number>>;
};

/** What a finished save means for the status line and the pending queue. */
function settle(status: number, patch: PlanPatch, s: Settle) {
  if (status >= 200 && status < 300) {
    s.setFailures(0);
    if (!s.pending.current && s.busy.current === 0) s.setSaveState("saved");
  } else if (status === 403) s.setSaveState("forbidden");
  else if (!isTransient(status)) s.setSaveState("rejected");
  else {
    s.pending.current = s.pending.current ? mergePatch(patch, s.pending.current) : patch;
    s.setSaveState("retrying");
    s.setFailures((n) => n + 1);
  }
}

/** After the n-th consecutive transient failure, try again in 2 s × n (up to MAX_RETRIES). */
function useRetry(failures: number, flush: () => void) {
  useEffect(() => {
    if (failures === 0 || failures > MAX_RETRIES) return;
    const id = window.setTimeout(flush, 2000 * failures);
    return () => window.clearTimeout(id);
  }, [failures, flush]);
}

/** Flush with keepalive when the page is hidden or left; clear the debounce on unmount. */
function useFlushOnLeave(
  flush: (keepalive?: boolean) => void,
  timer: RefObject<number | undefined>,
) {
  useEffect(() => {
    const debounce = timer;
    const now = () => flush(true);
    const onVisibility = () => document.visibilityState === "hidden" && now();
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", now);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(debounce.current);
    };
  }, [flush, timer]);
}
