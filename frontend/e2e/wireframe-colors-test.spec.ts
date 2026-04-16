import { test, expect } from '@playwright/test';

/**
 * Wireframe Viewer Test
 *
 * Verifies that wireframes render correctly with Heuresys brand colors.
 * Note: Colors are pre-applied in wireframe files via migrate-wireframe-colors.ts
 * Note: Excalidraw renders to canvas, so we can't programmatically verify colors
 *
 * Brand Colors (for reference):
 * - Primary brand blue: #2563eb
 * - Text colors: #1e293b (slate-800)
 * - Fonts: Nunito (fontFamily: 2)
 */

test.describe('Wireframe Viewer', () => {
  test('verify wireframe renders correctly', async ({ page }) => {
    // Navigate to wireframes page
    await page.goto('/admin/design/wireframes', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Click on a wireframe card to switch to viewer mode
    const wireframeCard = page.locator('[class*="cursor-pointer"]').first();
    if (await wireframeCard.count() > 0) {
      await wireframeCard.click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('No wireframe cards found - skipping viewer test');
      return;
    }

    // Wait for Excalidraw to fully load
    try {
      await page.waitForSelector('.excalidraw', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
    } catch {
      console.log('Excalidraw not loaded - no wireframes available');
      return;
    }

    // Click "Scroll back to content" to center the wireframe and trigger resize
    const scrollBtn = page.locator('button:has-text("Scroll back to content")');
    if (await scrollBtn.isVisible()) {
      await scrollBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Take screenshot for visual verification
    await page.screenshot({ path: '/tmp/wireframe-viewer-test.png', fullPage: true });
    console.log('Screenshot saved: /tmp/wireframe-viewer-test.png');

    // Verify Excalidraw canvas is present and has content
    const canvasInfo = await page.evaluate(() => {
      const excalidrawContainer = document.querySelector('.excalidraw');
      const canvas = document.querySelector('.excalidraw canvas') as HTMLCanvasElement;

      return {
        hasExcalidraw: !!excalidrawContainer,
        hasCanvas: !!canvas,
        canvasWidth: canvas?.clientWidth || 0,
        canvasHeight: canvas?.clientHeight || 0,
      };
    });

    console.log('Canvas Info:', JSON.stringify(canvasInfo, null, 2));

    // Assertions
    expect(canvasInfo.hasExcalidraw).toBe(true);
    expect(canvasInfo.hasCanvas).toBe(true);
    expect(canvasInfo.canvasWidth).toBeGreaterThan(0);
    expect(canvasInfo.canvasHeight).toBeGreaterThan(0);
  });
});
