"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * Playwright Configuration for Heuresys Platform
 *
 * Projects:
 * - setup: Authenticates as sysadmin, saves session state
 * - chromium: Main tests that depend on authentication
 * - chromium-public: Tests for public pages (no auth required)
 */
exports.default = (0, test_1.defineConfig)({
    globalSetup: './e2e/global-setup.ts',
    testDir: './e2e',
    fullyParallel: false, // Run tests sequentially to avoid port conflicts
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Single worker for headless VM
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
    ],
    use: {
        baseURL: 'http://localhost:3012',
        trace: 'on-first-retry',
        screenshot: 'on',
        video: 'on',
        // Headless Chromium configuration
        headless: true,
        viewport: { width: 1280, height: 720 },
        // Longer timeouts for slow network/API calls
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    // Global timeout for each test
    timeout: 60000,
    // Expect configuration
    expect: {
        timeout: 10000,
    },
    projects: [
        // Authentication setup - runs first
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        // Authenticated tests (admin pages)
        {
            name: 'chromium',
            use: {
                ...test_1.devices['Desktop Chrome'],
                channel: undefined,
                // Use the authenticated state from setup
                storageState: './.auth/admin.json',
            },
            dependencies: ['setup'],
            testIgnore: [/auth\.setup\.ts/, /public\.spec\.ts/],
        },
        // Public page tests (no auth required)
        {
            name: 'chromium-public',
            use: {
                ...test_1.devices['Desktop Chrome'],
                channel: undefined,
                // No storageState - these are unauthenticated tests
            },
            testMatch: /public\.spec\.ts/,
        },
    ],
    // Output directories
    outputDir: 'test-results/',
    // Web server - assume it's already running externally
    // Start frontend with: npm run dev (or npm start for production)
    // The server should be at http://localhost:3012
});
//# sourceMappingURL=playwright.config.js.map