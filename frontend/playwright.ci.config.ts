import { defineConfig, devices } from '@playwright/test';

/**
 * CI-specific Playwright configuration
 * Runs only smoke tests for faster CI feedback
 * Full test suite should be run locally or in nightly builds
 */
export default defineConfig({
  testDir: './e2e',
  // Only run API/infrastructure smoke tests in CI
  // Dashboard UI tests skipped until Sprint 3 completes dashboard v2
  testMatch: [
    '**/external-verification.spec.ts', // API health, DB, tenants, login form
  ],
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 2,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:3012',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: undefined, // Services started separately in CI
});
