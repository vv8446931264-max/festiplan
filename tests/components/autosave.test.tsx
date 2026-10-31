import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/components/plan/useAutosave";
import { jsonResponse, requestBody } from "./fetch-stubs";

const PLAN_ID = "plan123";
const EDIT_KEY = "k".repeat(43);
/** The autosave debounce (SAVE_DELAY_MS in useAutosave). */
const DEBOUNCE_MS = 700;

type Call = { body: unknown; keepalive: boolean | undefined };

/** A fetch whose responses are held until the test releases them, one per call. */
function heldFetch() {
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
function scriptedFetch(statuses: number[]) {
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

/** Advances the fake clock inside an async act scope, so React applies what it triggers. */
async function advance(ms: number) {
  await act(() => {
    vi.advanceTimersByTime(ms);
    return Promise.resolve();
  });
}

/** Lets queued promise callbacks (saves, their responses, state updates) run to completion. */
async function drainPromises() {
  for (let i = 0; i < 20; i++) await act(async () => await Promise.resolve());
}

const renderAutosave = (editKey: string | null = EDIT_KEY) =>
  renderHook(() => useAutosave(PLAN_ID, editKey));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAutosave", () => {
  it("merges quick changes into one PATCH and reports saved only when idle", async () => {
    const network = heldFetch();
    const { result } = renderAutosave();
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    act(() => result.current.queue({ tasks: [{ id: "b", done: true }] }));
    expect(result.current.saveState).toBe("saving");
    await advance(DEBOUNCE_MS);
    expect(network.calls).toHaveLength(1);
    expect(network.calls[0]?.body).toEqual({
      tasks: [
        { id: "a", done: true },
        { id: "b", done: true },
      ],
    });
    expect(result.current.saveState).toBe("saving");
    network.release[0]?.();
    await drainPromises();
    expect(result.current.saveState).toBe("saved");
  });

  it("does not claim saved while a later change is still pending, and keeps saves in order", async () => {
    const network = heldFetch();
    const { result } = renderAutosave();
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await advance(DEBOUNCE_MS);
    act(() => result.current.queue({ tasks: [{ id: "b", done: true }] }));
    network.release[0]?.();
    await drainPromises();
    expect(result.current.saveState).toBe("saving");
    await advance(DEBOUNCE_MS);
    await drainPromises();
    expect(network.calls.map((call) => call.body)).toEqual([
      { tasks: [{ id: "a", done: true }] },
      { tasks: [{ id: "b", done: true }] },
    ]);
    network.release[1]?.();
    await drainPromises();
    expect(result.current.saveState).toBe("saved");
  });

  it("flushes immediately with keepalive when the page is left", async () => {
    const network = heldFetch();
    const { result } = renderAutosave();
    act(() => result.current.queue({ vendors: [{ category: "venue", done: true }] }));
    act(() => void window.dispatchEvent(new Event("pagehide")));
    await drainPromises();
    expect(network.calls).toEqual([
      { body: { vendors: [{ category: "venue", done: true }] }, keepalive: true },
    ]);
  });

  it("does nothing without an edit key", async () => {
    const network = heldFetch();
    const { result } = renderAutosave(null);
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await advance(2000);
    expect(network.calls).toHaveLength(0);
    expect(result.current.saveState).toBe("idle");
  });
});

describe("useAutosave failures", () => {
  it("puts a transiently failed change back and retries it until it is saved", async () => {
    const bodies = scriptedFetch([0, 503, 200]);
    const { result } = renderAutosave();
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await advance(DEBOUNCE_MS);
    await drainPromises();
    expect(result.current.saveState).toBe("retrying");
    act(() => result.current.queue({ tasks: [{ id: "b", done: true }] }));
    await advance(2000);
    await drainPromises();
    await advance(4000);
    await drainPromises();
    expect(result.current.saveState).toBe("saved");
    expect(bodies.at(-1)).toEqual({
      tasks: [
        { id: "a", done: true },
        { id: "b", done: true },
      ],
    });
  });

  it("reports a rejected change without retrying it", async () => {
    const bodies = scriptedFetch([422]);
    const { result } = renderAutosave();
    act(() => result.current.queue({ actuals: [{ category: "venue", actualINR: 5 }] }));
    await advance(DEBOUNCE_MS);
    await drainPromises();
    await advance(20_000);
    expect(result.current.saveState).toBe("rejected");
    expect(bodies).toHaveLength(1);
  });

  it("flags a wrong edit key", async () => {
    scriptedFetch([403]);
    const { result } = renderAutosave();
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await advance(DEBOUNCE_MS);
    await drainPromises();
    expect(result.current.saveState).toBe("forbidden");
  });
});
