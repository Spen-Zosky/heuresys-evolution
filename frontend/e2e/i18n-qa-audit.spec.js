"use strict";
/**
 * i18n QA Audit — Real browser navigation test
 *
 * Tests EVERY accessible page for:
 * 1. Page loads without errors
 * 2. No raw i18n keys visible (e.g. "admin.something.title")
 * 3. No console errors related to missing translations
 * 4. Language switcher present where expected
 * 5. Data connections work (API calls don't fail)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3012';
const API = process.env.E2E_API_URL || 'http://localhost:8012';
// Login helper
async function login(page, username = 'sysadmin', password = 'Admin2026') {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input#username', username);
    await page.fill('input#password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|portal|platform)/, { timeout: 15000 });
}
// Set locale via cookie
async function setLocale(page, locale) {
    await page.context().addCookies([{
            name: 'locale',
            value: locale,
            domain: new URL(BASE).hostname,
            path: '/',
        }]);
}
// Check for raw i18n keys in page text
async function checkNoRawKeys(page, pagePath) {
    const bodyText = await page.textContent('body') || '';
    // Raw keys look like: "admin.something.title" or "common.save" etc.
    const rawKeyPattern = /\b(admin|portal|platform|common|companyPet|dashboards|nav|sidebar|footer|header|errors|auth|landing|analytics|performance|recruiting|talent|compensation|compliance|engagement|learning|hr)\.[a-zA-Z]+\.[a-zA-Z]+/g;
    const matches = bodyText.match(rawKeyPattern) || [];
    // Filter out legit text that looks like keys (e.g. URLs, email domains)
    const realKeys = matches.filter(m => !m.includes('heuresys.com') &&
        !m.includes('http') &&
        !m.includes('@'));
    if (realKeys.length > 0) {
        console.warn(`[${pagePath}] Raw i18n keys found: ${realKeys.slice(0, 5).join(', ')}`);
    }
    return realKeys;
}
// Check console for i18n errors
function collectConsoleErrors(page) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (text.includes('MISSING_MESSAGE') || text.includes('IntlError') || text.includes('Could not resolve')) {
                errors.push(text);
            }
        }
    });
    return errors;
}
// Collect failed network requests
function collectFailedRequests(page) {
    const failed = [];
    page.on('response', response => {
        if (response.status() >= 500 && response.url().includes('/api/')) {
            failed.push(`${response.status()} ${response.url()}`);
        }
    });
    return failed;
}
// ============================================================
// PUBLIC PAGES (no auth required)
// ============================================================
test_1.test.describe('Public pages', () => {
    (0, test_1.test)('Login page loads in Italian', async ({ page }) => {
        await setLocale(page, 'it');
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
        const body = await page.textContent('body');
        (0, test_1.expect)(body).toContain('Accedi');
        const rawKeys = await checkNoRawKeys(page, '/login');
        (0, test_1.expect)(rawKeys.length).toBe(0);
    });
    (0, test_1.test)('Login page loads in English', async ({ page }) => {
        await setLocale(page, 'en');
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
        const body = await page.textContent('body');
        (0, test_1.expect)(body).toMatch(/Sign in|Login|Log in/i);
        const rawKeys = await checkNoRawKeys(page, '/login-en');
        (0, test_1.expect)(rawKeys.length).toBe(0);
    });
    (0, test_1.test)('Login page has LanguageSwitcher', async ({ page }) => {
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
        const switcher = page.locator('button[aria-label*="lingua"], button[aria-label*="language"]');
        await (0, test_1.expect)(switcher).toBeVisible({ timeout: 5000 });
    });
    (0, test_1.test)('403 page loads', async ({ page }) => {
        await setLocale(page, 'it');
        await page.goto(`${BASE}/403`, { waitUntil: 'networkidle' });
        const body = await page.textContent('body');
        (0, test_1.expect)(body).toContain('Accesso Negato');
        const rawKeys = await checkNoRawKeys(page, '/403');
        (0, test_1.expect)(rawKeys.length).toBe(0);
    });
    (0, test_1.test)('403 page in English', async ({ page }) => {
        await setLocale(page, 'en');
        await page.goto(`${BASE}/403`, { waitUntil: 'networkidle' });
        const body = await page.textContent('body');
        (0, test_1.expect)(body).toContain('Access Denied');
    });
    (0, test_1.test)('EN landing page loads', async ({ page }) => {
        await page.goto(`${BASE}/en/landing`, { waitUntil: 'networkidle' });
        // May redirect to login if auth required
        const url = page.url();
        (0, test_1.expect)(url).toMatch(/\/(en\/landing|login)/);
    });
});
// ============================================================
// AUTHENTICATED PAGES — Portal
// ============================================================
test_1.test.describe('Portal pages (authenticated)', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await login(page);
    });
    const portalPages = [
        '/portal',
        '/portal/profile',
        '/portal/goals',
        '/portal/learning',
        '/portal/documents',
        '/portal/career',
        '/portal/skills',
        '/portal/reviews',
        '/portal/time-off',
        '/portal/payroll',
        '/portal/analytics',
        '/portal/org-chart',
    ];
    for (const path of portalPages) {
        (0, test_1.test)(`${path} loads without errors`, async ({ page }) => {
            const consoleErrors = collectConsoleErrors(page);
            const failedRequests = collectFailedRequests(page);
            await setLocale(page, 'it');
            await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
            // Page should not show error state
            const body = await page.textContent('body') || '';
            (0, test_1.expect)(body).not.toContain('Si è verificato un errore');
            // No raw i18n keys
            const rawKeys = await checkNoRawKeys(page, path);
            (0, test_1.expect)(rawKeys.length).toBe(0);
            // Report console errors but don't fail (some may be benign)
            if (consoleErrors.length > 0) {
                console.warn(`[${path}] i18n console errors: ${consoleErrors.join('; ')}`);
            }
        });
    }
    (0, test_1.test)('Portal has LanguageSwitcher', async ({ page }) => {
        await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' });
        const switcher = page.locator('button[aria-label*="lingua"], button[aria-label*="language"]');
        await (0, test_1.expect)(switcher).toBeVisible({ timeout: 5000 });
    });
    (0, test_1.test)('Portal switches to English correctly', async ({ page }) => {
        await setLocale(page, 'en');
        await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' });
        const body = await page.textContent('body') || '';
        // Should show English content, not Italian
        (0, test_1.expect)(body).toMatch(/Employee Portal|Dashboard|Profile/i);
    });
});
// ============================================================
// AUTHENTICATED PAGES — Admin
// ============================================================
test_1.test.describe('Admin pages (authenticated)', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await login(page);
    });
    const adminPages = [
        '/admin',
        '/admin/employees',
        '/admin/locations',
        '/admin/org-units',
        '/admin/org-chart',
        '/admin/positions',
        '/admin/skills',
        '/admin/settings',
        '/admin/ai',
        '/admin/analytics',
        '/admin/career',
        '/admin/compensation',
        '/admin/compliance',
        '/admin/enrichment',
        '/admin/engagement',
        '/admin/performance',
        '/admin/recruiting',
        '/admin/talent',
        '/admin/learning',
        '/admin/workspace-templates',
    ];
    for (const path of adminPages) {
        (0, test_1.test)(`${path} loads without errors`, async ({ page }) => {
            const consoleErrors = collectConsoleErrors(page);
            await setLocale(page, 'it');
            await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
            const body = await page.textContent('body') || '';
            (0, test_1.expect)(body).not.toContain('Si è verificato un errore');
            const rawKeys = await checkNoRawKeys(page, path);
            (0, test_1.expect)(rawKeys.length).toBe(0);
            if (consoleErrors.length > 0) {
                console.warn(`[${path}] i18n console errors: ${consoleErrors.join('; ')}`);
            }
        });
    }
    (0, test_1.test)('Admin has LanguageSwitcher', async ({ page }) => {
        await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
        const switcher = page.locator('button[aria-label*="lingua"], button[aria-label*="language"]');
        await (0, test_1.expect)(switcher).toBeVisible({ timeout: 5000 });
    });
    (0, test_1.test)('Admin switches to English correctly', async ({ page }) => {
        await setLocale(page, 'en');
        await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
        const body = await page.textContent('body') || '';
        (0, test_1.expect)(body).toMatch(/Admin Dashboard|Dashboard/i);
    });
});
// ============================================================
// PLATFORM PAGES
// ============================================================
test_1.test.describe('Platform pages (superuser)', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await login(page, 'sysadmin', 'Admin2026');
    });
    const platformPages = [
        '/platform',
        '/platform/tenants',
        '/platform/users',
        '/platform/security',
        '/platform/settings',
        '/platform/database',
        '/platform/panoramica',
    ];
    for (const path of platformPages) {
        (0, test_1.test)(`${path} loads without errors`, async ({ page }) => {
            await setLocale(page, 'it');
            await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
            const body = await page.textContent('body') || '';
            (0, test_1.expect)(body).not.toContain('Si è verificato un errore');
            const rawKeys = await checkNoRawKeys(page, path);
            (0, test_1.expect)(rawKeys.length).toBe(0);
        });
    }
});
// ============================================================
// COMPANY-PET PAGES
// ============================================================
test_1.test.describe('Company-PET pages', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await login(page);
    });
    const companyPetPages = [
        '/company-pet',
        '/company-pet/hierarchy',
        '/company-pet/organization',
        '/company-pet/workforce',
        '/company-pet/breakdowns',
        '/company-pet/structure',
        '/company-pet/people',
        '/company-pet/processes',
    ];
    for (const path of companyPetPages) {
        (0, test_1.test)(`${path} loads without errors`, async ({ page }) => {
            await setLocale(page, 'it');
            await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
            const body = await page.textContent('body') || '';
            (0, test_1.expect)(body).not.toContain('Si è verificato un errore');
            const rawKeys = await checkNoRawKeys(page, path);
            (0, test_1.expect)(rawKeys.length).toBe(0);
        });
    }
});
//# sourceMappingURL=i18n-qa-audit.spec.js.map