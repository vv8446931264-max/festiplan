"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { isTabId, type TabId } from "./tabs";

const DEFAULT_TAB: TabId = "overview";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash.slice(1);
const readServerHash = () => "";

/** Brings a just-selected panel into view when the reader had scrolled past its top. */
function revealPanel(id: TabId) {
  requestAnimationFrame(() => {
    const panel = document.getElementById(`panel-${id}`);
    if (panel && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: "start" });
  });
}

/**
 * The active plan tab: the user's last choice, else the URL hash (`#budget` deep links
 * work and survive a refresh), else Overview. Selecting a tab updates the hash without
 * adding history entries, and brings the panel into view if the reader had scrolled past it.
 */
export function useActiveTab(): readonly [TabId, (id: TabId) => void] {
  const hash = useSyncExternalStore(subscribeToHash, readHash, readServerHash);
  const [chosen, setChosen] = useState<TabId | null>(null);
  const active = chosen ?? (isTabId(hash) ? hash : DEFAULT_TAB);
  const select = useCallback((id: TabId) => {
    setChosen(id);
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", `${pathname}${search}#${id}`);
    revealPanel(id);
  }, []);
  return [active, select] as const;
}
