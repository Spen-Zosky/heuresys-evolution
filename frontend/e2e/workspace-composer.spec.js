"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * Workspace Composer DnD E2E Tests
 *
 * Tests the full composer flow:
 * 1. Catalog loads and displays widgets
 * 2. Add a widget to the workspace
 * 3. Enter edit mode and interact with DnD grid
 * 4. Save layout and verify persistence
 * 5. Remove a widget
 *
 * Uses the authenticated admin session from auth.setup.ts.
 */
const COMPOSER_URL = '/portal/workspace/composer';
test_1.test.describe('Workspace Composer', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await page.goto(COMPOSER_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((err) => {
            if (!(err instanceof Error && err.message.includes('Timeout')))
                throw err;
        });
    });
    (0, test_1.test)('catalog loads with available widgets', async ({ page }) => {
        const catalogHeading = page.getByText('Catalogo disponibile');
        await (0, test_1.expect)(catalogHeading).toBeVisible({ timeout: 15000 });
        const widgetCards = page.locator('.grid .rounded-md.border');
        const count = await widgetCards.count();
        (0, test_1.expect)(count).toBeGreaterThan(0);
    });
    (0, test_1.test)('add widget to workspace', async ({ page }) => {
        await page.getByText('Catalogo disponibile').waitFor({ state: 'visible', timeout: 15000 });
        const addButton = page.locator('.grid .rounded-md.border button:not([disabled])').filter({
            has: page.locator('svg.lucide-plus'),
        }).first();
        const addButtonVisible = await addButton.isVisible().catch(() => false);
        (0, test_1.expect)(addButtonVisible, 'Expected add button to be visible — catalog may be empty or all widgets already added').toBeTruthy();
        await addButton.click();
        const flash = page.locator('.border-green-500\\/30');
        await (0, test_1.expect)(flash).toBeVisible({ timeout: 10000 });
    });
    (0, test_1.test)('edit mode toggle and layout save', async ({ page }) => {
        await page.getByText('Workspace attuale').waitFor({ state: 'visible', timeout: 15000 });
        const workspaceWidgets = page.locator('.rounded-full.bg-primary\\/10');
        const widgetCount = await workspaceWidgets.count();
        (0, test_1.expect)(widgetCount, 'Expected widgets in workspace for DnD test').toBeGreaterThan(0);
        const editButton = page.getByRole('button', { name: /modifica layout/i });
        await (0, test_1.expect)(editButton).toBeVisible({ timeout: 5000 });
        await editButton.click();
        const editBanner = page.locator('.border-blue-500\\/30');
        await (0, test_1.expect)(editBanner).toBeVisible({ timeout: 5000 });
        const saveButton = page.getByRole('button', { name: /salva layout/i });
        await (0, test_1.expect)(saveButton).toBeVisible();
        const cancelButton = page.getByRole('button', { name: /annulla/i });
        await (0, test_1.expect)(cancelButton).toBeVisible();
        const gridItems = page.locator('.react-grid-item');
        const gridItemCount = await gridItems.count();
        (0, test_1.expect)(gridItemCount).toBeGreaterThan(0);
        const firstItem = gridItems.first();
        const box = await firstItem.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + 10);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2 + 50, box.y + 50, { steps: 5 });
            await page.mouse.up();
        }
        await saveButton.click();
        await (0, test_1.expect)(editBanner).toBeHidden({ timeout: 10000 });
    });
    (0, test_1.test)('layout persists after reload', async ({ page }) => {
        await page.getByText('Workspace attuale').waitFor({ state: 'visible', timeout: 15000 });
        const widgetsBefore = page.locator('.rounded-full.bg-primary\\/10');
        const countBefore = await widgetsBefore.count();
        (0, test_1.expect)(countBefore, 'Expected widgets for persistence check').toBeGreaterThan(0);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch((err) => {
            if (!(err instanceof Error && err.message.includes('Timeout')))
                throw err;
        });
        await page.getByText('Workspace attuale').waitFor({ state: 'visible', timeout: 15000 });
        const widgetsAfter = page.locator('.rounded-full.bg-primary\\/10');
        const countAfter = await widgetsAfter.count();
        (0, test_1.expect)(countAfter).toBe(countBefore);
    });
    (0, test_1.test)('remove widget from workspace', async ({ page }) => {
        await page.getByText('Workspace attuale').waitFor({ state: 'visible', timeout: 15000 });
        const removeButton = page.locator('.rounded-full.bg-primary\\/10 button').filter({
            has: page.locator('svg.lucide-minus'),
        }).first();
        const removeVisible = await removeButton.isVisible().catch(() => false);
        (0, test_1.expect)(removeVisible, 'Expected remove button — no widgets available to remove').toBeTruthy();
        const widgetsBefore = page.locator('.rounded-full.bg-primary\\/10');
        const countBefore = await widgetsBefore.count();
        await removeButton.click();
        const flash = page.locator('.border-green-500\\/30');
        await (0, test_1.expect)(flash).toBeVisible({ timeout: 10000 });
        const widgetsAfter = page.locator('.rounded-full.bg-primary\\/10');
        await (0, test_1.expect)(widgetsAfter).toHaveCount(countBefore - 1, { timeout: 10000 });
    });
});
//# sourceMappingURL=workspace-composer.spec.js.map