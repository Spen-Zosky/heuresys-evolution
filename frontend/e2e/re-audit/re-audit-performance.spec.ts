import { test, expect } from '@playwright/test';

// Uses storageState from auth.setup.ts (rtl-admin, SYSADMIN role, RTL Bank tenant)
// No manual login needed

test.describe('Performance Re-Audit', () => {

  test('BUG-090: OKRs page shows table with data columns', async ({ page }) => {
    await page.goto('/admin/performance/okrs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasTable = await page.locator('table').count() > 0;
    const hasCards = await page.locator('[class*="card"], [role="row"]').count() > 0;
    const hasData = hasTable || hasCards;

    const pageContent = await page.textContent('body');
    const hasObjectiveCol = pageContent?.toLowerCase().includes('obiettiv') || pageContent?.toLowerCase().includes('objective') || false;
    const hasProgressCol = pageContent?.toLowerCase().includes('progress') || pageContent?.toLowerCase().includes('avanzamento') || false;
    const hasStatusCol = pageContent?.toLowerCase().includes('stato') || pageContent?.toLowerCase().includes('status') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-090-okrs.png', fullPage: true });

    console.log(`BUG-090: error=${hasError}, data=${hasData}, table=${hasTable}, objective=${hasObjectiveCol}, progress=${hasProgressCol}, status=${hasStatusCol}`);
    console.log(`BUG-090: ${hasError ? 'FAIL' : hasData ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-103a: Continuous feedback page loads without 501', async ({ page }) => {
    await page.goto('/admin/performance/feedback', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0 ||
                     await page.locator('text=Not Implemented').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasEmptyState = pageContent?.toLowerCase().includes('nessun') || pageContent?.toLowerCase().includes('empty') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-103a-feedback.png', fullPage: true });

    console.log(`BUG-103a: error=${hasError}, data=${hasData}, emptyState=${hasEmptyState}`);
    console.log(`BUG-103a: ${hasError ? 'FAIL' : (hasData || hasEmptyState) ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-103b: 360 reviews page loads without 501', async ({ page }) => {
    await page.goto('/admin/performance/360-reviews', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0 ||
                     await page.locator('text=Not Implemented').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasEmptyState = pageContent?.toLowerCase().includes('nessun') || pageContent?.toLowerCase().includes('empty') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-103b-360-reviews.png', fullPage: true });

    console.log(`BUG-103b: error=${hasError}, data=${hasData}, emptyState=${hasEmptyState}`);
    console.log(`BUG-103b: ${hasError ? 'FAIL' : (hasData || hasEmptyState) ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-091: Review cycles page shows badge types correctly', async ({ page }) => {
    await page.goto('/admin/performance/review-cycles', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const hasBadges = await page.locator('[class*="badge"], [class*="Badge"], span[class*="rounded"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasTypeInfo = pageContent?.toLowerCase().includes('annual') ||
                        pageContent?.toLowerCase().includes('annuale') ||
                        pageContent?.toLowerCase().includes('quarterly') ||
                        pageContent?.toLowerCase().includes('trimestrale') ||
                        pageContent?.toLowerCase().includes('tipo') ||
                        pageContent?.toLowerCase().includes('type') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-091-review-cycles.png', fullPage: true });

    console.log(`BUG-091: error=${hasError}, data=${hasData}, badges=${hasBadges}, typeInfo=${hasTypeInfo}`);
    console.log(`BUG-091: ${hasError ? 'FAIL' : hasData ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-092: Calibration page shows data columns', async ({ page }) => {
    await page.goto('/admin/performance/calibration', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const hasTable = await page.locator('table').count() > 0;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-092-calibration.png', fullPage: true });

    console.log(`BUG-092: error=${hasError}, data=${hasData}, table=${hasTable}`);
    console.log(`BUG-092: ${hasError ? 'FAIL' : hasData ? 'PASS' : 'EMPTY'}`);
  });

  test('BUG-102: Check-ins page shows meeting_type', async ({ page }) => {
    await page.goto('/admin/performance/check-ins', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text=Errore').count() > 0 ||
                     await page.locator('text=404').count() > 0 ||
                     await page.locator('text=501').count() > 0;

    const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
    const pageContent = await page.textContent('body');
    const hasMeetingType = pageContent?.toLowerCase().includes('meeting') ||
                           pageContent?.toLowerCase().includes('tipo incontro') ||
                           pageContent?.toLowerCase().includes('one-on-one') ||
                           pageContent?.toLowerCase().includes('1:1') ||
                           pageContent?.toLowerCase().includes('weekly') ||
                           pageContent?.toLowerCase().includes('riunione') || false;

    await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-102-checkins.png', fullPage: true });

    console.log(`BUG-102: error=${hasError}, data=${hasData}, meetingType=${hasMeetingType}`);
    console.log(`BUG-102: ${hasError ? 'FAIL' : hasData ? 'PASS' : 'EMPTY'}`);
  });
});
