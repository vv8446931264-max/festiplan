import { useSyncExternalStore } from "react";

/*
 * The visitor's "Pause animation" choice (WCAG 2.2.2 Pause, Stop, Hide). It lives in
 * localStorage, so it survives reloads and reaches every open tab (the `storage` event),
 * and is read with useSyncExternalStore: the server and hydration render "not paused",
 * then the client gets the stored value without a setState-in-effect round trip.
 * Storage can be blocked or full (private modes, strict privacy settings), so every
 * access is guarded; the choice then holds for this page only.
 */

/** localStorage key for the choice: "1" paused, "0" playing. */
export const ANIMATION_PAUSED_KEY = "festiplan:animation-paused";

const PAUSED = "1";
const PLAYING = "0";

/** This page's choice while storage refuses to keep it; null when storage holds it. */
let unsavedChoice: boolean | null = null;
const listeners = new Set<() => void>();

/** Runs one storage call; blocked or full storage throws, which only means "not available". */
function tryStorage<T>(call: (storage: Storage) => T): T | undefined {
  try {
    return call(window.localStorage);
  } catch {
    return undefined;
  }
}

function readPaused(): boolean {
  if (unsavedChoice !== null) return unsavedChoice;
  return tryStorage((storage) => storage.getItem(ANIMATION_PAUSED_KEY)) === PAUSED;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab changed the choice, or cleared storage altogether (key null).
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ANIMATION_PAUSED_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = (): boolean => false;

/** Whether the visitor paused the background animation; false on the server and during hydration. */
export function useAnimationPaused(): boolean {
  return useSyncExternalStore(subscribe, readPaused, serverSnapshot);
}

/** Pause or resume the background animation, remember the choice and update every subscriber. */
export function setAnimationPaused(paused: boolean): void {
  const saved = tryStorage((storage) => {
    storage.setItem(ANIMATION_PAUSED_KEY, paused ? PAUSED : PLAYING);
    return true;
  });
  unsavedChoice = saved ? null : paused;
  listeners.forEach((listener) => listener());
}
