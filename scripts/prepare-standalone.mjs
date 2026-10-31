#!/usr/bin/env node
// Completes the `output: "standalone"` build so `npm start` runs the same server as the
// Docker image: Next.js leaves public/ and .next/static out of .next/standalone, and the
// Dockerfile copies them in the same way.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STANDALONE = join(ROOT, ".next", "standalone");

if (!existsSync(STANDALONE)) {
  console.error('No .next/standalone: run `next build` with output: "standalone" first.');
  process.exit(1);
}
cpSync(join(ROOT, "public"), join(STANDALONE, "public"), { recursive: true });
cpSync(join(ROOT, ".next", "static"), join(STANDALONE, ".next", "static"), { recursive: true });
console.log("Standalone server ready: npm start (node .next/standalone/server.js)");
