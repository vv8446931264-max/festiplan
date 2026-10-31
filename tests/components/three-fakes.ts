import { vi, type Mock } from "vitest";
import type { BudgetCategory } from "@/lib/contracts";

/** The options both scene factories receive. */
export type SceneOptions = { onFirstFrame?: () => void };

const LANTERN_METHODS = [
  "setScroll",
  "setPointer",
  "setPalette",
  "setMood",
  "celebrate",
  "resize",
  "pause",
  "resume",
  "dispose",
] as const;

/** A lantern scene whose every method is a mock. */
export type FakeLantern = Record<(typeof LANTERN_METHODS)[number], Mock>;

/** Stand-in for `createLanternScene`'s handle. */
export function fakeLantern(): FakeLantern {
  return Object.fromEntries(LANTERN_METHODS.map((method) => [method, vi.fn()])) as FakeLantern;
}

/** Stand-in for the Budget Flow handle; `hover` plays the scene's hover callback. */
export function fakeFlow() {
  let hoverListener: (category: BudgetCategory | null) => void = () => undefined;
  const api = {
    setAllocations: vi.fn(),
    setHighlight: vi.fn(),
    resize: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    onHover: vi.fn((listener: (category: BudgetCategory | null) => void) => {
      hoverListener = listener;
      return () => undefined;
    }),
  };
  return { api, hover: (category: BudgetCategory | null) => hoverListener(category) };
}

/** `window.matchMedia` that matches exactly the given queries. */
export function mockMatchMedia(matching: string[]): void {
  const matchMedia = (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(matchMedia),
  });
}

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void;

/** Installs a fake IntersectionObserver; the returned function flips every observed element. */
export function installIntersectionObserver(): (isIntersecting: boolean) => void {
  const callbacks: IntersectionCallback[] = [];
  class FakeIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: IntersectionCallback) {
      callbacks.push(callback);
    }
  }
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: FakeIntersectionObserver,
  });
  return (isIntersecting) => callbacks.forEach((callback) => callback([{ isIntersecting }]));
}

/** Removes the browser APIs the tests installed and restores spies. */
export function restoreBrowserFakes(): void {
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(window, "IntersectionObserver");
  vi.restoreAllMocks();
}

/** Three budget lines, venue the largest. */
export const ALLOCATIONS = [
  { category: "venue" as const, amountINR: 400_000 },
  { category: "catering" as const, amountINR: 300_000 },
  { category: "decor" as const, amountINR: 100_000 },
];
