/** The plan workspace's chapters, in tab order. */
export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "ideas", label: "Ideas" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "vendors", label: "Vendors" },
  { id: "ask", label: "Ask" },
  { id: "share", label: "Share" },
] as const;

/** One chapter of the plan workspace. */
export type TabId = (typeof TABS)[number]["id"];

/** Whether a string (such as the URL hash) names a chapter. */
export function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

type Move = (index: number, count: number) => number;

/** Keyboard navigation in the WAI-ARIA tabs pattern: arrows wrap, Home and End jump. */
const KEY_MOVES: Partial<Record<string, Move>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

/** The tab index a key press moves to, or null when the key does not navigate tabs. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  const move = KEY_MOVES[key];
  return move ? move(index, count) : null;
}
