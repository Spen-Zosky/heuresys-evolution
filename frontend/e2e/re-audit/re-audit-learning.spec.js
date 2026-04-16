"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const login_helper_1 = require("./login-helper");
const SCREENSHOTS = 'e2e/re-audit/screenshots';
test_1.test.describe('Re-Audit Learning', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await (0, login_helper_1.loginAsSysadmin)(page);
    });
    (0, test_1.test)('BUG-104: skills page shows preferred_label_en', async ({ page }) => {
        await page.goto('/admin/skills');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/bug104-skills.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasTable = await page.locator('table').first().isVisible().catch(() => false);
        const hasSkillNames = await page.locator('text=/modeling|analysis|management|programming|communication/i').first().isVisible().catch(() => false);
        const hasNameCol = await page.locator('th, [role="columnheader"]').filter({ hasText: /nome|name|competenza|skill/i }).first().isVisible().catch(() => false);
        console.log(`BUG-104: Page 404=${is404}, Table=${hasTable}, Skill names visible=${hasSkillNames}, Name column=${hasNameCol}`);
    });
    (0, test_1.test)('BUG-105: certifications page shows issuing_organization', async ({ page }) => {
        await page.goto('/admin/certifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/bug105-certifications.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasTable = await page.locator('table').first().isVisible().catch(() => false);
        const hasOrgColumn = await page.locator('th, [role="columnheader"]').filter({ hasText: /ente|organizzazione|issuing|emittente|organization/i }).first().isVisible().catch(() => false);
        const hasOrgNames = await page.locator('text=/American Bankers|Banca d\'Italia|AIIA|ISACA|PMI/i').first().isVisible().catch(() => false);
        console.log(`BUG-105: Page 404=${is404}, Table=${hasTable}, Org column=${hasOrgColumn}, Org names visible=${hasOrgNames}`);
    });
    (0, test_1.test)('BUG-097: courses page - badge status correct (not all "Inattivo")', async ({ page }) => {
        await page.goto('/admin/courses');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/bug097-courses.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasTable = await page.locator('table').first().isVisible().catch(() => false);
        const activeBadges = await page.locator('text=/attivo|active/i').count();
        const inactiveBadges = await page.locator('text=/inattivo|inactive/i').count();
        const allInactive = (activeBadges + inactiveBadges) > 0 && activeBadges === 0;
        const hasStatusCol = await page.locator('th, [role="columnheader"]').filter({ hasText: /stato|status/i }).first().isVisible().catch(() => false);
        console.log(`BUG-097: Page 404=${is404}, Table=${hasTable}, Status col=${hasStatusCol}, Active=${activeBadges}, Inactive=${inactiveBadges}, All inactive=${allInactive}`);
    });
    (0, test_1.test)('BUG-096: learning paths - columns correct', async ({ page }) => {
        await page.goto('/admin/learning-paths');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/bug096-learning-paths.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasTable = await page.locator('table').first().isVisible().catch(() => false);
        const headers = page.locator('th, [role="columnheader"]');
        const headerCount = await headers.count();
        const headerTexts = [];
        for (let i = 0; i < headerCount; i++) {
            const text = await headers.nth(i).textContent().catch(() => '');
            if (text)
                headerTexts.push(text.trim());
        }
        const hasData = await page.locator('text=/Compliance|Onboarding|Leadership|Career/i').first().isVisible().catch(() => false);
        console.log(`BUG-096: Page 404=${is404}, Table=${hasTable}, Headers=[${headerTexts.join(', ')}], Data visible=${hasData}`);
    });
    (0, test_1.test)('BUG-099: courses/new - code field present, create works', async ({ page }) => {
        await page.goto('/admin/courses/new');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS}/bug099-courses-new.png`, fullPage: true });
        const is404 = await page.locator('text=/404|non trovata|not found/i').first().isVisible().catch(() => false);
        const hasForm = await page.locator('form, input, select, textarea').first().isVisible().catch(() => false);
        const hasCodeField = await page.locator('label').filter({ hasText: /codice|code/i }).first().isVisible().catch(() => false);
        const hasTitleField = await page.locator('input[name="title"], input[placeholder*="titolo" i], input[placeholder*="title" i]').first().isVisible().catch(() => false);
        const hasSubmit = await page.locator('button[type="submit"], button:has-text("Salva"), button:has-text("Crea"), button:has-text("Save")').first().isVisible().catch(() => false);
        console.log(`BUG-099: Page 404=${is404}, Form=${hasForm}, Code field=${hasCodeField}, Title field=${hasTitleField}, Submit btn=${hasSubmit}`);
    });
});
//# sourceMappingURL=re-audit-learning.spec.js.map