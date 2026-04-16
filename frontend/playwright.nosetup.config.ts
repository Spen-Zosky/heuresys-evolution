import { defineConfig, devices } from '@playwright/test'

/**
 * Config temporanea per test senza re-auth.
 * Usa il token salvato in .auth/admin.json (aggiornato via API diretta).
 */
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-nosetup', open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3012',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  timeout: 60000,
  expect: { timeout: 10000 },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
        storageState: './.auth/admin.json',
      },
      testIgnore: [/auth\.setup\.ts/],
    },
  ],

  outputDir: 'test-results/',
})
