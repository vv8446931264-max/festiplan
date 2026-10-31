import { useSyncExternalStore } from "react";
import { detectTier, type Tier } from "@/three/tier";

/*
 * The tier is browser-only state: read it with useSyncExternalStore so the server
 * (and hydration) see `null` and the client gets the real value without a
 * setState-in-effect round trip. Detection probes WebGL once, so it is cached and
 * only recomputed when the reduced-motion or pointer media queries change.
 */

const WATCHED_MEDIA_QUERIES = ["(prefers-reduced-motion: reduce)", "(pointer: coarse)"];

/** Safari < 14 lists only implement the deprecated addListener API, so treat these as optional. */
type ChangeTarget = Partial<Pick<MediaQueryList, "addEventListener" | "removeEventListener">>;

let cachedTier: Tier | null = null;

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const lists: ChangeTarget[] = WATCHED_MEDIA_QUERIES.map((query) => window.matchMedia(query));
  const handleChange = () => {
    cachedTier = null;
    onChange();
  };
  lists.forEach((list) => list.addEventListener?.("change", handleChange));
  return () => lists.forEach((list) => list.removeEventListener?.("change", handleChange));
}

function snapshot(): Tier {
  cachedTier ??= detectTier(window);
  return cachedTier;
}

const serverSnapshot = (): Tier | null => null;

/** Rendering tier for this browser, or `null` on the server and during hydration. */
export function useTier(): Tier | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Forget the cached tier (tests, or after a WebGL context failure). */
export function resetTierCache(): void {
  cachedTier = null;
}
