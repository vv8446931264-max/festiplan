/**
 * Poster harness: renders the real lantern scene over the real CSS dusk sky so
 * scripts/capture-poster.mjs can screenshot it. Query flags (for previews):
 * `tier=low`, `mood=focus|plan`, `scroll=0..1`, `palette=hex,hex`, `celebrate=1`,
 * `wait=ms` (default 2200), `sky=0` (scene only), `scene=0` (sky only).
 */
import type { Mood } from "../../src/three/bus";
import { DUSK_BACKGROUND, skyFade } from "../../src/three/dusk";
import { createLanternScene } from "../../src/three/lantern-scene";

declare global {
  interface Window {
    __posterReady?: boolean;
    __posterError?: string;
  }
}

const params = new URLSearchParams(window.location.search);
const MOODS: readonly Mood[] = ["hero", "focus", "plan"];

function moodParam(): Mood {
  const raw = params.get("mood");
  return MOODS.find((m) => m === raw) ?? "hero";
}

function start(): void {
  const sky = document.getElementById("sky");
  const canvas = document.getElementById("scene");
  if (!(canvas instanceof HTMLCanvasElement) || !sky) throw new Error("harness markup missing");
  const scroll = Number(params.get("scroll") ?? 0);
  if (params.get("sky") !== "0") sky.style.background = DUSK_BACKGROUND;
  sky.style.opacity = String(skyFade(scroll));
  const wait = Number(params.get("wait") ?? 2200);
  if (params.get("scene") === "0") {
    window.__posterReady = true;
    return;
  }
  const scene = createLanternScene(canvas, {
    tier: params.get("tier") === "low" ? "low" : "high",
    onFirstFrame: () => window.setTimeout(() => (window.__posterReady = true), wait),
  });
  scene.resize(window.innerWidth, window.innerHeight);
  scene.setScroll(scroll);
  scene.setMood(moodParam());
  const palette = params.get("palette");
  if (palette) scene.setPalette(palette.split(",").map((h) => `#${h.replace("#", "")}`));
  if (params.get("celebrate") === "1") scene.celebrate();
}

try {
  start();
} catch (error) {
  window.__posterError = error instanceof Error ? error.message : String(error);
}
