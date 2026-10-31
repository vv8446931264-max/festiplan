#!/usr/bin/env node
/**
 * Capture public/poster.webp from the REAL lantern scene (docs/DESIGN.md §7: the
 * reduced-motion / Save-Data / low-power fallback must look like the live sky).
 *
 * Starts a throwaway Vite dev server on scripts/poster-harness, renders
 * src/three/lantern-scene.ts at 1600×1000 (tier "high") over the same CSS dusk
 * gradient, screenshots it with Playwright Chromium (SwiftShader WebGL when no
 * GPU), encodes WebP in-page with canvas.toDataURL and keeps it under 80 KB.
 *
 * Usage: node scripts/capture-poster.mjs [--png file.png] [--query "mood=plan"] [--out file.webp]
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WIDTH = 1600;
const HEIGHT = 1000;
const MAX_BYTES = 80 * 1024;
const QUALITIES = [0.8, 0.74, 0.68, 0.6, 0.52, 0.45];
const GPU_ARGS = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

function parseArgs(argv) {
  const out = { png: null, query: "", out: path.join(ROOT, "public/poster.webp") };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key in out) out[key] = argv[i + 1] ?? "";
  }
  return out;
}

async function launch() {
  try {
    return await chromium.launch({ args: GPU_ARGS });
  } catch (error) {
    // The pinned Playwright may expect a newer browser build than the one baked
    // into the image; fall back to the Chromium that is actually installed.
    const fallback = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? "", "chromium");
    if (existsSync(fallback)) return chromium.launch({ executablePath: fallback, args: GPU_ARGS });
    throw error;
  }
}

async function startServer() {
  const server = await createServer({
    configFile: false,
    root: path.join(ROOT, "scripts/poster-harness"),
    resolve: { alias: { "@": path.join(ROOT, "src") } },
    server: { host: "127.0.0.1", port: 5199, strictPort: false, fs: { allow: [ROOT] } },
    logLevel: "warn",
    clearScreen: false,
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite did not report a local URL");
  return { server, url };
}

async function render(page, url, query) {
  page.on("pageerror", (error) => console.error("[page]", error.message));
  page.on("console", (msg) => msg.type() === "error" && console.error("[console]", msg.text()));
  await page.goto(`${url}?${query}`);
  await page.waitForFunction(
    () => window.__posterReady === true || typeof window.__posterError === "string",
    null,
    {
      timeout: 180_000,
    },
  );
  const failure = await page.evaluate(() => window.__posterError);
  if (failure) throw new Error(`harness failed: ${failure}`);
  return page.screenshot({ type: "png" });
}

async function encodeWebp(page, png) {
  const base64 = png.toString("base64");
  for (const quality of QUALITIES) {
    const dataUrl = await page.evaluate(
      async ({ b64, q, w, h }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL("image/webp", q);
      },
      { b64: base64, q: quality, w: WIDTH, h: HEIGHT },
    );
    if (!dataUrl.startsWith("data:image/webp")) throw new Error("this Chromium cannot encode WebP");
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    if (bytes.length <= MAX_BYTES) return { bytes, quality };
  }
  throw new Error(`poster stays above ${MAX_BYTES} bytes even at the lowest quality`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { server, url } = await startServer();
  const browser = await launch();
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    const png = await render(page, url, args.query);
    if (args.png) await writeFile(args.png, png);
    const { bytes, quality } = await encodeWebp(page, png);
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, bytes);
    console.log(
      `poster: ${path.relative(ROOT, args.out)} ${WIDTH}×${HEIGHT} ${bytes.length} bytes (webp q=${quality})`,
    );
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
