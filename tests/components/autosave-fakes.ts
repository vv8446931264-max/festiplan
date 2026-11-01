import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useAutosave } from "@/components/plan/useAutosave";
import { jsonResponse, requestBody } from "./fetch-stubs";

const PLAN_ID = "plan123";
const EDIT_KEY = "k".repeat(43);
/** The autosave debounce (SAVE_DELAY_MS in useAutosave). */
export const DEBOUNCE_MS = 700;

type Call = { body: unknown; keepalive: boolean | undefined };

/** A fetch whose responses are held until the test releases them, one per call. */
export function heldFetch() {
  const calls: Call[] = [];
  const release: (() => void)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ body: requestBody(init), keepalive: init?.keepalive });
      return new Promise<Response>((resolve) => {
        release.push(() => resolve(jsonResponse({ plan: {} })));
      });
    }),
  );
  return { calls, release };
}

/** A fetch that answers with `statuses` in order (0 = network failure), then 200. */
export function scriptedFetch(statuses: number[]) {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(requestBody(init));
      const status = statuses.shift() ?? 200;
      if (status === 0) return Promise.reject(new TypeError("network down"));
      return Promise.resolve(jsonResponse(status < 300 ? { plan: {} } : { error: "nope" }, status));
    }),
  );
  return bodies;
}

/**
 * A fetch that first returns something that is not a response, so `savePlan` itself rejects
 * (an unexpected failure, not a status code); every later call succeeds.
 */
export function throwingFetch() {
  const bodies: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(requestBody(init));
      if (bodies.length === 1) return Promise.resolve(undefined);
      return Promise.resolve(jsonResponse({ plan: {} }));
    }),
  );
  return bodies;
}

/** Advances the fake clock inside an async act scope, so React applies what it triggers. */
export async function advance(ms: number) {
  await act(() => {
    vi.advanceTimersByTime(ms);
    return Promise.resolve();
  });
}

/** Lets queued promise callbacks (saves, their responses, state updates) run to completion. */
export async function drainPromises() {
  for (let i = 0; i < 20; i++) await act(async () => await Promise.resolve());
}

export const renderAutosave = (editKey: string | null = EDIT_KEY) =>
  renderHook(() => useAutosave(PLAN_ID, editKey));
