const PREFIX = "festiplan:edit:";
const listeners = new Set<() => void>();

/** Subscribes to edit-key changes in this tab (for `useSyncExternalStore`). */
export function subscribeEditKeys(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Remembers the edit key for a plan in this browser. Storage failures are ignored. */
export function saveEditKey(id: string, key: string): void {
  try {
    localStorage.setItem(PREFIX + id, key);
  } catch {
    /* private mode or storage disabled — editing still works for this session */
  }
  listeners.forEach((l) => l());
}

/** Returns the stored edit key for a plan, or null. */
export function loadEditKey(id: string): string | null {
  try {
    return localStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}

/**
 * Reads an edit key from the URL fragment (`#edit=<key>`), which never reaches the
 * server, stores it and removes it from the address bar.
 */
export function claimKeyFromHash(id: string): string | null {
  const match = /^#edit=([A-Za-z0-9_-]{20,100})$/.exec(window.location.hash);
  if (!match) return null;
  const key = match[1] ?? null;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (key) saveEditKey(id, key);
  return key;
}
