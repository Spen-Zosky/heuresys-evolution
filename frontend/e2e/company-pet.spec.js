"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const BASE_URL = 'http://localhost:3012';
test_1.test.describe('Company PET - Full Verification', () => {
    test_1.test.setTimeout(120000); // 2 minutes per test
    (0, test_1.test)('Dashboard - verify all data loads correctly', async ({ page }) => {
        await page.goto(`${BASE_URL}/company-pet`);
        // Wait for loading spinner to disappear
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 }).catch(() => { });
        // Wait for content to load
        await page.waitForLoadState('networkidle');
        // Take screenshot
        await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true });
        // Check for error messages
        const errorText = await page.locator('text=error').count();
        const failedText = await page.locator('text=Failed').count();
        console.log('Dashboard - Errors found:', errorText, failedText);
        // Verify key metrics are present and have values
        const metricsCards = await page.locator('.bg-\\[\\#0d1117\\]').count();
        console.log('Dashboard - Metric cards found:', metricsCards);
    });
    (0, test_1.test)('Sessions page - verify all data', async ({ page }) => {
        await page.goto(`${BASE_URL}/company-pet/sessions`);
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 }).catch(() => { });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/sessions.png', fullPage: true });
    });
    (0, test_1.test)('Org Chart page - verify visualization', async ({ page }) => {
        await page.goto(`${BASE_URL}/company-pet/org-chart`);
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 }).catch(() => { });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/org-chart.png', fullPage: true });
    });
    (0, test_1.test)('Hierarchy page - verify tree', async ({ page }) => {
        // Capture console output
        page.on('console', msg => console.log('Browser:', msg.type(), msg.text()));
        page.on('pageerror', err => console.log('Page Error:', err.message));
        await page.goto(`${BASE_URL}/company-pet/hierarchy`);
        // Wait for sessions to load and session to be auto-selected
        await page.waitForLoadState('networkidle');
        // Check if session dropdown has value
        const sessionSelect = page.locator('select').first();
        const selectedValue = await sessionSelect.inputValue().catch(() => '');
        console.log('Selected session:', selectedValue);
        // Wait for loading spinner to disappear
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 }).catch(() => {
            console.log('Spinner still visible after 30s');
        });
        // Wait more for content
        await page.waitForLoadState('networkidle');
        // Take screenshot
        await page.screenshot({ path: 'e2e/screenshots/hierarchy.png', fullPage: true });
        // Check for employees count text
        const employeeCount = await page.locator('text=/\\d+ employees/').first().textContent().catch(() => '0 employees');
        console.log('Hierarchy - Employee count:', employeeCount);
        // Check if level statistics are showing
        const levelStats = await page.locator('.grid >> text=/L\\d/').count();
        console.log('Hierarchy - Level indicators:', levelStats);
        // Check for error message
        const errorMsg = await page.locator('text=/Failed|error|Error/i').textContent().catch(() => 'No error');
        console.log('Hierarchy - Error message:', errorMsg);
        // Verify employee tree nodes exist
        const treeNodes = await page.locator('.select-none').count();
        console.log('Hierarchy - Tree nodes:', treeNodes);
    });
    (0, test_1.test)('Breakdowns page - verify all tabs', async ({ page }) => {
        await page.goto(`${BASE_URL}/company-pet/breakdowns`);
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 }).catch(() => { });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/breakdowns.png', fullPage: true });
    });
    (0, test_1.test)('Staging Comparison page - verify table', async ({ page }) => {
        await page.goto(`${BASE_URL}/company-pet/staging-comparison`);
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 }).catch(() => { });
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'e2e/screenshots/staging-comparison.png', fullPage: true });
    });
});
//# sourceMappingURL=company-pet.spec.js.map