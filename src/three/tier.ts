/**
 * Rendering tier for the WebGL layer (docs/DESIGN.md §7–8). No three.js import:
 * this runs before the scene chunk is requested, and decides whether it ever is.
 */

/** "high": glass + transmission; "low": cheaper materials, fewer instances; "off": static poster. */
export type Tier = "high" | "low" | "off";

/** Everything the tier depends on, read from the browser by {@link readSignals}. */
export type TierSignals = {
  reducedMotion: boolean;
  saveData: boolean;
  /** `navigator.hardwareConcurrency`, when the browser reports it. */
  hardwareConcurrency: number | undefined;
  webgl: boolean;
  coarsePointer: boolean;
  viewportWidth: number;
  /** `navigator.deviceMemory` in GiB, when the browser reports it. */
  deviceMemory: number | undefined;
};

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

/**
 * Pure tier decision. Off under reduced motion, Save-Data, ≤ 4 logical cores or
 * no WebGL; low on touch-first, narrow (< 768 px) or ≤ 4 GiB devices; else high.
 */
export function tierFrom(s: TierSignals): Tier {
  if (s.reducedMotion || s.saveData || !s.webgl) return "off";
  if (s.hardwareConcurrency !== undefined && s.hardwareConcurrency <= 4) return "off";
  if (s.coarsePointer || s.viewportWidth < 768) return "low";
  if (s.deviceMemory !== undefined && s.deviceMemory <= 4) return "low";
  return "high";
}

function matches(win: Window, query: string): boolean {
  return typeof win.matchMedia === "function" && win.matchMedia(query).matches;
}

function finiteOrUndefined(n: unknown): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * True when a WebGL2 (or WebGL1) context can be created. The probe context is
 * released straight away so it never counts against the browser's context limit.
 */
export function hasWebGL(win: Window): boolean {
  try {
    const canvas = win.document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Read the tier signals from `win`; WebGL is probed only when `probeWebGL` is true. */
export function readSignals(win: Window, probeWebGL = true): TierSignals {
  const nav = win.navigator as NavigatorHints;
  return {
    reducedMotion: matches(win, "(prefers-reduced-motion: reduce)"),
    saveData: nav.connection?.saveData === true,
    hardwareConcurrency: finiteOrUndefined(nav.hardwareConcurrency),
    webgl: probeWebGL ? hasWebGL(win) : true,
    coarsePointer: matches(win, "(pointer: coarse)"),
    viewportWidth: win.innerWidth,
    deviceMemory: finiteOrUndefined(nav.deviceMemory),
  };
}

/**
 * Decide the tier for this browser. Cheap signals first: the WebGL probe (which
 * creates a context) only runs when nothing else already rules the canvas out.
 */
export function detectTier(win: Window = window): Tier {
  if (tierFrom(readSignals(win, false)) === "off") return "off";
  return tierFrom(readSignals(win, true));
}
