import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against a running stack with the demo data seeded. They run one at a time:
 * each test signs in for itself, because refresh tokens rotate and a reused one ends the session.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'screenshots',
      testMatch: '**/*.capture.ts',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
    },
  ],
});
