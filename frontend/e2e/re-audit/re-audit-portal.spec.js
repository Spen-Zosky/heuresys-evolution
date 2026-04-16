"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const login_helper_1 = require("./login-helper");
const SCREENSHOTS = 'e2e/re-audit/screenshots';
test_1.test.describe('Re-Audit Portal', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await (0, login_helper_1.loginAsSysadmin)(page);
    });
    (0, test_1.test)('BUG-133: payroll page loads', async ({ page }) => {
        const paths = ['/portal/payroll', '/admin/portal/payroll', '/admin/payroll'];
        let finalUrl = '';
        let is404 = true;
        for (const path of paths) {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            finalUrl = page.url();
            is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
            if (!is404 && !finalUrl.includes('/login'))
                break;
        }
        await page.screenshot({ path: `${SCREENSHOTS}/bug133-payroll.png`, fullPage: true });
        const hasContent = await page.locator('h1, h2, table, [role="table"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        console.log(`BUG-133: Final URL=${finalUrl}, Page 404=${is404}, Content=${hasContent}, Error=${hasError}`);
    });
    (0, test_1.test)('BUG-134: documents page loads', async ({ page }) => {
        const paths = ['/portal/documents', '/admin/portal/documents', '/admin/documents'];
        let finalUrl = '';
        let is404 = true;
        for (const path of paths) {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            finalUrl = page.url();
            is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
            if (!is404 && !finalUrl.includes('/login'))
                break;
        }
        await page.screenshot({ path: `${SCREENSHOTS}/bug134-documents.png`, fullPage: true });
        const hasContent = await page.locator('h1, h2, table, [role="table"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        console.log(`BUG-134: Final URL=${finalUrl}, Page 404=${is404}, Content=${hasContent}, Error=${hasError}`);
    });
});
//# sourceMappingURL=re-audit-portal.spec.js.map