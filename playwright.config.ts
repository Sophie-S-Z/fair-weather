import { defineConfig, devices } from '@playwright/test';

// In the cloud container, PW_CHROMIUM_PATH points at the preinstalled Chromium (ADR 0008).
const executablePath = process.env['PW_CHROMIUM_PATH'];
const chromium = {
  ...devices['Desktop Chrome'],
  ...(executablePath ? { launchOptions: { executablePath } } : {}),
};
/**
 * The e2e runs' Chromium: WebGL without multisampling. With no GPU (CI), the frame is drawn in
 * software, and the page's main thread waits for each one; a frame without 4x multisampling costs
 * half as much. The game asks for antialiasing as before, and the visual project keeps it, so its
 * baselines are the frames a player sees.
 */
const e2eChromium = {
  ...chromium,
  launchOptions: { ...chromium.launchOptions, args: ['--webgl-antialiasing-mode=none'] },
};

/** The whole-year runs, which the e2e-year project plays on their own. */
const YEAR = ['part1.spec.ts', 'part2.spec.ts'];

export default defineConfig({
  // On CI the tests run one at a time. With no GPU a page draws flat out in software, on the CPUs its
  // sim worker needs too, so a second page on the runner halves the first one's frames and its sim's
  // share: waits double, and a real-time run falls behind its sim. One worker costs a little time.
  ...(process.env['CI'] ? { workers: 1 } : {}),
  webServer: { command: 'npx vite --port 5179 --strictPort', port: 5179 },
  use: { baseURL: 'http://localhost:5179', trace: 'off' },
  projects: [
    // The whole-year runs (Part 1, and Part 2 from the bridge) play in real time at ?fast=10, so they
    // run after the rest, on their own: under the full suite's load a slow page falls behind the sim
    // and misses a chapter's turn.
    { name: 'e2e', testDir: 'tests/e2e', testIgnore: YEAR, use: e2eChromium },
    {
      name: 'e2e-year',
      testDir: 'tests/e2e',
      testMatch: YEAR,
      use: e2eChromium,
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
