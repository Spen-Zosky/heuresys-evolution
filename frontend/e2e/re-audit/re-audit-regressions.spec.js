"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const login_helper_1 = require("./login-helper");
const SCREENSHOTS = 'e2e/re-audit/screenshots';
test_1.test.describe('Re-Audit Regressions', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await (0, login_helper_1.loginAsSysadmin)(page);
    });
    (0, test_1.test)('Regression: Compensation section loads (was 8.3/10)', async ({ page }) => {
        await page.goto('/admin/compensation');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/regression-compensation.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasContent = await page.locator('h1, h2, table, [role="table"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        for (const subPage of ['/admin/compensation/bands', '/admin/compensation/benefits']) {
            await page.goto(subPage);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
            const sub404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
            const subContent = await page.locator('h1, h2, table').first().isVisible().catch(() => false);
            const pageName = subPage.split('/').pop();
            console.log(`Regression-Compensation: ${pageName} 404=${sub404}, Content=${subContent}`);
            await page.screenshot({ path: `${SCREENSHOTS}/regression-compensation-${pageName}.png`, fullPage: true });
        }
        console.log(`Regression-Compensation: Main 404=${is404}, Content=${hasContent}, Error=${hasError}`);
    });
    (0, test_1.test)('Regression: Recruiting section loads (was 8.2/10)', async ({ page }) => {
        await page.goto('/admin/recruiting');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/regression-recruiting.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasContent = await page.locator('h1, h2, table, [role="table"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        for (const subPage of ['/admin/recruiting/job-postings', '/admin/recruiting/candidates']) {
            await page.goto(subPage);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
            const sub404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
            const subContent = await page.locator('h1, h2, table').first().isVisible().catch(() => false);
            const pageName = subPage.split('/').pop();
            console.log(`Regression-Recruiting: ${pageName} 404=${sub404}, Content=${subContent}`);
            await page.screenshot({ path: `${SCREENSHOTS}/regression-recruiting-${pageName}.png`, fullPage: true });
        }
        console.log(`Regression-Recruiting: Main 404=${is404}, Content=${hasContent}, Error=${hasError}`);
    });
    (0, test_1.test)('Regression: Admin Dashboard loads with data (was 8.0/10)', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SCREENSHOTS}/regression-dashboard.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasContent = await page.locator('h1, h2, [class*="card"], [class*="stat"], [class*="widget"]').first().isVisible().catch(() => false);
        const hasNumbers = await page.locator('text=/\\d+/').first().isVisible().catch(() => false);
        const hasCharts = await page.locator('canvas, svg, [class*="chart"], [class*="recharts"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        console.log(`Regression-Dashboard: 404=${is404}, Content=${hasContent}, Numbers=${hasNumbers}, Charts=${hasCharts}, Error=${hasError}`);
    });
    (0, test_1.test)('Regression: Compliance section loads (was 7.0/10)', async ({ page }) => {
        await page.goto('/admin/compliance');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/regression-compliance.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasContent = await page.locator('h1, h2, table, [role="table"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        console.log(`Regression-Compliance: 404=${is404}, Content=${hasContent}, Error=${hasError}`);
    });
    (0, test_1.test)('Regression: Engagement Wellbeing loads', async ({ page }) => {
        await page.goto('/admin/engagement/wellbeing');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/regression-wellbeing.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasContent = await page.locator('h1, h2, table, [class*="card"]').first().isVisible().catch(() => false);
        const hasError = await page.locator('text=/errore|error|impossibile|failed/i').first().isVisible().catch(() => false);
        if (is404) {
            await page.goto('/admin/engagement');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
            const altContent = await page.locator('h1, h2').first().isVisible().catch(() => false);
            console.log(`Regression-Wellbeing: /admin/engagement fallback content=${altContent}`);
            await page.screenshot({ path: `${SCREENSHOTS}/regression-wellbeing-alt.png`, fullPage: true });
        }
        console.log(`Regression-Wellbeing: 404=${is404}, Content=${hasContent}, Error=${hasError}`);
    });
});
//# sourceMappingURL=re-audit-regressions.spec.js.map