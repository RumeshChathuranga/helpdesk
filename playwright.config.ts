import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "server/.env.test") });

const E2E_API_PORT = "8081";
const E2E_API_URL = `http://localhost:${E2E_API_PORT}`;
process.env.E2E_API_URL = E2E_API_URL;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "playwright-report" }]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use system Google Chrome — no separate `playwright install` needed locally.
        channel: "chrome",
      },
    },
  ],

  webServer: [
    {
      command: "bun run --filter server test:server",
      url: `${E2E_API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL!,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
        BETTER_AUTH_URL: E2E_API_URL,
        CLIENT_URL: process.env.CLIENT_URL!,
        INBOUND_WEBHOOK_SECRET:
          process.env.INBOUND_WEBHOOK_SECRET ?? "test-inbound-webhook-secret",
        NODE_ENV: "test",
        PORT: E2E_API_PORT,
      },
    },
    {
      command: "bun run --filter client dev",
      url: "http://localhost:5173",
      // Never reuse an already-running dev Vite server here: it would be
      // proxying `/api` to whatever VITE_API_PROXY_TARGET it was originally
      // started with (typically the dev API on port 3000), not this run's
      // isolated E2E_API_URL — silently sending browser traffic (and writes)
      // into the dev database instead of the test one.
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        VITE_API_PROXY_TARGET: E2E_API_URL,
      },
    },
  ],

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
});
