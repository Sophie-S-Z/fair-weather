import { defineConfig, devices } from '@playwright/test';

// The offline test runs over the production build: `npm run build` first, then `npm run test:offline`. PW_CHROMIUM_PATH points at the
// preinstalled Chromium in the cloud container (ADR 0008).
const executablePath = process.env['PW_CHROMIUM_PATH'];

export default defineConfig({
  webServer: { command: 'npx vite preview --port 5180 --strictPort', port: 5180 },
  use: { baseURL: 'http://localhost:5180', trace: 'off' },
  projects: [
    {
      name: 'offline',
      testDir: 'tests/offline',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
});
