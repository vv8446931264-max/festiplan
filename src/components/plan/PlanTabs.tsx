"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { nextTabIndex, TABS, type TabId } from "./tabs";

type TabButtons = RefObject<(HTMLButtonElement | null)[]>;

/** Roving focus between the tab buttons: arrow keys wrap around, Home and End jump. */
function useTabKeyboard(onSelect: (id: TabId) => void) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target = nextTabIndex(event.key, index, TABS.length);
    if (target === null) return;
    event.preventDefault();
    onSelect(TABS[target].id);
    buttons.current[target]?.focus();
  };
  return { buttons, onKeyDown };
}

/**
 * On narrow screens the tab bar scrolls sideways: keep the active tab in view after a
 * change, but not on first load, which would jump the page down to the tab bar.
 */
function useActiveTabInView(buttons: TabButtons, active: TabId) {
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const index = TABS.findIndex((tab) => tab.id === active);
    // Optional call: jsdom (unit tests) does not implement scrollIntoView.
    buttons.current[index]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [buttons, active]);
}

type Props = { active: TabId; onSelect: (id: TabId) => void };

/** Sticky WAI-ARIA tab list: roving tabindex, arrow keys, Home and End. */
export function PlanTabs({ active, onSelect }: Props) {
  const { buttons, onKeyDown } = useTabKeyboard(onSelect);
  useActiveTabInView(buttons, active);
  return (
    <div
      role="tablist"
      aria-label="Plan sections"
      className="no-print sticky top-0 z-20 -mx-[var(--pad)] flex gap-2 overflow-x-auto bg-espresso/90 px-[var(--pad)] py-3 backdrop-blur"
    >
      {TABS.map(({ id, label }, index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-controls={`panel-${id}`}
          aria-selected={active === id}
          tabIndex={active === id ? 0 : -1}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          onClick={() => onSelect(id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className="eyebrow inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-cream transition-colors hover:border-cream aria-selected:border-cream aria-selected:bg-cream aria-selected:text-espresso"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type PanelProps = { id: TabId; active: boolean; children: ReactNode };

/** One tab panel; inactive panels stay mounted (their state survives) but are hidden. */
export function TabPanel({ id, active, children }: PanelProps) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      tabIndex={0}
      className="tab-panel scroll-mt-3 outline-none"
    >
      {children}
    </div>
  );
}
