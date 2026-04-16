"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_BASE = 'http://localhost:8012';
let HEADERS = { 'X-Tenant-Code': 'rtl-bank' };
/**
 * VERIFICA SISTEMATICA - AI & KNOWLEDGE
 */
test_1.test.describe('5. AI & Knowledge Section', () => {
    test_1.test.beforeAll(async () => {
        const token = await (0, api_auth_helper_1.getAuthToken)();
        HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
    });
    (0, test_1.test)('5.1 AI Main Page - Verify page loads', async ({ page }) => {
        await page.goto('/admin/ai');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/ai-main.png', fullPage: true });
        // Page should load without errors - check for visible error messages
        const errorMessage = page.locator('text=404').or(page.locator('text=Not Found')).or(page.locator('text=Page not found'));
        const hasError = await errorMessage.first().isVisible().catch(() => false);
        (0, test_1.expect)(hasError, 'Page should not show 404 error').toBeFalsy();
        // Check for title or header
        const title = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(title.first()).toBeVisible();
        console.log('[AI Main Page]: loaded successfully');
    });
    (0, test_1.test)('5.2 AI Chat Page - Verify chat interface', async ({ page }) => {
        await page.goto('/admin/ai/chat');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/ai-chat.png', fullPage: true });
        // Look for chat-related elements
        const chatInterface = page.locator('textarea').or(page.locator('input[type="text"]')).or(page.locator('[contenteditable]'));
        const chatVisible = await chatInterface.first().isVisible().catch(() => false);
        console.log(`[AI Chat Interface]: ${chatVisible ? 'visible' : 'not found'}`);
    });
    (0, test_1.test)('5.3 AI Sessions Page - Verify sessions list', async ({ page, request }) => {
        // Check if sessions API exists
        const sessionsRes = await request.get(`${API_BASE}/api/v1/ai/sessions`, { headers: HEADERS }).catch(() => null);
        if (sessionsRes && sessionsRes.ok()) {
            const data = await sessionsRes.json();
            console.log('[AI Sessions API]:', data);
        }
        else {
            console.log('[AI Sessions API]: not available');
        }
        await page.goto('/admin/ai/sessions');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/ai-sessions.png', fullPage: true });
        console.log('[AI Sessions Page]: loaded');
    });
    (0, test_1.test)('5.4 AI Documents Page - Verify documents list', async ({ page, request }) => {
        // Check if documents API exists
        const docsRes = await request.get(`${API_BASE}/api/v1/documents`, { headers: HEADERS }).catch(() => null);
        if (docsRes && docsRes.ok()) {
            const data = await docsRes.json();
            console.log(`[Documents API]: ${data.data?.length || 0} documents`);
        }
        else {
            console.log('[Documents API]: not available');
        }
        await page.goto('/admin/ai/documents');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/ai-documents.png', fullPage: true });
        console.log('[AI Documents Page]: loaded');
    });
    (0, test_1.test)('5.5 Knowledge Base Page - Verify KB interface', async ({ page, request }) => {
        // Check if knowledge base API exists
        const kbRes = await request.get(`${API_BASE}/api/v1/knowledge-base`, { headers: HEADERS }).catch(() => null);
        if (kbRes && kbRes.ok()) {
            const data = await kbRes.json();
            console.log('[Knowledge Base API]:', data);
        }
        else {
            console.log('[Knowledge Base API]: not available');
        }
        await page.goto('/admin/knowledge-base');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/knowledge-base.png', fullPage: true });
        // Check for KB-related elements
        const pageTitle = page.locator('h1').or(page.locator('h2'));
        await (0, test_1.expect)(pageTitle.first()).toBeVisible();
        console.log('[Knowledge Base Page]: loaded successfully');
    });
});
//# sourceMappingURL=ai-knowledge.spec.js.map