import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/ai/live.test.ts", "e2e/**", "node_modules/**"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "json-summary"],
      // Glob thresholds apply to each glob's own aggregate: the pure engine stays at 100 %,
      // and all of src/lib (server, AI, store, security, contracts, client helpers) at ≥ 80 %.
      thresholds: {
        "src/lib/engine/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/lib/**": { lines: 80, statements: 80, functions: 80, branches: 75 },
      },
    },
  },
});
