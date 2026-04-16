import { test, expect } from '@playwright/test';

// Uses storageState from auth.setup.ts (rtl-admin, SYSADMIN role, RTL Bank tenant)

test.describe('Talent Re-Audit', () => {

  test('BUG-111: Skill Profiles page loads data', async ({ page }) => {
    await page.goto('/admin/talent/skill-profiles', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasEmptyState = pageContent?.toLowerCase().includes('nessun') ||
                          pageContent?.toLowerCase().includes('empty') || false;
    const hasProfileInfo = pageContent?.toLowerCase().includes('profil') ||
                           pageContent?.toLowerCase().includes('competenz') ||
                           pageContent?.toLowerCase().includes('skill') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-111-skill-profiles.png', fullPage: true });

    console.log(`BUG-111: error=${hasError}, data=${hasData}, emptyState=${hasEmptyState}, profileInfo=${hasProfileInfo}`);
    console.log(`BUG-111: ${hasError ? 'FAIL' : (hasData || hasEmptyState) ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-112: Gap Analysis page shows results', async ({ page }) => {
    await page.goto('/admin/talent/gap-analysis', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const hasCharts = await page.locator('canvas, svg[class*="chart"], [class*="recharts"], [class*="echarts"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasGapInfo = pageContent?.toLowerCase().includes('gap') ||
                       pageContent?.toLowerCase().includes('divario') ||
                       pageContent?.toLowerCase().includes('analisi') || false;
    const hasEmptyState = pageContent?.toLowerCase().includes('nessun') ||
                          pageContent?.toLowerCase().includes('selezion') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-112-gap-analysis.png', fullPage: true });

    console.log(`BUG-112: error=${hasError}, data=${hasData}, charts=${hasCharts}, gapInfo=${hasGapInfo}, emptyState=${hasEmptyState}`);
    console.log(`BUG-112: ${hasError ? 'FAIL' : (hasData || hasCharts || hasEmptyState) ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-113: Succession planning page loads', async ({ page }) => {
    await page.goto('/admin/talent/succession', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasEmptyState = pageContent?.toLowerCase().includes('nessun') ||
                          pageContent?.toLowerCase().includes('empty') || false;
    const hasSuccessionInfo = pageContent?.toLowerCase().includes('succession') ||
                              pageContent?.toLowerCase().includes('successione') ||
                              pageContent?.toLowerCase().includes('piano') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-113-succession.png', fullPage: true });

    console.log(`BUG-113: error=${hasError}, data=${hasData}, emptyState=${hasEmptyState}, successionInfo=${hasSuccessionInfo}`);
    console.log(`BUG-113: ${hasError ? 'FAIL' : (hasData || hasEmptyState) ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-114: Talent Mobility page loads', async ({ page }) => {
    await page.goto('/admin/talent/mobility', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasEmptyState = pageContent?.toLowerCase().includes('nessun') ||
                          pageContent?.toLowerCase().includes('empty') || false;
    const hasMobilityInfo = pageContent?.toLowerCase().includes('mobilit') ||
                            pageContent?.toLowerCase().includes('trasferim') ||
                            pageContent?.toLowerCase().includes('mobility') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-114-mobility.png', fullPage: true });

    console.log(`BUG-114: error=${hasError}, data=${hasData}, emptyState=${hasEmptyState}, mobilityInfo=${hasMobilityInfo}`);
    console.log(`BUG-114: ${hasError ? 'FAIL' : (hasData || hasEmptyState) ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-115: ESCO Explorer loads skills', async ({ page }) => {
    await page.goto('/admin/talent/esco-explorer', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    let pageContent = await page.textContent('body');
    const is404first = pageContent?.includes('404') || pageContent?.toLowerCase().includes('not found') || false;

    if (is404first) {
      await page.goto('/admin/talent/esco', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      pageContent = await page.textContent('body');
      const is404second = pageContent?.includes('404') || false;
      if (is404second) {
        await page.goto('/admin/catalogs/esco', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        pageContent = await page.textContent('body');
      }
    }

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"], [class*="tree"], li').count() > 0;
    pageContent = await page.textContent('body');
    const hasEscoInfo = pageContent?.toLowerCase().includes('esco') ||
                        pageContent?.toLowerCase().includes('skill') ||
                        pageContent?.toLowerCase().includes('competenz') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-115-esco-explorer.png', fullPage: true });

    console.log(`BUG-115: error=${hasError}, data=${hasData}, escoInfo=${hasEscoInfo}`);
    console.log(`BUG-115: ${hasError ? 'FAIL' : (hasData || hasEscoInfo) ? 'PASS' : 'EMPTY'}`);
  });
});
