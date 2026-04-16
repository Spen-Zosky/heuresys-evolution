"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
test_1.test.describe('Debug API calls', () => {
    (0, test_1.test)('debug network requests', async ({ page }) => {
        // Capture all network requests and responses
        const apiCalls = [];
        page.on('request', request => {
            if (request.url().includes('8012') || request.url().includes('8011') || request.url().includes('api')) {
                console.log('Request:', request.method(), request.url());
            }
        });
        page.on('response', response => {
            if (response.url().includes('8012') || response.url().includes('8011') || response.url().includes('api')) {
                console.log('Response:', response.status(), response.url());
                apiCalls.push({ url: response.url(), status: response.status() });
            }
        });
        page.on('requestfailed', request => {
            console.log('FAILED:', request.url(), request.failure()?.errorText);
            apiCalls.push({ url: request.url(), status: 0, error: request.failure()?.errorText });
        });
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('fetch') || msg.text().includes('API')) {
                console.log('Console:', msg.type(), msg.text());
            }
        });
        // Go to dashboard
        await page.goto('/admin', { waitUntil: 'domcontentloaded' });
        // Wait for potential API calls
        await page.waitForLoadState('networkidle');
        // Log all captured API calls
        console.log('\n=== API CALLS SUMMARY ===');
        for (const call of apiCalls) {
            console.log(JSON.stringify(call));
        }
        // Take screenshot
        await page.screenshot({ path: 'test-results/debug-api.png', fullPage: true });
        // Log page content for debugging
        const pageContent = await page.content();
        console.log('\n=== PAGE contains error? ===', pageContent.includes('Errore'));
    });
});
//# sourceMappingURL=debug-api.spec.js.map