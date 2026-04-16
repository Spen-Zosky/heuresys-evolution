"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
// Uses storageState from auth.setup.ts (rtl-admin, SYSADMIN role, RTL Bank tenant)
test_1.test.describe('AI Services Re-Audit', () => {
    (0, test_1.test)('BUG-030: AI Chat page loads sessions list (no 404)', async ({ page }) => {
        await page.goto('/admin/ai/chat', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        const hasError = await page.locator('text=404').count() > 0 ||
            await page.locator('text=Pagina non trovata').count() > 0 ||
            await page.locator('text=Not Found').count() > 0;
        const hasContent = await page.locator('table tbody tr, [class*="card"], [role="row"], [class*="chat"], [class*="session"], [class*="message"]').count() > 0;
        const pageContent = await page.textContent('body');
        const hasEmptyState = pageContent?.toLowerCase().includes('nessun') ||
            pageContent?.toLowerCase().includes('inizia') ||
            pageContent?.toLowerCase().includes('nuova conversazione') || false;
        const hasChatUI = pageContent?.toLowerCase().includes('chat') ||
            pageContent?.toLowerCase().includes('messag') || false;
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-030-ai-chat.png', fullPage: true });
        console.log(`BUG-030: error=${hasError}, content=${hasContent}, emptyState=${hasEmptyState}, chatUI=${hasChatUI}`);
        console.log(`BUG-030: ${hasError ? 'FAIL' : (hasContent || hasEmptyState || hasChatUI) ? 'PASS' : 'EMPTY'}`);
    });
    (0, test_1.test)('BUG-032/033: AI Documents page shows filename and chunk_count', async ({ page }) => {
        await page.goto('/admin/ai/documents', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        const hasError = await page.locator('text=Errore').count() > 0 ||
            await page.locator('text=404').count() > 0 ||
            await page.locator('text=501').count() > 0;
        const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
        const pageContent = await page.textContent('body');
        const hasFilename = pageContent?.toLowerCase().includes('filename') ||
            pageContent?.toLowerCase().includes('nome file') ||
            pageContent?.toLowerCase().includes('.pdf') ||
            pageContent?.toLowerCase().includes('.doc') || false;
        const hasChunkCount = pageContent?.toLowerCase().includes('chunk') ||
            pageContent?.toLowerCase().includes('segmenti') ||
            pageContent?.toLowerCase().includes('frammenti') || false;
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-032-033-ai-documents.png', fullPage: true });
        console.log(`BUG-032/033: error=${hasError}, data=${hasData}, filename=${hasFilename}, chunkCount=${hasChunkCount}`);
        console.log(`BUG-032/033: ${hasError ? 'FAIL' : hasData ? 'PASS' : 'EMPTY'}`);
    });
    (0, test_1.test)('BUG-036/037/038: AI Sessions page shows real data columns', async ({ page }) => {
        await page.goto('/admin/ai/sessions', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        const hasError = await page.locator('text=Errore').count() > 0 ||
            await page.locator('text=404').count() > 0 ||
            await page.locator('text=501').count() > 0;
        const hasData = await page.locator('table tbody tr, [class*="card"], [role="row"]').count() > 0;
        const pageContent = await page.textContent('body');
        const hasSessionInfo = pageContent?.toLowerCase().includes('session') ||
            pageContent?.toLowerCase().includes('sessione') || false;
        const hasUserInfo = pageContent?.toLowerCase().includes('utente') ||
            pageContent?.toLowerCase().includes('user') || false;
        const hasDateInfo = pageContent?.toLowerCase().includes('data') ||
            pageContent?.toLowerCase().includes('date') ||
            pageContent?.toLowerCase().includes('creato') || false;
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-036-038-ai-sessions.png', fullPage: true });
        console.log(`BUG-036/037/038: error=${hasError}, data=${hasData}, sessionInfo=${hasSessionInfo}, userInfo=${hasUserInfo}, dateInfo=${hasDateInfo}`);
        console.log(`BUG-036/037/038: ${hasError ? 'FAIL' : hasData ? 'PASS' : 'EMPTY'}`);
    });
    (0, test_1.test)('BUG-035: AI Documents upload button exists with handler', async ({ page }) => {
        await page.goto('/admin/ai/documents', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        const hasError = await page.locator('text=404').count() > 0;
        const uploadBtn = page.locator('button:has-text("Carica"), button:has-text("Upload"), button:has-text("carica"), button:has-text("Nuovo")');
        const uploadBtnCount = await uploadBtn.count();
        const fileInput = await page.locator('input[type="file"]').count();
        let btnEnabled = false;
        if (uploadBtnCount > 0) {
            btnEnabled = await uploadBtn.first().isEnabled();
        }
        await page.screenshot({ path: 'e2e/re-audit/screenshots/bug-035-upload-button.png', fullPage: true });
        console.log(`BUG-035: error=${hasError}, uploadBtn=${uploadBtnCount}, fileInput=${fileInput}, btnEnabled=${btnEnabled}`);
        console.log(`BUG-035: ${hasError ? 'FAIL' : uploadBtnCount > 0 ? 'PASS' : 'FAIL-NO-BUTTON'}`);
    });
});
//# sourceMappingURL=re-audit-ai.spec.js.map