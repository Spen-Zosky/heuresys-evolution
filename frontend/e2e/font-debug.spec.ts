import { test } from '@playwright/test';

test('debug font loading', async ({ page }) => {
  // Capture network requests for fonts
  const fontRequests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('font') || req.url().includes('woff')) {
      fontRequests.push(req.url());
    }
  });

  await page.goto('http://localhost:3012/admin/design/wireframes', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle');

  // Click on a wireframe card to switch to viewer mode (cards trigger viewer mode on click)
  const wireframeCard = page.locator('[class*="cursor-pointer"]').first();
  if (await wireframeCard.count() > 0) {
    await wireframeCard.click();
    await page.waitForLoadState('networkidle');
  }

  // Wait for Excalidraw to load (may not exist if no wireframes)
  try {
    await page.waitForSelector('.excalidraw', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  } catch {
    console.log('No Excalidraw component found - no wireframes available');
  }

  // Check what EXCALIDRAW_ASSET_PATH is set to
  const assetPath = await page.evaluate(() => {
    return (window as any).EXCALIDRAW_ASSET_PATH;
  });

  console.log('=== EXCALIDRAW_ASSET_PATH ===');
  console.log(assetPath);

  console.log('=== FONT NETWORK REQUESTS ===');
  if (fontRequests.length === 0) {
    console.log('NO FONT REQUESTS MADE!');
  } else {
    fontRequests.forEach(r => console.log(r));
  }

  // Check if Nunito fonts were requested specifically
  const nunitoRequests = fontRequests.filter(r => r.toLowerCase().includes('nunito'));
  console.log('=== NUNITO FONT REQUESTS ===');
  console.log(`Count: ${nunitoRequests.length}`);
  nunitoRequests.forEach(r => console.log(r));

  // Take screenshot
  await page.screenshot({ path: '/tmp/font-debug.png', fullPage: true });
});
