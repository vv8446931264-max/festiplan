"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export const TABS = [
  ["overview", "Overview"],
  ["ideas", "Ideas"],
  ["budget", "Budget"],
  ["timeline", "Timeline"],
  ["vendors", "Vendors"],
  ["ask", "Ask"],
  ["share", "Share"],
] as const;
export type TabId = (typeof TABS)[number][0];

const isTab = (s: string): s is TabId => TABS.some(([id]) => id === s);

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

/**
 * The active plan tab: the user's last choice, else the URL hash (`#budget` deep links
 * work and survive a refresh), else Overview. Selecting a tab updates the hash without
 * adding history entries, and brings the panel into view if the reader had scrolled past it.
 */
export function useActiveTab(): readonly [TabId, (id: TabId) => void] {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );
  const [chosen, setChosen] = useState<TabId | null>(null);
  const active: TabId = chosen ?? (isTab(hash) ? hash : "overview");
  const select = useCallback((id: TabId) => {
    setChosen(id);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${id}`,
    );
    requestAnimationFrame(() => {
      const panel = document.getElementById(`panel-${id}`);
      if (panel && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: "start" });
    });
  }, []);
  return [active, select] as const;
}

const NEXT_KEY: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/** Sticky WAI-ARIA tab list: roving tabindex, arrow keys, Home and End. */
export function PlanTabs({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const mounted = useRef(false);
  // On narrow screens the bar scrolls sideways; keep the active tab in view after a change
  // (not on first load, which would jump the page to the tab bar).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const index = TABS.findIndex(([id]) => id === active);
    buttons.current[index]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const move = NEXT_KEY[e.key];
    if (!move) return;
    e.preventDefault();
    const j = move(i, TABS.length);
    onSelect(TABS[j][0]);
    buttons.current[j]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Plan sections"
      className="no-print sticky top-0 z-20 -mx-[var(--pad)] flex gap-2 overflow-x-auto bg-espresso/90 px-[var(--pad)] py-3 backdrop-blur"
    >
      {TABS.map(([id, label], i) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-controls={`panel-${id}`}
          aria-selected={active === id}
          tabIndex={active === id ? 0 : -1}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          onClick={() => onSelect(id)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className="eyebrow inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-cream transition-colors hover:border-cream aria-selected:border-cream aria-selected:bg-cream aria-selected:text-espresso"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** One tab panel; inactive panels stay mounted (state survives) but are hidden. */
export function TabPanel({
  id,
  active,
  children,
}: {
  id: TabId;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      tabIndex={0}
      className="tab-panel scroll-mt-20 outline-none"
    >
      {children}
    </div>
  );
}

/** Before printing, unfold every collapsed group so the printout is the complete plan. */
export function useUnfoldForPrint(): void {
  useEffect(() => {
    const unfold = () =>
      document.querySelectorAll("details:not([open])").forEach((d) => d.setAttribute("open", ""));
    window.addEventListener("beforeprint", unfold);
    return () => window.removeEventListener("beforeprint", unfold);
  }, []);
}
