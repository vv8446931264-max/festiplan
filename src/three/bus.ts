/**
 * Framework-free event bus between the DOM and the background scene. UI code
 * imports this module (a few hundred bytes) and never touches three.js; the
 * lazily loaded scene subscribes when it arrives and replays `getState()`.
 */

/** Scene choreography state named after the storyboard (docs/DESIGN.md §5). */
export type Mood = "hero" | "focus" | "plan";

/** Everything a late subscriber needs to catch up. */
export type SceneState = {
  palette: readonly string[] | null;
  mood: Mood;
  /** Number of `celebrate()` calls so far. */
  celebrations: number;
};

/** One change, delivered to every listener with the state after it. */
export type SceneEvent =
  | { type: "celebrate" }
  | { type: "palette"; palette: readonly string[] | null }
  | { type: "mood"; mood: Mood };

/** Listener signature for {@link subscribe}. */
export type SceneListener = (event: SceneEvent, state: SceneState) => void;

/** The bus API; the module-level functions below are bound to one shared instance. */
export type SceneBus = {
  celebrate(): void;
  setPalette(hexes: readonly string[] | null): void;
  setMood(mood: Mood): void;
  subscribe(listener: SceneListener): () => void;
  getState(): SceneState;
};

const HEX = /^#[0-9a-f]{6}$/i;
const MOODS: readonly Mood[] = ["hero", "focus", "plan"];
const MAX_COLOURS = 8;

/** Keep only `#rrggbb` colours (max 8); an empty result means "no palette". */
export function normalizePalette(hexes: readonly string[] | null): readonly string[] | null {
  if (!hexes) return null;
  const clean = hexes.filter((h) => typeof h === "string" && HEX.test(h)).slice(0, MAX_COLOURS);
  return clean.length > 0 ? clean.map((h) => h.toLowerCase()) : null;
}

function samePalette(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

/** Create an isolated bus (tests, or a second scene). */
export function createBus(): SceneBus {
  let state: SceneState = { palette: null, mood: "hero", celebrations: 0 };
  const listeners = new Set<SceneListener>();
  const emit = (event: SceneEvent) => {
    for (const listener of [...listeners]) listener(event, state);
  };
  return {
    celebrate() {
      state = { ...state, celebrations: state.celebrations + 1 };
      emit({ type: "celebrate" });
    },
    setPalette(hexes) {
      const palette = normalizePalette(hexes);
      if (samePalette(palette, state.palette)) return;
      state = { ...state, palette };
      emit({ type: "palette", palette });
    },
    setMood(mood) {
      if (!MOODS.includes(mood) || mood === state.mood) return;
      state = { ...state, mood };
      emit({ type: "mood", mood });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getState: () => state,
  };
}

const shared = createBus();

/** Fire the confetti burst (once per successful plan). */
export function celebrate(): void {
  shared.celebrate();
}

/** Tint the lanterns to a concept palette (`#rrggbb` list), or `null` for the default warm glow. */
export function setPalette(hexes: readonly string[] | null): void {
  shared.setPalette(hexes);
}

/** Switch the scene choreography: "hero" drift, "focus" dims and slows, "plan" lifts the lanterns. */
export function setMood(mood: Mood): void {
  shared.setMood(mood);
}

/** Listen for scene events; returns an unsubscribe function. */
export function subscribe(listener: SceneListener): () => void {
  return shared.subscribe(listener);
}

/** Current palette, mood and celebration count. */
export function getState(): SceneState {
  return shared.getState();
}
