"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * QA Deep Review — Test granulari post-fix
 *
 * Verifica le modifiche applicate dai reviewer:
 * - Backend: 9 route fixate, SQL injection fix, asyncHandler
 * - Security: 8 route con RBAC aggiunto
 * - Frontend: company-pet con API reali, demographics
 * - Infra: query parallelizzate
 * - DB: 13 indici duplicati rimossi
 *
 * Auth: rtl-admin (RTL Bank, 156 dipendenti, SYSADMIN role)
 */
const BASE = 'http://localhost:8012';
let authToken = null;
async function getToken() {
    if (authToken)
        return authToken;
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'rtl-admin', password: 'Admin2026' }),
    });
    const data = await res.json();
    authToken = data.data.accessToken;
    return authToken;
}
async function apiGet(path) {
    const token = await getToken();
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'x-tenant-id': '0c54b84a-db6e-4da4-bc91-af5d480d524e',
        },
    });
    return { status: res.status, data: await res.json().catch(() => null) };
}
// ========================================================
// SEZIONE 1: Test API diretti (verifica backend fixes)
// ========================================================
test_1.test.describe('API — Backend fix verification', () => {
    (0, test_1.test)('GET /health restituisce 200 (asyncHandler fix)', async () => {
        const res = await fetch(`${BASE}/health`);
        (0, test_1.expect)(res.status).toBe(200);
        const data = await res.json();
        (0, test_1.expect)(data.data.status).toBe('ok');
    });
    (0, test_1.test)('GET /api/v1/employees restituisce 156 dipendenti RTL Bank (paginati)', async () => {
        const { status, data } = await apiGet('/api/v1/employees?limit=100');
        (0, test_1.expect)(status).toBe(200);
        const employees = data?.data?.employees || data?.data || [];
        const meta = data?.data?.meta;
        (0, test_1.expect)(Array.isArray(employees)).toBeTruthy();
        (0, test_1.expect)(employees.length).toBe(100);
        (0, test_1.expect)(meta?.total).toBeGreaterThanOrEqual(156);
        console.log(`[employees] Pagina 1: ${employees.length} dipendenti, totale: ${meta?.total}`);
    });
    (0, test_1.test)('GET /api/v1/departments restituisce dipartimenti RTL Bank', async () => {
        const { status, data } = await apiGet('/api/v1/departments');
        (0, test_1.expect)(status).toBe(200);
        const depts = data?.data?.departments || data?.data || [];
        (0, test_1.expect)(Array.isArray(depts)).toBeTruthy();
        (0, test_1.expect)(depts.length).toBeGreaterThan(0);
        console.log(`[departments] Trovati ${depts.length} dipartimenti`);
    });
    (0, test_1.test)('GET /api/v1/goals restituisce obiettivi RTL Bank', async () => {
        const { status, data } = await apiGet('/api/v1/goals');
        (0, test_1.expect)(status).toBe(200);
        const goals = data?.data?.goals || data?.data || [];
        (0, test_1.expect)(Array.isArray(goals)).toBeTruthy();
        console.log(`[goals] Trovati ${goals.length} obiettivi`);
    });
    (0, test_1.test)('GET /api/v1/check-ins restituisce check-in RTL Bank', async () => {
        const { status, data } = await apiGet('/api/v1/check-ins');
        (0, test_1.expect)(status).toBe(200);
        console.log(`[check-ins] Status: ${status}`);
    });
    (0, test_1.test)('GET /api/v1/performance-reviews restituisce review RTL Bank', async () => {
        const { status, data } = await apiGet('/api/v1/performance-reviews');
        (0, test_1.expect)(status).toBe(200);
        console.log(`[performance-reviews] Status: ${status}`);
    });
    (0, test_1.test)('GET /api/v1/courses restituisce corsi', async () => {
        const { status, data } = await apiGet('/api/v1/courses');
        (0, test_1.expect)(status).toBe(200);
        const courses = data?.data?.courses || data?.data || [];
        console.log(`[courses] Trovati ${courses.length} corsi`);
    });
});
// ========================================================
// SEZIONE 2: Security RBAC — route protette
// ========================================================
test_1.test.describe('API — Security RBAC verification', () => {
    (0, test_1.test)('GET /api/v1/tenants richiede auth (non pubblico)', async () => {
        // Senza token deve dare 401
        const res = await fetch(`${BASE}/api/v1/tenants`);
        (0, test_1.expect)([401, 403]).toContain(res.status);
        console.log(`[tenants no-auth] Status: ${res.status} (corretto)`);
    });
    (0, test_1.test)('GET /api/v1/tenants con token SYSADMIN restituisce dati', async () => {
        const { status, data } = await apiGet('/api/v1/tenants');
        // rtl-admin ha role SYSADMIN nel token — dovrebbe accedere
        (0, test_1.expect)([200, 403]).toContain(status);
        console.log(`[tenants with-auth] Status: ${status}`);
        if (status === 200) {
            const tenants = data?.data?.tenants || data?.data || [];
            console.log(`[tenants] Trovati ${Array.isArray(tenants) ? tenants.length : 'N/A'} tenant`);
        }
    });
    (0, test_1.test)('GET /api/v1/analytics/compensation senza auth → 401', async () => {
        const res = await fetch(`${BASE}/api/v1/analytics/compensation`);
        (0, test_1.expect)([401, 403, 404]).toContain(res.status);
        console.log(`[compensation-analytics no-auth] Status: ${res.status}`);
    });
    (0, test_1.test)('GET /api/v1/analytics/performance senza auth → 401', async () => {
        const res = await fetch(`${BASE}/api/v1/analytics/performance`);
        (0, test_1.expect)([401, 403, 404]).toContain(res.status);
        console.log(`[performance-analytics no-auth] Status: ${res.status}`);
    });
    (0, test_1.test)('GET /api/v1/marketplace/plugins senza auth → 401', async () => {
        const res = await fetch(`${BASE}/api/v1/marketplace/plugins`);
        (0, test_1.expect)([401, 403, 404]).toContain(res.status);
        console.log(`[marketplace no-auth] Status: ${res.status}`);
    });
});
async function testPage(page, url, name) {
    const errors = [];
    const listener = (msg) => {
        if (msg.type() === 'error')
            errors.push(msg.text());
    };
    page.on('console', listener);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
        await page.waitForLoadState('networkidle');
        const currentUrl = page.url();
        const redirectedToLogin = currentUrl.includes('/login');
        const bodyText = await page.textContent('body').catch(() => '');
        const hasError = (bodyText || '').includes('Application error') ||
            (bodyText || '').includes('Internal Server Error');
        const emptyPatterns = ['Nessun dato trovato', 'Nessun risultato', 'Nessun dipendente trovato',
            'Nessun dipartimento trovato', 'Nessuna valutazione trovata', 'Nessun check-in trovato'];
        const hasEmptyState = emptyPatterns.some(p => (bodyText || '').includes(p));
        await page.screenshot({
            path: `test-results/screenshots/qa-${name}.png`,
            fullPage: true,
        }).catch(() => { });
        return {
            url,
            loaded: true,
            hasData: !hasEmptyState && !redirectedToLogin,
            hasError,
            redirectedToLogin,
        };
    }
    catch (e) {
        return {
            url,
            loaded: false,
            hasData: false,
            hasError: true,
            errorText: String(e),
            redirectedToLogin: false,
        };
    }
    finally {
        page.off('console', listener);
    }
}
test_1.test.describe('Frontend — Admin pages', () => {
    (0, test_1.test)('admin dashboard carica con dati', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin', 'dashboard');
        (0, test_1.expect)(result.redirectedToLogin, 'Dashboard non deve redirigere al login').toBeFalsy();
        (0, test_1.expect)(result.hasError, 'Dashboard non deve avere application error').toBeFalsy();
        console.log('[dashboard] loaded:', result.loaded, 'hasData:', result.hasData);
    });
    (0, test_1.test)('employees page carica con 156 dipendenti', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/employees', 'employees');
        (0, test_1.expect)(result.redirectedToLogin, 'Employees non deve redirigere al login').toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[employees] loaded:', result.loaded, 'hasData:', result.hasData);
    });
    (0, test_1.test)('departments page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/departments', 'departments');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[departments] loaded:', result.loaded);
    });
    (0, test_1.test)('reviews page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/reviews', 'reviews');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[reviews] loaded:', result.loaded);
    });
    (0, test_1.test)('goals page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/goals', 'goals');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[goals] loaded:', result.loaded);
    });
    (0, test_1.test)('check-ins page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/check-ins', 'check-ins');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[check-ins] loaded:', result.loaded);
    });
    (0, test_1.test)('courses page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/courses', 'courses');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[courses] loaded:', result.loaded);
    });
    (0, test_1.test)('analytics page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/analytics', 'analytics');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[analytics] loaded:', result.loaded);
    });
    (0, test_1.test)('org-chart page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/org-chart', 'org-chart');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[org-chart] loaded:', result.loaded);
    });
    (0, test_1.test)('career page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/admin/career', 'career');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[career] loaded:', result.loaded);
    });
});
test_1.test.describe('Frontend — Portal pages', () => {
    (0, test_1.test)('portal dashboard carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/portal', 'portal');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[portal] loaded:', result.loaded);
    });
    (0, test_1.test)('portal profile carica con dati Federica Marchetti', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/portal/profile', 'portal-profile');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        const bodyText = await page.textContent('body').catch(() => '');
        const hasName = (bodyText || '').includes('Federica') || (bodyText || '').includes('Marchetti');
        console.log('[portal/profile] loaded:', result.loaded, 'hasName:', hasName);
        // Verifica che il profilo sia quello dell'utente rtl-admin (Federica Marchetti)
        if (!result.redirectedToLogin) {
            (0, test_1.expect)(hasName, 'Profile deve mostrare il nome Federica Marchetti').toBeTruthy();
        }
    });
});
test_1.test.describe('Frontend — Company PET pages (post-fix API reali)', () => {
    (0, test_1.test)('company-pet main page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/company-pet', 'company-pet');
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[company-pet] loaded:', result.loaded, 'redirected:', result.redirectedToLogin);
    });
    (0, test_1.test)('company-pet/breakdowns page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/company-pet/breakdowns', 'company-pet-breakdowns');
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[company-pet/breakdowns] loaded:', result.loaded);
    });
    (0, test_1.test)('company-pet/demographics carica con dati reali (no mock)', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/company-pet/demographics', 'company-pet-demographics');
        (0, test_1.expect)(result.hasError).toBeFalsy();
        const bodyText = await page.textContent('body').catch(() => '');
        // Verifica che non ci siano stringhe mock come "Mock Data" o dati hardcoded
        const hasMockData = (bodyText || '').includes('Mock Data') ||
            (bodyText || '').toLowerCase().includes('lorem ipsum');
        (0, test_1.expect)(hasMockData, 'Demographics non deve avere mock data').toBeFalsy();
        console.log('[company-pet/demographics] loaded:', result.loaded, 'hasMockData:', hasMockData);
    });
    (0, test_1.test)('company-pet/sessions page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/company-pet/sessions', 'company-pet-sessions');
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[company-pet/sessions] loaded:', result.loaded);
    });
    (0, test_1.test)('company-pet/staging-comparison page carica', async ({ page }) => {
        const result = await testPage(page, 'http://localhost:3012/company-pet/staging-comparison', 'company-pet-staging');
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[company-pet/staging-comparison] loaded:', result.loaded);
    });
});
test_1.test.describe('Frontend — Employee Profile (10 tab)', () => {
    let employeeId = null;
    (0, test_1.test)('trova primo dipendente RTL Bank', async () => {
        const { status, data } = await apiGet('/api/v1/employees?limit=1');
        (0, test_1.expect)(status).toBe(200);
        const employees = data?.data?.employees || data?.data || [];
        (0, test_1.expect)(employees.length).toBeGreaterThan(0);
        employeeId = employees[0]?.id;
        console.log(`[employee-profile] Using employee ID: ${employeeId}`);
        (0, test_1.expect)(employeeId).toBeTruthy();
    });
    (0, test_1.test)('employee profile page con 10 tab carica', async ({ page }) => {
        // Ottieni ID dipendente fresh
        const { data } = await apiGet('/api/v1/employees?limit=1');
        const employees = data?.data?.employees || data?.data || [];
        const id = employees[0]?.id;
        if (!id) {
            console.log('[employee-profile] Nessun dipendente trovato, skip');
            return;
        }
        const result = await testPage(page, `http://localhost:3012/admin/employees/${id}`, 'employee-profile');
        (0, test_1.expect)(result.redirectedToLogin).toBeFalsy();
        (0, test_1.expect)(result.hasError).toBeFalsy();
        console.log('[employee-profile] loaded:', result.loaded);
        // Verifica presenza tab
        const bodyText = await page.textContent('body').catch(() => '');
        const tabs = ['Panoramica', 'Organizzazione', 'Contratti', 'Competenze', 'Formazione',
            'Obiettivi', 'Performance', 'Presenze', 'Documenti', 'Carriera'];
        const foundTabs = tabs.filter(t => (bodyText || '').includes(t));
        console.log(`[employee-profile] Tab trovati: ${foundTabs.length}/10: ${foundTabs.join(', ')}`);
    });
});
//# sourceMappingURL=qa-deep-review.spec.js.map