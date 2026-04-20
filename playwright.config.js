// playwright.config.js
// Playwright E2E configuration for Geply
// Run: npx playwright test
// UI mode: npx playwright test --ui
// Single file: npx playwright test e2e/tests/01-auth.spec.js

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",

  // Fail fast in CI — run all locally
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Global timeout per test
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ...(process.env.CI ? [["github"]] : []),
  ],

  use: {
    // Both servers must be running
    baseURL: "http://localhost:5173",

    // Capture everything on failure
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",

    // Don't slow down happy-path tests
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // ── Main browser suite (UI + API) ──────────────────────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Grant camera/mic so interview room doesn't block on permissions
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--disable-web-security", // prevents CORS issues against localhost API
          ],
        },
      },
    },

    // ── API-only smoke tests (headless, no browser rendering needed) ───────
    {
      name: "api",
      testMatch: "**/10-api-smoke.spec.js",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Firefox (optional, runs in CI only) ───────────────────────────────
    ...(process.env.CI
      ? [
          {
            name: "firefox",
            use: {
              ...devices["Desktop Firefox"],
              launchOptions: {
                firefoxUserPrefs: {
                  "media.navigator.permission.disabled": true,
                  "media.navigator.streams.fake": true,
                },
              },
            },
          },
        ]
      : []),

    // ── Mobile viewport tests ─────────────────────────────────────────────
    {
      name: "mobile-chrome",
      testMatch: "**/09-dashboard.spec.js", // only responsive test needs mobile
      use: { ...devices["Pixel 7"] },
    },
  ],

  // Spin up backend + frontend before running tests
  // Comment out if you prefer to start servers manually
  webServer: [
    {
      name: "backend",
      command: "py -3.12 -m uvicorn app.main:app --port 8000",
      url: "http://localhost:8000/docs",
      cwd: "C:\\Users\\prasanth.ragupathy\\Downloads\\hireai",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "frontend",
      command: "npm run dev",
      url: "http://localhost:5173",
      cwd: "C:\\Users\\prasanth.ragupathy\\Downloads\\hireai\\frontend",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
