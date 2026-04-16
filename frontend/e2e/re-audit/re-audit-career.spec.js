"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const API_URL = 'http://localhost:8012';
// Login via API and inject token into localStorage (avoids UI rate limiting)
async function loginViaAPI(page) {
    const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
        data: { username: 'sysadmin', password: 'Admin2026' }
    });
    const body = await response.json();
    const token = body.data?.accessToken;
    if (!token)
        throw new Error('Failed to get auth token');
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
        localStorage.setItem('heuresys_token', t);
        localStorage.setItem('heuresys_tenant', 'rtl-bank');
    }, token);
}
test_1.test.describe('Career Re-Audit', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await loginViaAPI(page);
    });
    (0, test_1.test)('BUG-040/117: /admin/career/chat — chat works (no 404)', async ({ page }) => {
        await page.goto('/admin/career/chat');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(4000);
        const has404 = await page.locator('text=404').count() > 0;
        const hasNotFound = await page.locator('text=non trovato').count() > 0 ||
            await page.locator('text=Not Found').count() > 0;
        const hasError = await page.locator('text=Errore').count() > 0;
        const pageContent = await page.textContent('body') || '';
        const hasChatInput = await page.locator('input[type="text"], textarea, [contenteditable="true"]').count() > 0;
        const hasChatContent = pageContent.toLowerCase().includes('chat') ||
            pageContent.toLowerCase().includes('coach') ||
            pageContent.toLowerCase().includes('messag') ||
            pageContent.toLowerCase().includes('carriera');
        const hasAPIError = pageContent.includes('ERR-API') || pageContent.includes('500') || pageContent.includes('501');
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-040-117-career-chat.png', fullPage: true });
        console.log(`BUG-040/117: 404=${has404}, notFound=${hasNotFound}, error=${hasError}, chatInput=${hasChatInput}, chatContent=${hasChatContent}, apiError=${hasAPIError}`);
        console.log(`BUG-040/117: ${has404 || hasNotFound ? 'FAIL-404' : hasChatInput ? 'PASS-HAS-INPUT' : hasChatContent ? 'PARTIAL-NO-INPUT' : 'NEEDS-REVIEW'}`);
    });
    (0, test_1.test)('BUG-116: /admin/career — "+12%" replaced with N/D or computed', async ({ page }) => {
        await page.goto('/admin/career');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(5000);
        const pageContent = await page.textContent('body') || '';
        const has12Percent = pageContent.includes('+12%');
        const hasHardcodedPercent = pageContent.includes('+15%') || pageContent.includes('+8%') || pageContent.includes('+23%');
        const hasND = pageContent.includes('N/D') || pageContent.includes('N/A');
        const kpiCount = await page.locator('[class*="card"]').count();
        const hasError = await page.locator('text=Errore').count() > 0;
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-116-career-kpi.png', fullPage: true });
        console.log(`BUG-116: has12Percent=${has12Percent}, hardcodedPercent=${hasHardcodedPercent}, hasND=${hasND}, kpiCards=${kpiCount}, error=${hasError}`);
        console.log(`BUG-116: ${has12Percent ? 'FAIL-HARDCODED-12' : hasHardcodedPercent ? 'SUSPECT-HARDCODED' : 'PASS-NO-HARDCODED'}`);
    });
    (0, test_1.test)('BUG-119: /admin/career/learning — data not hardcoded', async ({ page }) => {
        await page.goto('/admin/career/learning');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(4000);
        const hasError = await page.locator('text=Errore').count() > 0 ||
            await page.locator('text=404').count() > 0;
        const pageContent = await page.textContent('body') || '';
        const hasLearningContent = pageContent.toLowerCase().includes('cors') ||
            pageContent.toLowerCase().includes('course') ||
            pageContent.toLowerCase().includes('formazione') ||
            pageContent.toLowerCase().includes('learning');
        const tableRows = await page.locator('table tbody tr').count();
        const cardCount = await page.locator('[class*="card"]').count();
        const hasData = tableRows > 0 || cardCount > 2;
        const hasSuspiciousData = pageContent.includes('Lorem') || pageContent.includes('Example') || pageContent.includes('Test Course');
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-119-career-learning.png', fullPage: true });
        console.log(`BUG-119: error=${hasError}, learningContent=${hasLearningContent}, tableRows=${tableRows}, cards=${cardCount}, suspicious=${hasSuspiciousData}`);
        console.log(`BUG-119: ${hasError ? 'FAIL-ERROR' : hasData && hasLearningContent ? 'PASS' : hasLearningContent ? 'LOADED-NO-DATA' : 'NEEDS-REVIEW'}`);
    });
    (0, test_1.test)('BUG-121: /admin/career/mentors — data not hardcoded', async ({ page }) => {
        await page.goto('/admin/career/mentors');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(4000);
        const hasError = await page.locator('text=Errore').count() > 0 ||
            await page.locator('text=404').count() > 0;
        const pageContent = await page.textContent('body') || '';
        const hasMentorContent = pageContent.toLowerCase().includes('mentor') ||
            pageContent.toLowerCase().includes('tutor') ||
            pageContent.toLowerCase().includes('program');
        const tableRows = await page.locator('table tbody tr').count();
        const cardCount = await page.locator('[class*="card"]').count();
        const listItems = await page.locator('[role="list"] [role="listitem"], ul li').count();
        const hasSuspicious = pageContent.includes('John Doe') || pageContent.includes('Jane Smith') ||
            pageContent.includes('Lorem') || pageContent.includes('Example');
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-121-career-mentors.png', fullPage: true });
        console.log(`BUG-121: error=${hasError}, mentorContent=${hasMentorContent}, tableRows=${tableRows}, cards=${cardCount}, list=${listItems}, suspicious=${hasSuspicious}`);
        console.log(`BUG-121: ${hasError ? 'FAIL-ERROR' : hasMentorContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
    });
    (0, test_1.test)('BUG-122: /admin/career/paths — visualization from API', async ({ page }) => {
        await page.goto('/admin/career/paths');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(4000);
        const hasError = await page.locator('text=Errore').count() > 0 ||
            await page.locator('text=404').count() > 0;
        const pageContent = await page.textContent('body') || '';
        const hasPathContent = pageContent.toLowerCase().includes('percors') ||
            pageContent.toLowerCase().includes('path') ||
            pageContent.toLowerCase().includes('carriera') ||
            pageContent.toLowerCase().includes('career');
        const hasBankingTrack = pageContent.includes('Banking') || pageContent.includes('Operations Track');
        const hasSvg = await page.locator('svg').count() > 0;
        const cardCount = await page.locator('[class*="card"]').count();
        const hasTable = await page.locator('table').count() > 0;
        const hasMockData = pageContent.includes('Example Path') || pageContent.includes('Sample') || pageContent.includes('Lorem');
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-122-career-paths.png', fullPage: true });
        console.log(`BUG-122: error=${hasError}, pathContent=${hasPathContent}, bankingTrack=${hasBankingTrack}, svg=${hasSvg}, cards=${cardCount}, table=${hasTable}, mock=${hasMockData}`);
        console.log(`BUG-122: ${hasError ? 'FAIL-ERROR' : hasBankingTrack ? 'PASS-REAL-DATA' : hasPathContent ? 'LOADED-NO-API-DATA' : 'NEEDS-REVIEW'}`);
    });
    (0, test_1.test)('BUG-123: /admin/career/reports — analytics endpoints respond', async ({ page }) => {
        await page.goto('/admin/career/reports');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(4000);
        const has404 = await page.locator('text=404').count() > 0;
        const hasNotFound = await page.locator('text=non trovato').count() > 0;
        const hasError = await page.locator('text=Errore').count() > 0;
        const pageContent = await page.textContent('body') || '';
        const hasReportContent = pageContent.toLowerCase().includes('report') ||
            pageContent.toLowerCase().includes('analitic') ||
            pageContent.toLowerCase().includes('statistic') ||
            pageContent.toLowerCase().includes('riepilog');
        const hasSvg = await page.locator('svg').count() > 0;
        const cardCount = await page.locator('[class*="card"]').count();
        const hasData = /\d{2,}/.test(pageContent);
        const hasEmptyState = pageContent.toLowerCase().includes('nessun') || pageContent.toLowerCase().includes('no data');
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-123-career-reports.png', fullPage: true });
        console.log(`BUG-123: 404=${has404}, notFound=${hasNotFound}, error=${hasError}, reportContent=${hasReportContent}, svg=${hasSvg}, cards=${cardCount}, data=${hasData}, empty=${hasEmptyState}`);
        console.log(`BUG-123: ${has404 || hasNotFound ? 'FAIL-404' : hasReportContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
    });
});
//# sourceMappingURL=re-audit-career.spec.js.map