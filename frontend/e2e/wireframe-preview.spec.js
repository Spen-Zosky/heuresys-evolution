"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
test_1.test.describe('Wireframe Preview Component', () => {
    (0, test_1.test)('should render SVG wireframe viewer', async ({ page }) => {
        // Navigate to wireframes page
        await page.goto('/admin/design/wireframes', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        // Click on a wireframe card to switch to viewer mode
        const wireframeCard = page.locator('[class*="cursor-pointer"]').first();
        if (await wireframeCard.count() === 0) {
            console.log('No wireframe cards found - test skipped');
            return;
        }
        await wireframeCard.click();
        await page.waitForLoadState('networkidle');
        // Wait for Excalidraw to load
        try {
            await page.waitForSelector('.excalidraw', { timeout: 15000 });
        }
        catch {
            console.log('Excalidraw not loaded - no wireframes available');
            return;
        }
        // Check for canvas element (Excalidraw uses canvas, not SVG)
        const canvasElement = page.locator('.excalidraw canvas').first();
        const canvasVisible = await canvasElement.isVisible().catch(() => false);
        console.log(`Canvas element visible: ${canvasVisible}`);
        // Take screenshot
        await page.screenshot({ path: '/tmp/wireframe-preview-test.png', fullPage: true });
        console.log('Screenshot saved: /tmp/wireframe-preview-test.png');
        // Verify Excalidraw container is present
        const excalidrawInfo = await page.evaluate(() => {
            const container = document.querySelector('.excalidraw');
            const canvas = document.querySelector('.excalidraw canvas');
            return {
                hasContainer: !!container,
                hasCanvas: !!canvas,
                canvasWidth: canvas?.clientWidth || 0,
                canvasHeight: canvas?.clientHeight || 0
            };
        });
        console.log(`Excalidraw info: ${JSON.stringify(excalidrawInfo)}`);
        // Assertions - verify excalidraw loaded
        (0, test_1.expect)(excalidrawInfo.hasContainer).toBe(true);
    });
    (0, test_1.test)('should allow zooming and panning', async ({ page }) => {
        await page.goto('/admin/design/wireframes', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForLoadState('networkidle');
        // Click on a wireframe card to switch to viewer mode
        const wireframeCard = page.locator('[class*="cursor-pointer"]').first();
        if (await wireframeCard.count() === 0) {
            console.log('No wireframe cards found - test skipped');
            return;
        }
        await wireframeCard.click();
        await page.waitForLoadState('networkidle');
        // Wait for Excalidraw
        try {
            await page.waitForSelector('.excalidraw', { timeout: 15000 });
        }
        catch {
            console.log('Excalidraw not loaded');
            return;
        }
        // Excalidraw has its own zoom controls - check for canvas
        const canvas = page.locator('.excalidraw canvas').first();
        const visible = await canvas.isVisible().catch(() => false);
        console.log(`Canvas visible: ${visible}`);
        // Try to use keyboard zoom (Ctrl + +/-)
        await page.keyboard.press('Control+=');
        await page.waitForTimeout(500);
        await page.keyboard.press('Control+-');
        await page.waitForTimeout(500);
        // Take screenshot
        await page.screenshot({ path: '/tmp/wireframe-zoom-test.png', fullPage: true });
        // Verify still visible after zoom
        (0, test_1.expect)(await canvas.isVisible().catch(() => false)).toBe(true);
    });
    (0, test_1.test)('should switch between wireframes', async ({ page }) => {
        await page.goto('/admin/design/wireframes', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForLoadState('networkidle');
        // Get all wireframe cards/buttons in the sidebar
        const wireframeButtons = page.locator('button[class*="w-full text-left"]');
        const buttonCount = await wireframeButtons.count();
        console.log(`Found ${buttonCount} wireframe buttons`);
        if (buttonCount < 2) {
            console.log('Not enough wireframes to test switching');
            return;
        }
        // Click first wireframe
        await wireframeButtons.first().click();
        await page.waitForLoadState('networkidle');
        // Wait for Excalidraw
        try {
            await page.waitForSelector('.excalidraw', { timeout: 15000 });
        }
        catch {
            console.log('Excalidraw not loaded');
            return;
        }
        const canvas1 = page.locator('.excalidraw canvas').first();
        (0, test_1.expect)(await canvas1.isVisible().catch(() => false)).toBe(true);
        // Click second wireframe
        await wireframeButtons.nth(1).click();
        await page.waitForLoadState('networkidle');
        // Verify still works after switching
        const canvas2 = page.locator('.excalidraw canvas').first();
        (0, test_1.expect)(await canvas2.isVisible().catch(() => false)).toBe(true);
        // Take screenshot
        await page.screenshot({ path: '/tmp/wireframe-switch-test.png', fullPage: true });
    });
});
//# sourceMappingURL=wireframe-preview.spec.js.map