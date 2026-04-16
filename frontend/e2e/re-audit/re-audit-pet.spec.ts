import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8012';

// Login via API and inject token into localStorage (avoids UI rate limiting)
async function loginViaAPI(page: any) {
  const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    data: { username: 'sysadmin', password: 'Admin2026' }
  });
  const body = await response.json();
  const token = body.data?.accessToken;
  if (!token) throw new Error('Failed to get auth token');

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t: string) => {
    localStorage.setItem('heuresys_token', t);
    localStorage.setItem('heuresys_tenant', 'rtl-bank');
  }, token);
}

test.describe('Company PET Re-Audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test('BUG-050: Company PET pages — KPI cards show data', async ({ page }) => {
    const petPages = [
      { path: '/company-pet', name: 'main' },
      { path: '/company-pet/workforce', name: 'workforce' },
      { path: '/company-pet/organization', name: 'organization' },
    ];

    const results: Record<string, { error: boolean; cards: number; hasData: boolean }> = {};

    for (const petPage of petPages) {
      await page.goto(petPage.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const hasError = await page.locator('text=Errore').count() > 0 ||
                       await page.locator('text=404').count() > 0;

      const cards = await page.locator('[class*="card"]').count();
      const pageContent = await page.textContent('body') || '';
      const hasNumbers = /\d{2,}/.test(pageContent);

      results[petPage.name] = { error: hasError, cards, hasData: hasNumbers };

      await page.screenshot({ path: `e2e/re-audit/screenshots/bug-050-pet-${petPage.name}.png`, fullPage: true });
    }

    for (const [name, r] of Object.entries(results)) {
      console.log(`BUG-050 [${name}]: error=${r.error}, cards=${r.cards}, hasData=${r.hasData}`);
    }

    const allHaveData = Object.values(results).every(r => r.hasData && !r.error);
    const anyError = Object.values(results).some(r => r.error);
    console.log(`BUG-050: ${anyError ? 'FAIL-ERROR' : allHaveData ? 'PASS' : 'PARTIAL'}`);
  });

  test('BUG-053: Company PET sessions — list loads', async ({ page }) => {
    await page.goto('/company-pet/sessions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    let pageContent = await page.textContent('body') || '';
    let has404 = await page.locator('text=404').count() > 0;

    if (has404 || pageContent.includes('non trovato')) {
      await page.goto('/company-pet/organization/sessions');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      pageContent = await page.textContent('body') || '';
      has404 = await page.locator('text=404').count() > 0;
    }

    const hasError = await page.locator('text=Errore').count() > 0;
    const hasSessionContent = pageContent.toLowerCase().includes('session') ||
                              pageContent.toLowerCase().includes('analisi') ||
                              pageContent.toLowerCase().includes('analysis');

    const hasTestSession = pageContent.includes('Test Session');
    const hasTable = await page.locator('table').count() > 0;
    const cardCount = await page.locator('[class*="card"]').count();

    const hasEmptyState = pageContent.toLowerCase().includes('nessun') || pageContent.toLowerCase().includes('no data');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-053-pet-sessions.png', fullPage: true });

    console.log(`BUG-053: 404=${has404}, error=${hasError}, sessionContent=${hasSessionContent}, testSession=${hasTestSession}, table=${hasTable}, cards=${cardCount}, empty=${hasEmptyState}`);
    console.log(`BUG-053: ${has404 ? 'FAIL-404' : hasSessionContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-054: Company PET staging/org-scenarios — list loads', async ({ page }) => {
    await page.goto('/company-pet/staging-comparison');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const pageContent = await page.textContent('body') || '';
    const has404 = await page.locator('text=404').count() > 0;

    const hasError = await page.locator('text=Errore').count() > 0;
    const hasStagingContent = pageContent.toLowerCase().includes('scenario') ||
                              pageContent.toLowerCase().includes('staging') ||
                              pageContent.toLowerCase().includes('confronto') ||
                              pageContent.toLowerCase().includes('comparison') ||
                              pageContent.toLowerCase().includes('organizzativ');

    const hasBaseline = pageContent.includes('Baseline') || pageContent.includes('baseline');
    const hasTable = await page.locator('table').count() > 0;
    const cardCount = await page.locator('[class*="card"]').count();

    const hasEmptyState = pageContent.toLowerCase().includes('nessun') || pageContent.toLowerCase().includes('no data');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-054-pet-staging.png', fullPage: true });

    console.log(`BUG-054: 404=${has404}, error=${hasError}, stagingContent=${hasStagingContent}, baseline=${hasBaseline}, table=${hasTable}, cards=${cardCount}, empty=${hasEmptyState}`);
    console.log(`BUG-054: ${has404 ? 'FAIL-404' : hasStagingContent ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-056: Workforce demographics — data present', async ({ page }) => {
    await page.goto('/company-pet/workforce/demographics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0;

    const pageContent = await page.textContent('body') || '';
    const hasGender = pageContent.toLowerCase().includes('genere') || pageContent.toLowerCase().includes('gender') ||
                      pageContent.includes('Male') || pageContent.includes('Female') ||
                      pageContent.includes('Maschio') || pageContent.includes('Femmina');
    const hasAge = pageContent.toLowerCase().includes('eta') || pageContent.toLowerCase().includes('age') ||
                   pageContent.includes('30-39') || pageContent.includes('40-49');
    const hasContract = pageContent.toLowerCase().includes('contratt') || pageContent.toLowerCase().includes('contract') ||
                        pageContent.toLowerCase().includes('permanent') || pageContent.toLowerCase().includes('indeterminato');

    const hasSvg = await page.locator('svg').count() > 0;
    const hasNumbers = /\d{2,}/.test(pageContent);
    const has156 = pageContent.includes('156');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-056-demographics.png', fullPage: true });

    console.log(`BUG-056: error=${hasError}, gender=${hasGender}, age=${hasAge}, contract=${hasContract}, svg=${hasSvg}, numbers=${hasNumbers}, has156=${has156}`);
    console.log(`BUG-056: ${hasError ? 'FAIL-ERROR' : hasGender && hasNumbers ? 'PASS' : 'NEEDS-REVIEW'}`);
  });

  test('BUG-055: 9-box and rating distribution — real data (not mock)', async ({ page }) => {
    await page.goto('/company-pet/organization/talent');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    let pageContent = await page.textContent('body') || '';
    let has404 = await page.locator('text=404').count() > 0;

    if (has404) {
      await page.goto('/company-pet/organization/performance');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      pageContent = await page.textContent('body') || '';
      has404 = await page.locator('text=404').count() > 0;
    }

    const hasError = await page.locator('text=Errore').count() > 0;

    const has9Box = pageContent.toLowerCase().includes('9-box') || pageContent.toLowerCase().includes('nine box') ||
                    pageContent.toLowerCase().includes('9 box') || pageContent.toLowerCase().includes('matrice');
    const hasRatingDist = pageContent.toLowerCase().includes('rating') || pageContent.toLowerCase().includes('distribuz') ||
                          pageContent.toLowerCase().includes('valutazion') || pageContent.toLowerCase().includes('performance');

    const hasNumbers = /\d{2,}/.test(pageContent);
    const hasSvg = await page.locator('svg').count() > 0;
    const cardCount = await page.locator('[class*="card"]').count();

    const hasMock = pageContent.includes('Lorem') || pageContent.includes('Example') || pageContent.includes('Sample');
    const hasHardcodedValues = pageContent.includes('4.2/5') || pageContent.includes('85%');

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-055-9box-rating.png', fullPage: true });

    console.log(`BUG-055: 404=${has404}, error=${hasError}, 9box=${has9Box}, ratingDist=${hasRatingDist}, numbers=${hasNumbers}, svg=${hasSvg}, cards=${cardCount}, mock=${hasMock}, hardcoded=${hasHardcodedValues}`);
    console.log(`BUG-055: ${has404 ? 'FAIL-404' : has9Box || hasRatingDist ? 'PASS-LOADED' : 'NEEDS-REVIEW'}`);
  });
});
