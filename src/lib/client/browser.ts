"use client";

import { useSyncExternalStore } from "react";
import { todayIST } from "../time";

const never = () => () => {};

/** Today's date in India (ISO), or "" during server render and hydration. */
export function useToday(): string {
  return useSyncExternalStore(never, todayIST, () => "");
}

/** `window.location.origin`, or "" during server render and hydration. */
export function useOrigin(): string {
  return useSyncExternalStore(never, () => window.location.origin, () => "");
}
