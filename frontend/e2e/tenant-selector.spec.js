"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * Test E2E: Tenant Selector — verifica che il selettore tenant
 * appaia SOLO per SUPERUSER e MAI per altri ruoli.
 *
 * Testa login con 3 utenti diversi:
 * - sysadmin (SUPERUSER) → deve vedere il selettore con "Tutti i Tenant"
 * - rtl-admin (SYSADMIN) → NON deve vedere il selettore
 * - rtl-hr (HR) → NON deve vedere il selettore
 */
const USERS = [
    {
        username: 'sysadmin',
        password: 'Admin2026',
        role: 'SUPERUSER',
        expectTenantSelector: true,
        expectRedirect: '/platform',
        label: 'SUPERUSER (sysadmin)',
    },
    {
        username: 'rtl-admin',
        password: 'Admin2026',
        role: 'SYSADMIN',
        expectTenantSelector: false,
        expectRedirect: '/admin',
        label: 'SYSADMIN (rtl-admin)',
    },
    {
        username: 'rtl-hr',
        password: 'Admin2026',
        role: 'HR',
        expectTenantSelector: false,
        expectRedirect: '/admin',
        label: 'HR (rtl-hr)',
    },
];
async function loginAs(page, username, password, expectRedirect) {
    // Navigate first, then clear storage (localStorage requires a same-origin page)
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.context().clearCookies();
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    // Reload after clearing to ensure clean state
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const usernameField = page.locator('#username');
    await usernameField.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    await usernameField.click();
    await usernameField.fill('');
    await usernameField.pressSequentially(username, { delay: 30 });
    const passwordField = page.locator('#password');
    await passwordField.click();
    await passwordField.fill('');
    await passwordField.pressSequentially(password, { delay: 30 });
    await page.click('button[type="submit"]');
    await page.waitForURL(`**${expectRedirect}**`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
}
test_1.test.describe('Tenant Selector — Role-Based Visibility', () => {
    // This test does NOT use shared auth state — each test logs in independently
    test_1.test.use({ storageState: { cookies: [], origins: [] } });
    for (const user of USERS) {
        (0, test_1.test)(`${user.label}: tenant selector ${user.expectTenantSelector ? 'VISIBILE' : 'NON visibile'}`, async ({ page }) => {
            await loginAs(page, user.username, user.password, user.expectRedirect);
            // Verify we landed on the correct page
            (0, test_1.expect)(page.url()).toContain(user.expectRedirect);
            // Wait for header to render
            const header = page.locator('header[role="banner"]');
            await header.waitFor({ state: 'visible', timeout: 10000 });
            // Take screenshot for evidence
            await page.screenshot({
                path: `e2e/screenshots/tenant-selector-${user.username}.png`,
                fullPage: false,
            });
            if (user.expectTenantSelector) {
                // SUPERUSER: deve avere il bottone tenant selector
                const tenantButton = header.locator('button:has-text("Tutti i Tenant"), button:has-text("RTL Bank"), button:has-text("SmartFood"), button:has-text("EcoNova"), button:has-text("Heuresys System")');
                await (0, test_1.expect)(tenantButton.first()).toBeVisible({ timeout: 5000 });
                // Click per aprire il dropdown
                await tenantButton.first().click();
                await page.waitForTimeout(500);
                // Verifica che "Tutti i Tenant" sia presente nel menu
                const tuttiOption = page.locator('[role="menuitem"]:has-text("Tutti i Tenant")');
                await (0, test_1.expect)(tuttiOption).toBeVisible({ timeout: 5000 });
                // Verifica che ci siano anche i tenant individuali
                await (0, test_1.expect)(page.locator('[role="menuitem"]:has-text("RTL Bank")')).toBeVisible();
                await (0, test_1.expect)(page.locator('[role="menuitem"]:has-text("SmartFood")')).toBeVisible();
                await (0, test_1.expect)(page.locator('[role="menuitem"]:has-text("EcoNova")')).toBeVisible();
                await (0, test_1.expect)(page.locator('[role="menuitem"]:has-text("Heuresys System")')).toBeVisible();
                // Screenshot con dropdown aperto
                await page.screenshot({
                    path: `e2e/screenshots/tenant-selector-${user.username}-open.png`,
                    fullPage: false,
                });
                // Chiudi il dropdown (click fuori)
                await page.keyboard.press('Escape');
            }
            else {
                // NON-SUPERUSER: il tenant selector NON deve esistere
                // Cerco qualsiasi bottone nell'header che contenga nomi di tenant
                const tenantButton = header.locator('button:has-text("Tutti i Tenant"), button:has-text("Filtra per Tenant"), button:has-text("Seleziona Tenant")');
                await (0, test_1.expect)(tenantButton).toHaveCount(0);
                // Verifica anche che non ci siano bottoni Building2 + ChevronDown nel left section
                // (il tenant selector ha Building2 icon + chevron)
                const leftSection = header.locator('div').first();
                const tenantDropdownTrigger = leftSection.locator('button:has(svg)');
                // Ci dovrebbe essere solo il menu toggle (mobile) e il logo link, nessun tenant selector
                // Il tenant selector ha l'attributo outline variant
                const outlineButtons = header.locator('div').first().locator('button[class*="border"]');
                await (0, test_1.expect)(outlineButtons).toHaveCount(0);
            }
            // Verify user role is displayed in header
            const roleDisplay = header.locator(`text=${user.role}`);
            await (0, test_1.expect)(roleDisplay).toBeVisible({ timeout: 5000 });
        });
    }
    (0, test_1.test)('SUPERUSER: switch tenant filtra i dati', async ({ page }) => {
        await loginAs(page, 'sysadmin', 'Admin2026', '/platform');
        const header = page.locator('header[role="banner"]');
        await header.waitFor({ state: 'visible', timeout: 10000 });
        // Verifica stato iniziale: "Tutti i Tenant" (nessun tenant selezionato)
        const tenantButton = header.locator('button:has-text("Tutti i Tenant")');
        await (0, test_1.expect)(tenantButton).toBeVisible({ timeout: 5000 });
        // Click e seleziona RTL Bank
        await tenantButton.click();
        await page.waitForTimeout(500);
        const rtlOption = page.locator('[role="menuitem"]:has-text("RTL Bank")');
        await (0, test_1.expect)(rtlOption).toBeVisible();
        await rtlOption.click();
        // La pagina dovrebbe ricaricarsi
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        // Ora il bottone dovrebbe mostrare "RTL Bank"
        const updatedButton = header.locator('button:has-text("RTL Bank")');
        await (0, test_1.expect)(updatedButton).toBeVisible({ timeout: 10000 });
        await page.screenshot({
            path: 'e2e/screenshots/tenant-selector-sysadmin-rtl-bank.png',
            fullPage: false,
        });
    });
});
//# sourceMappingURL=tenant-selector.spec.js.map