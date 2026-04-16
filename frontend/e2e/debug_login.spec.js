"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
test_1.test.skip('debug login', async ({ page }) => {
    const responses = [];
    page.on('response', r => {
        if (r.url().includes('8012') || r.url().includes('auth')) {
            responses.push({ status: r.status(), url: r.url() });
        }
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.fill('#username', 'rtl-admin');
    await page.fill('#password', 'Admin2026');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    console.log('URL after login:', page.url());
    console.log('API responses:', JSON.stringify(responses, null, 2));
});
//# sourceMappingURL=debug_login.spec.js.map