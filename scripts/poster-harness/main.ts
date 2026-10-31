/**
 * Poster harness: renders the real lantern scene over the real CSS dusk sky so
 * scripts/capture-poster.mjs can screenshot it. Query flags (for previews):
 * `tier=low`, `mood=focus|plan`, `scroll=0..1`, `palette=hex,hex`, `celebrate=1`,
 * `wait=ms` (default 2200), `sky=0` (scene only), `scene=0` (sky only).
 */
import type { Mood } from "../../src/three/bus";
import { DUSK_BACKGROUND, skyFade } from "../../src/three/dusk";
import { createLanternScene } from "../../src/three/lantern-scene";

/** The flags capture-poster.mjs polls for. */
type PosterWindow = Window & { __posterReady?: boolean; __posterError?: string };

const posterWindow: PosterWindow = window;
const params = new URLSearchParams(window.location.search);
const MOODS: readonly Mood[] = ["hero", "focus", "plan"];
/** Let the lanterns drift into place before the screenshot. */
const DEFAULT_SETTLE_MS = 2200;

function moodParam(): Mood {
  const raw = params.get("mood");
  return MOODS.find((mood) => mood === raw) ?? "hero";
}

function start(): void {
  const sky = document.getElementById("sky");
  const canvas = document.getElementById("scene");
  if (!(canvas instanceof HTMLCanvasElement) || !sky) throw new Error("harness markup missing");
  const scroll = Number(params.get("scroll") ?? 0);
  if (params.get("sky") !== "0") sky.style.background = DUSK_BACKGROUND;
  sky.style.opacity = String(skyFade(scroll));
  const settleMs = Number(params.get("wait") ?? DEFAULT_SETTLE_MS);
  if (params.get("scene") === "0") {
    posterWindow.__posterReady = true;
    return;
  }
  const scene = createLanternScene(canvas, {
    tier: params.get("tier") === "low" ? "low" : "high",
    onFirstFrame: () => window.setTimeout(() => (posterWindow.__posterReady = true), settleMs),
  });
  scene.resize(window.innerWidth, window.innerHeight);
  scene.setScroll(scroll);
  scene.setMood(moodParam());
  const palette = params.get("palette");
  if (palette) scene.setPalette(palette.split(",").map((hex) => `#${hex.replace("#", "")}`));
  if (params.get("celebrate") === "1") scene.celebrate();
}

try {
  start();
} catch (error) {
  posterWindow.__posterError = error instanceof Error ? error.message : String(error);
}
