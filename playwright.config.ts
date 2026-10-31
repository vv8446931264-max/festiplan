import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** IPv4 loopback on both sides, so the standalone server and the browser agree on the host. */
const HOST = "127.0.0.1";

/**
 * End-to-end tests run against a production build in template mode (no AI
 * credentials, in-memory store) on a desktop and a mobile profile.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "retain-on-failure",
    // Optional: use a pre-installed Chromium instead of the version-pinned download.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // The same standalone server the Docker image runs (`npm start`), on a fresh build.
  webServer: {
    command: "npm run build && npm start",
    url: `http://${HOST}:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      PORT: String(PORT),
      HOSTNAME: HOST,
      RATE_LIMIT_SCALE: "50",
      GEMINI_API_KEY: "",
      GOOGLE_GENAI_USE_VERTEXAI: "",
      GOOGLE_CLOUD_PROJECT: "",
    },
  },
});
