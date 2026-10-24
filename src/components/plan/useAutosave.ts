"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { savePlan } from "@/lib/client/api";
import type { PlanPatch } from "@/lib/contracts";
import { mergePatch } from "./patch";

export type SaveState = "idle" | "saving" | "saved" | "error" | "forbidden";
const SAVE_DELAY_MS = 700;

/**
 * Debounced, ordered autosave. Changes merge into one pending patch; saves run one
 * at a time so a newer budget can never be overwritten by an older one; the status
 * reads "saved" only when nothing is pending or in flight; and leaving or hiding
 * the page flushes immediately with `keepalive`, so the last tick is never lost.
 */
export function useAutosave(planId: string, editKey: string | null) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
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
      chain.current = chain.current.then(async () => {
        const res = await savePlan(planId, editKey, patch, keepalive);
        busy.current -= 1;
        if (!res.ok) setSaveState(res.status === 403 ? "forbidden" : "error");
        else if (!pending.current && busy.current === 0) setSaveState("saved");
      });
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

  useEffect(() => {
    const now = () => flush(true);
    const onVisibility = () => document.visibilityState === "hidden" && now();
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", now);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer.current);
    };
  }, [flush]);

  return { saveState, queue };
}
