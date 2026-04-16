"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)('full dashboard-v2 light mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin/dashboard-v2');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/dashboard-v2-light.png', fullPage: true });
});
(0, test_1.test)('full dashboard-v2 dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin/dashboard-v2');
    await page.waitForLoadState('domcontentloaded');
    // Click theme toggle button
    const themeToggle = page.locator('button[aria-label="Toggle theme"], [data-testid="theme-toggle"]').first();
    if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(500);
    }
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/dashboard-v2-dark.png', fullPage: true });
});
//# sourceMappingURL=dashboard-v2-full.spec.js.map