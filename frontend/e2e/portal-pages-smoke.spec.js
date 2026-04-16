"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * Portal Pages Smoke E2E
 *
 * Data-driven smoke test that navigates to every portal route and verifies:
 * 1. The page loads without a server error (no 500, no red error overlay)
 * 2. The page renders visible content within the timeout
 *
 * Uses the authenticated admin session from auth.setup.ts (storageState).
 */
const PORTAL_ROUTES = [
    { path: '/portal', label: 'Portal Home' },
    { path: '/portal/profile', label: 'My Profile' },
    { path: '/portal/goals', label: 'Goals' },
    { path: '/portal/learning', label: 'Learning' },
    { path: '/portal/learning/catalog', label: 'Learning Catalog' },
    { path: '/portal/documents', label: 'Documents' },
    { path: '/portal/time-off', label: 'Time Off' },
    { path: '/portal/analytics', label: 'Analytics' },
    { path: '/portal/approvals', label: 'Approvals' },
    { path: '/portal/career', label: 'Career' },
    { path: '/portal/org-chart', label: 'Org Chart' },
    { path: '/portal/payroll', label: 'Payroll' },
    { path: '/portal/reviews', label: 'Reviews' },
    { path: '/portal/skills', label: 'Skills' },
    { path: '/portal/workspace/composer', label: 'Workspace Composer' },
];
test_1.test.describe('Portal Pages Smoke Tests', () => {
    for (const route of PORTAL_ROUTES) {
        (0, test_1.test)(`${route.label} (${route.path}) loads without error`, async ({ page }) => {
            const response = await page.goto(route.path, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            // Verify no server-side error (5xx)
            (0, test_1.expect)(response?.status()).toBeLessThan(500);
            // Wait for the page to settle — networkidle may time out on pages
            // with long-polling or SSE connections; only timeout errors are safe to ignore.
            await page.waitForLoadState('networkidle', { timeout: 20000 }).catch((err) => {
                if (!(err instanceof Error && err.message.includes('Timeout')))
                    throw err;
            });
            // Verify no React error overlay (Next.js error boundary).
            // Not all environments render [data-nextjs-dialog] — check count only if present.
            const errorOverlay = page.locator('[data-nextjs-dialog]');
            const overlayCount = await errorOverlay.count();
            (0, test_1.expect)(overlayCount, 'Next.js error overlay should not be visible').toBe(0);
            // Verify the page rendered something (not a blank white page)
            const bodyText = await page.locator('body').innerText();
            (0, test_1.expect)(bodyText.length).toBeGreaterThan(10);
            // Take screenshot for visual reference
            await page.screenshot({
                path: `test-results/portal-smoke-${route.path.replace(/\//g, '-').slice(1)}.png`,
                fullPage: false,
            });
        });
    }
});
//# sourceMappingURL=portal-pages-smoke.spec.js.map