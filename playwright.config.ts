import { defineConfig, devices } from '@playwright/test';

// In the cloud container, PW_CHROMIUM_PATH points at the preinstalled Chromium (ADR 0008).
const executablePath = process.env['PW_CHROMIUM_PATH'];
const chromium = {
  ...devices['Desktop Chrome'],
  ...(executablePath ? { launchOptions: { executablePath } } : {}),
};

export default defineConfig({
  webServer: { command: 'npx vite --port 5179 --strictPort', port: 5179 },
  use: { baseURL: 'http://localhost:5179', trace: 'off' },
  projects: [
    // The two whole-year runs play in real time at ?fast=10, so they run after the rest, on their
    // own: under the full suite's load a slow page falls behind the sim and misses a chapter's turn.
    { name: 'e2e', testDir: 'tests/e2e', testIgnore: 'part1.spec.ts', use: chromium },
    {
      name: 'e2e-year',
      testDir: 'tests/e2e',
      testMatch: 'part1.spec.ts',
      use: chromium,
      dependencies: ['e2e'],
    },
    { name: 'e2e-firefox', testDir: 'tests/e2e', use: devices['Desktop Firefox'] },
    { name: 'e2e-webkit', testDir: 'tests/e2e', use: devices['Desktop Safari'] },
    { name: 'visual', testDir: 'tests/visual', use: chromium },
    {
      name: 'perf',
      testDir: 'tests/perf',
      use: { ...chromium, headless: process.env['PERF_HEADED'] !== '1' },
    },
  ],
});
