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
  projects: [{ name: 'e2e', testDir: 'tests/e2e', use: chromium }],
});
