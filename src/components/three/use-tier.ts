import { useSyncExternalStore } from "react";
import { detectTier, type Tier } from "@/three/tier";

/*
 * The tier is browser-only state: read it with useSyncExternalStore so the server
 * (and hydration) see `null` and the client gets the real value without a
 * setState-in-effect round trip. Detection probes WebGL once, so it is cached and
 * only recomputed when the reduced-motion or pointer media queries change.
 */

const WATCHED = ["(prefers-reduced-motion: reduce)", "(pointer: coarse)"];
let cached: Tier | null = null;

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const lists = WATCHED.map((q) => window.matchMedia(q));
  const handler = () => {
    cached = null;
    onChange();
  };
  lists.forEach((l) => l.addEventListener?.("change", handler));
  return () => lists.forEach((l) => l.removeEventListener?.("change", handler));
}

function snapshot(): Tier {
  cached ??= detectTier(window);
  return cached;
}

const serverSnapshot = (): Tier | null => null;

/** Rendering tier for this browser, or `null` on the server and during hydration. */
export function useTier(): Tier | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Forget the cached tier (tests, or after a WebGL context failure). */
export function resetTierCache(): void {
  cached = null;
}
