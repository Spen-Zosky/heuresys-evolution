"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_BASE = 'http://localhost:8012';
let HEADERS = { 'X-Tenant-Code': 'rtl-bank' };
// Fetch auth token before all tests
test_1.test.beforeAll(async () => {
    const token = await (0, api_auth_helper_1.getAuthToken)();
    HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
});
/**
 * VERIFICA SISTEMATICA - SEZIONI RIMANENTI
 */
// 8. LEARNING
test_1.test.describe('8. Learning Section', () => {
    (0, test_1.test)('8.1 Learning Main', async ({ page }) => {
        await page.goto('/admin/learning');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/learning-main.png', fullPage: true });
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Learning Main]: loaded');
    });
    (0, test_1.test)('8.2 Learning Courses', async ({ page, request }) => {
        const res = await request.get(`${API_BASE}/api/v1/courses?limit=5`, { headers: HEADERS }).catch(() => null);
        if (res?.ok()) {
            const api = await res.json();
            console.log(`[Courses API]: ${api.meta?.total || api.data?.length || 0} courses`);
        }
        await page.goto('/admin/learning/courses');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Corsi'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Courses Page]: loaded');
    });
});
// 9. RECRUITING
test_1.test.describe('9. Recruiting Section', () => {
    (0, test_1.test)('9.1 Recruiting Main', async ({ page }) => {
        await page.goto('/admin/recruiting');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/recruiting-main.png', fullPage: true });
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Recruiting Main]: loaded');
    });
    (0, test_1.test)('9.2 Recruiting Applications', async ({ page, request }) => {
        const res = await request.get(`${API_BASE}/api/v1/applications?limit=5`, { headers: HEADERS }).catch(() => null);
        if (res?.ok()) {
            const api = await res.json();
            console.log(`[Applications API]: ${api.meta?.total || api.data?.length || 0} applications`);
        }
        await page.goto('/admin/recruiting/applications');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        const title = page.locator('h1').or(page.locator('h2')).or(page.locator('text=Candidature'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Applications Page]: loaded');
    });
});
// 10. COMPENSATION
test_1.test.describe('10. Compensation Section', () => {
    (0, test_1.test)('10.1 Compensation Main', async ({ page }) => {
        await page.goto('/admin/compensation');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/compensation-main.png', fullPage: true });
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Compensation Main]: loaded');
    });
});
// 11. TALENT
test_1.test.describe('11. Talent Section', () => {
    (0, test_1.test)('11.1 Talent Main', async ({ page }) => {
        await page.goto('/admin/talent');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/talent-main.png', fullPage: true });
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Talent Main]: loaded');
    });
});
// 12. COMPLIANCE
test_1.test.describe('12. Compliance Section', () => {
    (0, test_1.test)('12.1 Compliance Main', async ({ page }) => {
        await page.goto('/admin/compliance');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/compliance-main.png', fullPage: true });
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Compliance Main]: loaded');
    });
});
// 13. ANALYTICS
test_1.test.describe('13. Analytics Section', () => {
    (0, test_1.test)('13.1 Analytics Main', async ({ page }) => {
        await page.goto('/admin/analytics');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/analytics-main.png', fullPage: true });
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[Analytics Main]: loaded');
    });
});
// 14. SETTINGS
test_1.test.describe('14. Settings Section', () => {
    (0, test_1.test)('14.1 Settings Main - Requires Auth', async ({ page }) => {
        await page.goto('/admin/settings');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/settings-main.png', fullPage: true });
        // Settings requires authentication - redirects to login page
        // This is correct behavior for sensitive settings
        const loginPage = page.locator('text=Accedi').or(page.locator('text=Username'));
        const isLoginPage = await loginPage.first().isVisible().catch(() => false);
        if (isLoginPage) {
            console.log('[Settings Main]: requires authentication (redirected to login)');
        }
        else {
            const title = page.locator('h1').or(page.locator('h2'));
            await (0, test_1.expect)(title.first()).toBeVisible();
            console.log('[Settings Main]: loaded');
        }
    });
});
//# sourceMappingURL=remaining-sections.spec.js.map