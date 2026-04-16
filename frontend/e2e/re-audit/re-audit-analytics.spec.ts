import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8012';

// Login via API and inject token into localStorage (avoids UI rate limiting)
async function loginViaAPI(page: any) {
  // Get token from API
  const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    data: { username: 'sysadmin', password: 'Admin2026' }
  });
  const body = await response.json();
  const token = body.data?.accessToken;
  if (!token) throw new Error('Failed to get auth token');

  // Navigate to app and inject token
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t: string) => {
    localStorage.setItem('heuresys_token', t);
    localStorage.setItem('heuresys_tenant', 'rtl-bank');
  }, token);
}

test.describe('Analytics Re-Audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('BUG-014: /admin/analytics — employeeChange and absenceRate not hardcoded 0', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const pageContent = await page.textContent('body') || '';

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0;

    const hasEmployeeChange = pageContent.includes('Variazione') || pageContent.includes('Turnover') ||
                              pageContent.includes('variazione') || pageContent.includes('turnover');
    const hasAbsenceRate = pageContent.includes('Assenz') || pageContent.includes('Absence') ||
                           pageContent.includes('assenza') || pageContent.includes('absence');

    const kpiCount = await page.locator('[class*="card"]').count();
    const hasND = pageContent.includes('N/D') || pageContent.includes('N/A') || pageContent.includes('n/d');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-014-analytics-kpi.png', fullPage: true });

    console.log(`BUG-014: error=${hasError}, kpiCards=${kpiCount}, employeeChange=${hasEmployeeChange}, absenceRate=${hasAbsenceRate}, hasND=${hasND}`);
    console.log(`BUG-014: ${hasError ? 'FAIL-ERROR' : kpiCount > 0 ? 'HAS-CARDS' : 'NO-CARDS'}`);
  });

  test('BUG-015: /admin/analytics — AI stat accuracy not hardcoded 87%', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const pageContent = await page.textContent('body') || '';
    const has87Percent = pageContent.includes('87%');
    const hasAIAccuracy = pageContent.toLowerCase().includes('accuratezza') ||
                          pageContent.toLowerCase().includes('accuracy') ||
                          pageContent.toLowerCase().includes('precisione');
    const hasAIStat = pageContent.toLowerCase().includes('ai') || pageContent.toLowerCase().includes('intelligenza');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-015-ai-stat.png', fullPage: true });

    console.log(`BUG-015: has87Percent=${has87Percent}, hasAIAccuracy=${hasAIAccuracy}, hasAIStat=${hasAIStat}`);
    console.log(`BUG-015: ${has87Percent ? 'FAIL-HARDCODED' : 'PASS-NO-87'}`);
  });

  test('BUG-016: /admin/analytics/workforce — charts show data', async ({ page }) => {
    await page.goto('/admin/analytics/workforce');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0;

    const hasSvg = await page.locator('svg').count() > 0;
    const hasCanvas = await page.locator('canvas').count() > 0;
    const hasChartElements = hasSvg || hasCanvas;

    const pageContent = await page.textContent('body') || '';
    const hasNumbers = /\d{2,}/.test(pageContent);
    const hasEmptyState = pageContent.toLowerCase().includes('nessun dato') || pageContent.toLowerCase().includes('no data');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-016-workforce-charts.png', fullPage: true });

    console.log(`BUG-016: error=${hasError}, charts=${hasChartElements}, svg=${hasSvg}, canvas=${hasCanvas}, numbers=${hasNumbers}, empty=${hasEmptyState}`);
    console.log(`BUG-016: ${hasError ? 'FAIL-ERROR' : hasChartElements && hasNumbers ? 'PASS' : hasEmptyState ? 'EMPTY-STATE' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-017: /admin/analytics/compensation — data not all zeros', async ({ page }) => {
    await page.goto('/admin/analytics/compensation');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0;

    const pageContent = await page.textContent('body') || '';
    const hasCurrencyValues = /[\d.,]+\s*(EUR|€)/.test(pageContent) || /€\s*[\d.,]+/.test(pageContent);
    const hasLargeNumbers = /\d{4,}/.test(pageContent);
    const zeroMatches = pageContent.match(/\b0\b/g);
    const zeroCount = zeroMatches ? zeroMatches.length : 0;
    const hasSvg = await page.locator('svg').count() > 0;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-017-compensation.png', fullPage: true });

    console.log(`BUG-017: error=${hasError}, currency=${hasCurrencyValues}, largeNums=${hasLargeNumbers}, zeroCount=${zeroCount}, svg=${hasSvg}`);
    console.log(`BUG-017: ${hasError ? 'FAIL-ERROR' : hasLargeNumbers ? 'PASS-HAS-DATA' : zeroCount > 5 ? 'FAIL-ALL-ZEROS' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-019: /admin/analytics/ai — loads without 404', async ({ page }) => {
    await page.goto('/admin/analytics/ai');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const has404 = await page.locator('text=404').count() > 0;
    const hasNotFound = await page.locator('text=non trovato').count() > 0 ||
                        await page.locator('text=Not Found').count() > 0;
    const hasError = await page.locator('text=Errore').count() > 0;

    const pageContent = await page.textContent('body') || '';
    const hasAIContent = pageContent.toLowerCase().includes('ai') ||
                         pageContent.toLowerCase().includes('intelligenza') ||
                         pageContent.toLowerCase().includes('query') ||
                         pageContent.toLowerCase().includes('analytics');
    const hasEmptyState = pageContent.toLowerCase().includes('nessun') || pageContent.toLowerCase().includes('no data');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-019-analytics-ai.png', fullPage: true });

    console.log(`BUG-019: 404=${has404}, notFound=${hasNotFound}, error=${hasError}, aiContent=${hasAIContent}, empty=${hasEmptyState}`);
    console.log(`BUG-019: ${has404 || hasNotFound ? 'FAIL-404' : hasAIContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-020: /admin/analytics/predictions — endpoint responds', async ({ page }) => {
    await page.goto('/admin/analytics/predictions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const has404 = await page.locator('text=404').count() > 0;
    const hasNotFound = await page.locator('text=non trovato').count() > 0;
    const hasError = await page.locator('text=Errore').count() > 0;

    const pageContent = await page.textContent('body') || '';
    const hasPredictionContent = pageContent.toLowerCase().includes('prediz') ||
                                  pageContent.toLowerCase().includes('prediction') ||
                                  pageContent.toLowerCase().includes('turnover') ||
                                  pageContent.toLowerCase().includes('rischio') ||
                                  pageContent.toLowerCase().includes('risk');
    const hasData = /\d{2,}/.test(pageContent);

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-020-predictions.png', fullPage: true });

    console.log(`BUG-020: 404=${has404}, notFound=${hasNotFound}, error=${hasError}, predContent=${hasPredictionContent}, hasData=${hasData}`);
    console.log(`BUG-020: ${has404 || hasNotFound ? 'FAIL-404' : hasPredictionContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-021: /admin/analytics/hr-intelligence — loads', async ({ page }) => {
    await page.goto('/admin/analytics/hr-intelligence');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const has404 = await page.locator('text=404').count() > 0;
    const hasNotFound = await page.locator('text=non trovato').count() > 0 ||
                        await page.locator('text=Not Found').count() > 0;
    const hasError = await page.locator('text=Errore').count() > 0;

    const pageContent = await page.textContent('body') || '';
    const hasHRContent = pageContent.toLowerCase().includes('hr') ||
                         pageContent.toLowerCase().includes('intelligence') ||
                         pageContent.toLowerCase().includes('competenz') ||
                         pageContent.toLowerCase().includes('skill') ||
                         pageContent.toLowerCase().includes('occupaz');
    const hasEmptyState = pageContent.toLowerCase().includes('nessun') || pageContent.toLowerCase().includes('no data');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-021-hr-intelligence.png', fullPage: true });

    console.log(`BUG-021: 404=${has404}, notFound=${hasNotFound}, error=${hasError}, hrContent=${hasHRContent}, empty=${hasEmptyState}`);
    console.log(`BUG-021: ${has404 || hasNotFound ? 'FAIL-404' : hasHRContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
  });
});
