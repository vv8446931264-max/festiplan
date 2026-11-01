import type { Dispatch, RefObject, SetStateAction } from "react";
import { savePlan } from "@/lib/client/api";
import type { PlanPatch } from "@/lib/contracts";
import { mergePatch } from "./patch";

/**
 * Where saving stands. "retrying" means a retry is scheduled; "stalled" means the retries have
 * run out, so nothing is scheduled and the change waits for the browser to come back online
 * or for the next edit.
 */
export type SaveState =
  "idle" | "saving" | "saved" | "retrying" | "stalled" | "rejected" | "forbidden";

const NETWORK_FAILURE = 0;
const FORBIDDEN = 403;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

/** Network errors, rate limits and server faults are worth retrying; 4xx rejections are not. */
const isTransient = (status: number) =>
  status === NETWORK_FAILURE || status === TOO_MANY_REQUESTS || status >= SERVER_ERROR;

type SaveOutcome = { ok: true } | { ok: false; status: number };

/** A save that threw instead of answering counts as a dropped connection: it is retried. */
const THREW: SaveOutcome = { ok: false, status: NETWORK_FAILURE };

/** The autosave's bookkeeping that a finished save updates. */
export type SaveTracker = {
  pending: RefObject<PlanPatch | null>;
  inFlight: RefObject<number>;
  setSaveState: (state: SaveState) => void;
  setFailures: Dispatch<SetStateAction<number>>;
};

/** One patch to send for a plan, and whether the request must outlive the page (`keepalive`). */
export type SaveRequest = { planId: string; editKey: string; patch: PlanPatch; keepalive: boolean };

/**
 * Sends one patch and settles it. The `finally` runs whatever happened — an answer, a
 * rejection or an unexpected throw — so the in-flight counter always comes down and a
 * failed change is put back instead of being dropped.
 */
export async function save(request: SaveRequest, tracker: SaveTracker): Promise<void> {
  const { planId, editKey, patch, keepalive } = request;
  let outcome = THREW;
  try {
    outcome = await savePlan(planId, editKey, patch, keepalive);
  } finally {
    tracker.inFlight.current -= 1;
    settle(outcome, patch, tracker);
  }
}

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
