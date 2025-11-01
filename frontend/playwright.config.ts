import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 3217);
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true }, grep: /@mobile/ },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `PORT=${PORT} ./scripts/start-standalone.sh`, url: `${baseURL}/api/health`, reuseExistingServer: false, timeout: 60_000 },
});
