import { test, expect } from '@playwright/test';

test('screenshot dashboard-v2', async ({ page }) => {
  await page.goto('/admin/dashboard-v2');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/dashboard-v2-auth.png', fullPage: true });
});
