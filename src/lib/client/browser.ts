"use client";

import { useSyncExternalStore } from "react";
import { todayIST } from "../time";

/** These values fire no change events; React re-reads the snapshot on every render instead. */
const subscribeToNothing = (): (() => void) => () => undefined;

/** Today's date in India (ISO), or "" during server render and hydration. */
export function useToday(): string {
  return useSyncExternalStore(subscribeToNothing, todayIST, () => "");
}

/** `window.location.origin`, or "" during server render and hydration. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => "",
  );
}
