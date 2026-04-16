import { test } from '@playwright/test';

test('capture proof screenshots', async ({ page }) => {
  const { resolve, dirname } = await import('path');
  const screenshotDir = resolve(__dirname, '../../docs/agent_reports/screenshots');
  
  // Portal page
  await page.goto('http://localhost:3012/portal', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${screenshotDir}/portal-page.png`, fullPage: true });
  console.log('✓ Portal screenshot saved');
  
  // Taxonomies page  
  await page.goto('http://localhost:3012/dashboards/taxonomies', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${screenshotDir}/taxonomies-page.png`, fullPage: true });
  console.log('✓ Taxonomies screenshot saved');
  
  // Prototyping page
  await page.goto('http://localhost:3012/dashboards/prototyping', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${screenshotDir}/prototyping-page.png`, fullPage: true });
  console.log('✓ Prototyping screenshot saved');
  
  // Predictions page
  await page.goto('http://localhost:3012/admin/analytics/predictions', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${screenshotDir}/predictions-page.png`, fullPage: true });
  console.log('✓ Predictions screenshot saved');
});
