"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
(0, test_1.test)('screenshot dashboard-v2', async ({ page }) => {
    await page.goto('/admin/dashboard-v2');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/dashboard-v2-auth.png', fullPage: true });
});
//# sourceMappingURL=view-dashboard-v2.spec.js.map