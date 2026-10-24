import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/components/plan/useAutosave";

type Call = { body: unknown; keepalive: boolean | undefined };

function mockFetch() {
  const calls: Call[] = [];
  const release: (() => void)[] = [];
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)), keepalive: init.keepalive });
    return new Promise<Response>((resolve) => {
      release.push(() => resolve(new Response(JSON.stringify({ plan: {} }), { status: 200 })));
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, release };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await act(async () => await Promise.resolve());
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAutosave", () => {
  it("merges quick changes into one PATCH and reports saved only when idle", async () => {
    const net = mockFetch();
    const { result } = renderHook(() => useAutosave("plan123", "k".repeat(43)));
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    act(() => result.current.queue({ tasks: [{ id: "b", done: true }] }));
    expect(result.current.saveState).toBe("saving");
    await act(async () => vi.advanceTimersByTime(700));
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0]?.body).toEqual({ tasks: [{ id: "a", done: true }, { id: "b", done: true }] });
    expect(result.current.saveState).toBe("saving");
    net.release[0]?.();
    await settle();
    expect(result.current.saveState).toBe("saved");
  });

  it("does not claim saved while a later change is still pending, and keeps saves in order", async () => {
    const net = mockFetch();
    const { result } = renderHook(() => useAutosave("plan123", "k".repeat(43)));
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await act(async () => vi.advanceTimersByTime(700));
    act(() => result.current.queue({ tasks: [{ id: "b", done: true }] }));
    net.release[0]?.();
    await settle();
    expect(result.current.saveState).toBe("saving");
    await act(async () => vi.advanceTimersByTime(700));
    await settle();
    expect(net.calls.map((c) => c.body)).toEqual([
      { tasks: [{ id: "a", done: true }] },
      { tasks: [{ id: "b", done: true }] },
    ]);
    net.release[1]?.();
    await settle();
    expect(result.current.saveState).toBe("saved");
  });

  it("flushes immediately with keepalive when the page is left", async () => {
    const net = mockFetch();
    const { result } = renderHook(() => useAutosave("plan123", "k".repeat(43)));
    act(() => result.current.queue({ vendors: [{ category: "venue", done: true }] }));
    act(() => void window.dispatchEvent(new Event("pagehide")));
    await settle();
    expect(net.calls).toEqual([{ body: { vendors: [{ category: "venue", done: true }] }, keepalive: true }]);
  });

  it("does nothing without an edit key", async () => {
    const net = mockFetch();
    const { result } = renderHook(() => useAutosave("plan123", null));
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await act(async () => vi.advanceTimersByTime(2000));
    expect(net.calls).toHaveLength(0);
    expect(result.current.saveState).toBe("idle");
  });
});

describe("useAutosave failures", () => {
  function scripted(statuses: number[]) {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      const status = statuses.shift() ?? 200;
      if (status === 0) throw new TypeError("network down");
      return new Response(JSON.stringify(status < 300 ? { plan: {} } : { error: "nope" }), { status });
    }));
    return bodies;
  }

  it("puts a transiently failed change back and retries it until it is saved", async () => {
    const bodies = scripted([0, 503, 200]);
    const { result } = renderHook(() => useAutosave("plan123", "k".repeat(43)));
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await act(async () => vi.advanceTimersByTime(700));
    await settle();
    expect(result.current.saveState).toBe("retrying");
    act(() => result.current.queue({ tasks: [{ id: "b", done: true }] }));
    await act(async () => vi.advanceTimersByTime(2000));
    await settle();
    await act(async () => vi.advanceTimersByTime(4000));
    await settle();
    expect(result.current.saveState).toBe("saved");
    expect(bodies.at(-1)).toEqual({ tasks: [{ id: "a", done: true }, { id: "b", done: true }] });
  });

  it("reports a rejected change without retrying it", async () => {
    const bodies = scripted([422]);
    const { result } = renderHook(() => useAutosave("plan123", "k".repeat(43)));
    act(() => result.current.queue({ actuals: [{ category: "venue", actualINR: 5 }] }));
    await act(async () => vi.advanceTimersByTime(700));
    await settle();
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(result.current.saveState).toBe("rejected");
    expect(bodies).toHaveLength(1);
  });

  it("flags a wrong edit key", async () => {
    scripted([403]);
    const { result } = renderHook(() => useAutosave("plan123", "k".repeat(43)));
    act(() => result.current.queue({ tasks: [{ id: "a", done: true }] }));
    await act(async () => vi.advanceTimersByTime(700));
    await settle();
    expect(result.current.saveState).toBe("forbidden");
  });
});
