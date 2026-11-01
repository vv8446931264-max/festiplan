import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanHeader } from "@/components/plan/PlanHeader";
import { fixturePlan } from "../fixtures/plan";
import {
  advance,
  DEBOUNCE_MS,
  drainPromises,
  heldFetch,
  renderAutosave,
  scriptedFetch,
  throwingFetch,
} from "./autosave-fakes";

/** The waits between the first attempt and its four retries (RETRY_STEP_MS × 1…4 in useAutosave). */
const RETRY_WAITS_MS = [2000, 4000, 6000, 8000];

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

  it("stops saying it is retrying once the retries run out, and resumes when the browser is online", async () => {
    const bodies = scriptedFetch([0, 0, 0, 0, 0]);
    const { result } = renderAutosave();
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await advance(DEBOUNCE_MS);
    await drainPromises();
    for (const wait of RETRY_WAITS_MS) {
      expect(result.current.saveState).toBe("retrying");
      await advance(wait);
      await drainPromises();
    }
    expect(bodies).toHaveLength(RETRY_WAITS_MS.length + 1);
    expect(result.current.saveState).toBe("stalled");
    await advance(60_000);
    await drainPromises();
    expect(bodies).toHaveLength(RETRY_WAITS_MS.length + 1);
    act(() => void window.dispatchEvent(new Event("online")));
    await drainPromises();
    expect(bodies).toHaveLength(RETRY_WAITS_MS.length + 2);
    expect(bodies.at(-1)).toEqual({ tasks: [{ id: "a", done: true }] });
    expect(result.current.saveState).toBe("saved");
  });

  it("counts a save that throws as a failed attempt: nothing stays in flight, the change is kept", async () => {
    const bodies = throwingFetch();
    const { result } = renderAutosave();
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await advance(DEBOUNCE_MS);
    await drainPromises();
    expect(result.current.saveState).toBe("retrying");
    await advance(RETRY_WAITS_MS[0] ?? 0);
    await drainPromises();
    const change = { tasks: [{ id: "a", done: true }] };
    expect(bodies).toEqual([change, change]);
    // "saved" needs nothing in flight, so the counter came down after the throw too.
    expect(result.current.saveState).toBe("saved");
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

describe("the save status line", () => {
  it("says what happens next once the retries have run out", () => {
    render(<PlanHeader plan={fixturePlan()} saveState="stalled" editable />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/back online or make another change/);
    expect(status).not.toHaveTextContent(/retrying/);
  });
});
