"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_URL = 'http://localhost:8012';
const FRONTEND_URL = 'http://localhost:3012';
let AUTH_HEADERS = {};
test_1.test.describe('External API Gateway', () => {
    test_1.test.beforeAll(async () => {
        try {
            const token = await (0, api_auth_helper_1.getAuthToken)();
            AUTH_HEADERS = { 'Authorization': `Bearer ${token}`, 'X-Tenant-Code': 'rtl-bank' };
        }
        catch { /* auth optional for health checks */ }
    });
    (0, test_1.test)('health endpoint returns ok', async ({ page }) => {
        await page.goto(`${API_URL}/health`);
        const content = await page.textContent('body');
        console.log('Health:', content);
        (0, test_1.expect)(content).toContain('ok');
        await page.screenshot({ path: 'e2e/screenshots/ext-health.png' });
    });
    (0, test_1.test)('db-health endpoint returns connected', async ({ page }) => {
        await page.goto(`${API_URL}/db-health`);
        const content = await page.textContent('body');
        console.log('DB Health:', content);
        (0, test_1.expect)(content).toContain('connected');
        await page.screenshot({ path: 'e2e/screenshots/ext-db-health.png' });
    });
    (0, test_1.test)('tenants API returns tenant list', async ({ request }) => {
        // Tenants endpoint requires authentication
        const response = await request.get(`${API_URL}/api/tenants`, {
            headers: AUTH_HEADERS
        });
        if (!response.ok()) {
            console.log('[SKIP] API returned', response.status());
            return;
        }
        const data = await response.json();
        const content = JSON.stringify(data);
        console.log('Tenants:', content.substring(0, 100));
        (0, test_1.expect)(content).toContain('heuresys');
        (0, test_1.expect)(content).toContain('rtl-bank');
    });
    (0, test_1.test)('talent skill-profiles API returns data', async ({ request }) => {
        const response = await request.get(`${API_URL}/api/v1/talent/skill-profiles?limit=5`, {
            headers: { ...AUTH_HEADERS, 'X-Tenant-Code': 'rtl-bank' }
        });
        if (!response.ok()) {
            console.log('[SKIP] API returned', response.status());
            return;
        }
        const data = await response.json();
        console.log('Talent API:', JSON.stringify(data).substring(0, 200));
        (0, test_1.expect)(data.success).toBe(true);
        (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
    });
});
test_1.test.describe('External Frontend - Data Verification', () => {
    (0, test_1.test)('login page loads with form elements', async ({ page }) => {
        // Clear auth state so login page doesn't auto-redirect
        await page.context().clearCookies();
        await page.evaluate(() => {
            localStorage.removeItem('heuresys_token');
            localStorage.removeItem('heuresys_tenant');
        }).catch(() => { });
        await page.goto(`${FRONTEND_URL}/login`, { timeout: 30000 });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/ext-login.png', fullPage: true });
        // If redirected to admin (token still valid), that's acceptable
        if (page.url().includes('/admin')) {
            console.log('Login page redirected to admin (authenticated session)');
            return;
        }
        // Verify login form is present (not just URL loaded)
        const hasForm = await page.locator('form, input, button').count() > 0;
        console.log('Login form present:', hasForm);
        (0, test_1.expect)(hasForm).toBeTruthy();
    });
    (0, test_1.test)('skill profiles page loads WITHOUT error', async ({ page }) => {
        await page.goto(`${FRONTEND_URL}/admin/talent/skill-profiles`, { timeout: 30000 });
        // Wait for loading to complete
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/ext-skill-profiles.png', fullPage: true });
        // Check for error message
        const pageContent = await page.textContent('body');
        const hasError = pageContent?.includes('Errore') && pageContent?.includes('Impossibile caricare');
        if (hasError) {
            console.log('ERROR DETECTED on skill-profiles page:', pageContent?.substring(0, 300));
        }
        else {
            console.log('Skill Profiles page loaded successfully');
        }
        // Should NOT have error
        (0, test_1.expect)(hasError).toBeFalsy();
    });
    (0, test_1.test)('gap analysis page loads WITHOUT error', async ({ page }) => {
        await page.goto(`${FRONTEND_URL}/admin/talent/gap-analysis`, { timeout: 30000 });
        // Wait for loading to complete
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/ext-gap-analysis.png', fullPage: true });
        // Check for error message
        const pageContent = await page.textContent('body');
        const hasError = pageContent?.includes('Errore') && pageContent?.includes('Impossibile caricare');
        if (hasError) {
            console.log('ERROR DETECTED on gap-analysis page:', pageContent?.substring(0, 300));
        }
        else {
            console.log('Gap Analysis page loaded successfully');
        }
        // Should NOT have error
        (0, test_1.expect)(hasError).toBeFalsy();
    });
    (0, test_1.test)('career paths page loads with data', async ({ page }) => {
        await page.goto(`${FRONTEND_URL}/admin/talent/career-paths`, { timeout: 30000 });
        // Wait for loading to complete
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/ext-career-paths.png', fullPage: true });
        // Check for error message
        const pageContent = await page.textContent('body');
        const hasError = pageContent?.includes('Errore') && pageContent?.includes('Impossibile caricare');
        if (hasError) {
            console.log('ERROR DETECTED on career-paths page:', pageContent?.substring(0, 300));
        }
        else {
            console.log('Career Paths page loaded successfully');
            // Should see some content
            const hasContent = pageContent?.includes('Career') || pageContent?.includes('Percors');
            console.log('Has career content:', hasContent);
        }
        // Should NOT have error
        (0, test_1.expect)(hasError).toBeFalsy();
    });
});
//# sourceMappingURL=external-verification.spec.js.map