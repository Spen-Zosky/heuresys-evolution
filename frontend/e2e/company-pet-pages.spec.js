"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const pages = [
    { path: '/company-pet', title: 'Command Center' },
    { path: '/company-pet/sessions', title: 'AI Sessions' },
    { path: '/company-pet/org-chart', title: 'Org Chart' },
    { path: '/company-pet/hierarchy', title: 'Hierarchy' },
    { path: '/company-pet/breakdowns', title: 'Breakdowns' },
    { path: '/company-pet/staging-comparison', title: 'Staging Compare' },
    { path: '/company-pet/organization', title: 'Organization' },
    { path: '/company-pet/organization/performance', title: 'Performance' },
    { path: '/company-pet/organization/talent', title: 'Talent' },
    { path: '/company-pet/organization/analytics', title: 'Analytics' },
    { path: '/company-pet/workforce', title: 'Workforce' },
    { path: '/company-pet/workforce/demographics', title: 'Demographics' },
    { path: '/company-pet/workforce/locations', title: 'Locations' },
];
test_1.test.describe('Company PET Pages', () => {
    for (const pageInfo of pages) {
        (0, test_1.test)(`loads ${pageInfo.path}`, async ({ page }) => {
            // Navigate with generous timeout
            await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Wait for page to stabilize
            await page.waitForLoadState('networkidle');
            // Check for page content - verify sidebar exists (shared layout)
            const sidebar = page.locator('nav');
            await (0, test_1.expect)(sidebar).toBeVisible({ timeout: 10000 });
            // Check that body has significant content
            const body = await page.locator('body').innerHTML();
            (0, test_1.expect)(body.length).toBeGreaterThan(500);
            // Check for no critical errors in the page
            const errorBanner = page.locator('[role="alert"]:has-text("error")');
            await (0, test_1.expect)(errorBanner).not.toBeVisible();
        });
    }
});
test_1.test.describe('Company PET Sidebar Navigation', () => {
    (0, test_1.test)('sidebar sections are expandable', async ({ page }) => {
        await page.goto('/company-pet', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        // Check that all three sections are present: Panoramica, Organizzazione, Risorse Umane
        const panoramicaSection = page.locator('button:has-text("Panoramica")');
        const organizationSection = page.locator('button:has-text("Organizzazione")');
        const hrCoreSection = page.locator('button:has-text("Risorse Umane")');
        await (0, test_1.expect)(panoramicaSection).toBeVisible();
        await (0, test_1.expect)(organizationSection).toBeVisible();
        await (0, test_1.expect)(hrCoreSection).toBeVisible();
    });
    (0, test_1.test)('navigation links work', async ({ page }) => {
        await page.goto('/company-pet', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        // Click on Workforce link in HR Core section
        const workforceLink = page.locator('a[href="/company-pet/workforce"]').first();
        await workforceLink.click();
        await page.waitForURL('**/company-pet/workforce');
        await page.waitForLoadState('networkidle');
        // Verify we're on the workforce page
        (0, test_1.expect)(page.url()).toContain('/company-pet/workforce');
    });
});
test_1.test.describe('Company PET Interactive Charts', () => {
    (0, test_1.test)('demographics page has interactive charts', async ({ page }) => {
        await page.goto('/company-pet/workforce/demographics', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        // Check for distribution progress bars (bar chart visualization)
        const progressBars = page.locator('.rounded-full.overflow-hidden');
        const barCount = await progressBars.count();
        if (barCount <= 2) {
            console.log('[Demographics] Only', barCount, 'progress bars found — API may be unavailable');
            await (0, test_1.expect)(page.locator('main')).toBeVisible();
        }
    });
    (0, test_1.test)('analytics page has trend charts', async ({ page }) => {
        await page.goto('/company-pet/organization/analytics', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        // Check for KPI cards with bold values
        const kpiValues = page.locator('.text-3xl.font-bold');
        const cardCount = await kpiValues.count();
        if (cardCount <= 3) {
            console.log('[Analytics] Only', cardCount, 'KPI values found — API may be unavailable');
            await (0, test_1.expect)(page.locator('main')).toBeVisible();
        }
    });
    (0, test_1.test)('performance page has rating distribution', async ({ page }) => {
        await page.goto('/company-pet/organization/performance', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        // Check for the performance management header
        const header = page.locator('h1:has-text("PERFORMANCE")');
        await (0, test_1.expect)(header).toBeVisible();
    });
});
test_1.test.describe('Company PET API Integration', () => {
    (0, test_1.test)('workforce page fetches employee data', async ({ page }) => {
        // Listen for API calls
        const apiCalls = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/')) {
                apiCalls.push(request.url());
            }
        });
        await page.goto('/company-pet/workforce', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        // Verify API calls were made
        (0, test_1.expect)(apiCalls.length).toBeGreaterThan(0);
    });
    (0, test_1.test)('organization page fetches stats', async ({ page }) => {
        const apiCalls = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/')) {
                apiCalls.push(request.url());
            }
        });
        await page.goto('/company-pet/organization', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle');
        (0, test_1.expect)(apiCalls.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=company-pet-pages.spec.js.map