"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAsSysadmin = loginAsSysadmin;
const test_1 = require("@playwright/test");
async function loginAsSysadmin(page) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    // If already logged in, the login page redirects to /admin
    const currentUrl = page.url();
    if (currentUrl.includes('/admin')) {
        return; // Already logged in
    }
    const usernameField = page.locator('#username');
    const isLoginPage = await usernameField.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isLoginPage) {
        // Might have been redirected, check URL again
        if (page.url().includes('/admin'))
            return;
        // Force navigate
        await page.goto('/login', { waitUntil: 'networkidle' });
    }
    await usernameField.waitFor({ state: 'visible', timeout: 15000 });
    await usernameField.click();
    await usernameField.fill('sysadmin');
    const passwordField = page.locator('#password');
    await passwordField.click();
    await passwordField.fill('Admin2026');
    await (0, test_1.expect)(usernameField).toHaveValue('sysadmin', { timeout: 5000 });
    await (0, test_1.expect)(passwordField).toHaveValue('Admin2026', { timeout: 5000 });
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin**', { timeout: 45000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
}
//# sourceMappingURL=login-helper.js.map