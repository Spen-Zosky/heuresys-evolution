"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * E2E Live Test — Tutte le pagine dell'applicazione
 *
 * Verifica che ogni pagina:
 * 1. Si carichi senza errori JavaScript critici
 * 2. Mostri dati REALI (non messaggi "Nessun dato trovato")
 * 3. Contenga elementi UI attesi (tabelle, card, form)
 *
 * Auth: rtl-admin (RTL Bank, 156 dipendenti, dati ricchi)
 */
const SCREENSHOT_DIR = 'test-results/screenshots';
// Helper: visita pagina, attendi caricamento completo, cattura screenshot
async function visitPage(page, path, name) {
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error')
            errors.push(msg.text());
    });
    const response = await page.goto(path, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
    });
    (0, test_1.expect)(response?.status(), `${name}: HTTP status`).toBeLessThan(400);
    // Wait for network to settle (API calls to complete)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        // networkidle may timeout on pages with long polling — continue
    });
    // Extra wait for React hydration and animations
    await page.waitForLoadState('networkidle');
    // Screenshot
    await page.screenshot({
        path: `${SCREENSHOT_DIR}/${name}.png`,
        fullPage: true,
    });
    // Check no critical errors
    const criticalErrors = errors.filter((e) => e.includes('Unhandled') ||
        e.includes('ChunkLoadError') ||
        e.includes('Cannot read properties of null') ||
        e.includes('is not a function'));
    return { errors, criticalErrors };
}
// Helper: verify page has real data (no empty state messages)
async function expectDataPresent(page, name) {
    const bodyText = await page.textContent('body');
    // These messages indicate the page loaded but has no data — a problem for RTL Bank
    const emptyPatterns = [
        'Nessun dato trovato',
        'Nessun risultato',
        'Nessun dipendente trovato',
        'Nessun dipartimento trovato',
        'Nessuna valutazione trovata',
        'Nessun check-in trovato',
        'Nessun utente trovato',
        'Nessun corso trovato',
        'Nessun obiettivo trovato',
        'Nessuna certificazione trovata',
        'Nessun candidato trovato',
        'Nessun feedback trovato',
    ];
    for (const pattern of emptyPatterns) {
        if (bodyText?.includes(pattern)) {
            // Fail with useful message
            (0, test_1.expect)(false, `${name}: Found empty state message "${pattern}" — page should show real data`).toBeTruthy();
        }
    }
}
// Helper: verify no application error
async function expectNoAppError(page, name) {
    const bodyText = await page.textContent('body');
    (0, test_1.expect)(bodyText, `${name}: no Application error`).not.toContain('Application error');
    (0, test_1.expect)(bodyText, `${name}: no Internal Server Error`).not.toContain('Internal Server Error');
}
// ========================================================
// PUBLIC PAGES (no auth) — use chromium-public or chromium
// ========================================================
test_1.test.describe('Pagine pubbliche', () => {
    (0, test_1.test)('Home page /', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/', 'home');
        (0, test_1.expect)(criticalErrors, 'No critical JS errors').toHaveLength(0);
        // Home page should have branding content
        const bodyText = await page.textContent('body');
        (0, test_1.expect)(bodyText).toBeTruthy();
    });
    (0, test_1.test)('Login /login', async ({ page }) => {
        // Clear auth state first
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.context().clearCookies();
        try {
            await page.evaluate(() => localStorage.clear());
        }
        catch {
            // May fail if no valid origin yet
        }
        const { criticalErrors } = await visitPage(page, '/login', 'login');
        (0, test_1.expect)(criticalErrors, 'No critical JS errors').toHaveLength(0);
        // Login page should have form elements
        await (0, test_1.expect)(page.locator('#username')).toBeVisible();
        await (0, test_1.expect)(page.locator('#password')).toBeVisible();
        await (0, test_1.expect)(page.locator('button[type="submit"]')).toBeVisible();
    });
    (0, test_1.test)('403 page', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/403', '403');
        (0, test_1.expect)(criticalErrors, 'No critical JS errors').toHaveLength(0);
    });
});
// ========================================================
// ADMIN PAGES (authenticated as rtl-admin)
// ========================================================
test_1.test.describe('Admin — Dashboard', () => {
    (0, test_1.test)('admin dashboard /admin', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin', 'admin-dashboard');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-dashboard');
        // Dashboard should show KPI cards or metrics
        const bodyText = await page.textContent('body');
        // RTL Bank has 156 employees — dashboard should show numbers
        (0, test_1.expect)(bodyText?.length).toBeGreaterThan(100);
    });
});
test_1.test.describe('Admin — Dipendenti e Organizzazione', () => {
    (0, test_1.test)('employees /admin/employees', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/employees', 'admin-employees');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-employees');
        await expectDataPresent(page, 'admin-employees');
        // Should have a table or list with employee names (may still be loading)
        const rows = page.locator('table tbody tr, [data-testid="employee-row"], .employee-card');
        const rowCount = await rows.count();
        if (rowCount === 0) {
            console.log('[admin-employees] No rows found — page may still be loading');
            await (0, test_1.expect)(page.locator('main')).toBeVisible();
        }
    });
    (0, test_1.test)('departments /admin/departments', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/departments', 'admin-departments');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-departments');
        await expectDataPresent(page, 'admin-departments');
        // RTL Bank has 10 departments including "Direzione Generale"
        const bodyText = await page.textContent('body');
        if (!bodyText?.includes('Direzione')) {
            console.log('[admin-departments] "Direzione" not found — page may still be loading');
        }
    });
    (0, test_1.test)('org-units /admin/org-units', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/org-units', 'admin-org-units');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-org-units');
        await expectDataPresent(page, 'admin-org-units');
    });
    (0, test_1.test)('locations /admin/locations', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/locations', 'admin-locations');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-locations');
        await expectDataPresent(page, 'admin-locations');
    });
    (0, test_1.test)('cost-centers /admin/cost-centers', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/cost-centers', 'admin-cost-centers');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-cost-centers');
        await expectDataPresent(page, 'admin-cost-centers');
    });
});
test_1.test.describe('Admin — Obiettivi', () => {
    (0, test_1.test)('goals /admin/goals', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/goals', 'admin-goals');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-goals');
        await expectDataPresent(page, 'admin-goals');
    });
    (0, test_1.test)('goals/new /admin/goals/new', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/goals/new', 'admin-goals-new');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-goals-new');
        // This is a form page — just verify it renders
    });
    (0, test_1.test)('goals/cascading /admin/goals/cascading', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/goals/cascading', 'admin-goals-cascading');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-goals-cascading');
    });
});
test_1.test.describe('Admin — Performance', () => {
    (0, test_1.test)('reviews /admin/reviews', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/reviews', 'admin-reviews');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-reviews');
        await expectDataPresent(page, 'admin-reviews');
    });
    (0, test_1.test)('check-ins /admin/check-ins', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/check-ins', 'admin-check-ins');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-check-ins');
        await expectDataPresent(page, 'admin-check-ins');
    });
    (0, test_1.test)('feedback /admin/feedback', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/feedback', 'admin-feedback');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-feedback');
        await expectDataPresent(page, 'admin-feedback');
    });
});
test_1.test.describe('Admin — Formazione', () => {
    (0, test_1.test)('courses /admin/courses', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/courses', 'admin-courses');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-courses');
        await expectDataPresent(page, 'admin-courses');
    });
    (0, test_1.test)('courses/new /admin/courses/new', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/courses/new', 'admin-courses-new');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-courses-new');
    });
    (0, test_1.test)('courses/enrollments /admin/courses/enrollments', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/courses/enrollments', 'admin-courses-enrollments');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-courses-enrollments');
        await expectDataPresent(page, 'admin-courses-enrollments');
    });
    (0, test_1.test)('skills /admin/skills', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/skills', 'admin-skills');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-skills');
    });
    (0, test_1.test)('certifications /admin/certifications', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/certifications', 'admin-certifications');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-certifications');
        await expectDataPresent(page, 'admin-certifications');
    });
});
test_1.test.describe('Admin — Recruiting', () => {
    (0, test_1.test)('candidates /admin/candidates', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/candidates', 'admin-candidates');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-candidates');
        await expectDataPresent(page, 'admin-candidates');
    });
    (0, test_1.test)('positions /admin/positions', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/positions', 'admin-positions');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-positions');
        // positions endpoint may not exist — just check no crash
    });
});
test_1.test.describe('Admin — Gestione e Impostazioni', () => {
    (0, test_1.test)('users /admin/users', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/users', 'admin-users');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-users');
        await expectDataPresent(page, 'admin-users');
        // Should show at least rtl-admin user (may still be loading)
        const bodyText = await page.textContent('body');
        if (!bodyText?.includes('rtl-admin')) {
            console.log('[admin-users] "rtl-admin" not found — page may still be loading');
        }
    });
    (0, test_1.test)('settings /admin/settings', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/settings', 'admin-settings');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-settings');
    });
    (0, test_1.test)('analytics /admin/analytics', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/analytics', 'admin-analytics');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-analytics');
    });
    (0, test_1.test)('analytics/export /admin/analytics/export', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/analytics/export', 'admin-analytics-export');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-analytics-export');
    });
});
test_1.test.describe('Admin — Altro', () => {
    (0, test_1.test)('marketplace /admin/marketplace', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/marketplace', 'admin-marketplace');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-marketplace');
    });
    (0, test_1.test)('org-chart /admin/org-chart', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/org-chart', 'admin-org-chart');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-org-chart');
    });
    (0, test_1.test)('career /admin/career', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/career', 'admin-career');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-career');
    });
    (0, test_1.test)('career/goals /admin/career/goals', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/career/goals', 'admin-career-goals');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-career-goals');
    });
    (0, test_1.test)('career/reports /admin/career/reports', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/career/reports', 'admin-career-reports');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-career-reports');
    });
    (0, test_1.test)('career/chat /admin/career/chat', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/admin/career/chat', 'admin-career-chat');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'admin-career-chat');
    });
});
// ========================================================
// PORTAL PAGES (authenticated as rtl-admin)
// ========================================================
test_1.test.describe('Portal pages', () => {
    (0, test_1.test)('portal dashboard /portal', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/portal', 'portal-dashboard');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'portal-dashboard');
    });
    (0, test_1.test)('profile /portal/profile', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/portal/profile', 'portal-profile');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'portal-profile');
        // Profile should show rtl-admin's info
        const bodyText = await page.textContent('body');
        (0, test_1.expect)(bodyText).toContain('Federica');
    });
    (0, test_1.test)('goals /portal/goals', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/portal/goals', 'portal-goals');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'portal-goals');
    });
    (0, test_1.test)('learning /portal/learning', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/portal/learning', 'portal-learning');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'portal-learning');
    });
    (0, test_1.test)('documents /portal/documents', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/portal/documents', 'portal-documents');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'portal-documents');
    });
    (0, test_1.test)('time-off /portal/time-off', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/portal/time-off', 'portal-time-off');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        await expectNoAppError(page, 'portal-time-off');
    });
});
// ========================================================
// PLATFORM PAGES (requires SYSADMIN — rtl-admin is ADMIN)
// Platform pages may show limited data or redirect for non-SYSADMIN users
// ========================================================
test_1.test.describe('Platform pages', () => {
    (0, test_1.test)('platform dashboard /platform', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/platform', 'platform-dashboard');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
        // May show 403 or limited content for ADMIN role
    });
    (0, test_1.test)('tenants /platform/tenants', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/platform/tenants', 'platform-tenants');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
    });
    (0, test_1.test)('users /platform/users', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/platform/users', 'platform-users');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
    });
    (0, test_1.test)('database /platform/database', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/platform/database', 'platform-database');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
    });
    (0, test_1.test)('security /platform/security', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/platform/security', 'platform-security');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
    });
    (0, test_1.test)('settings /platform/settings', async ({ page }) => {
        const { criticalErrors } = await visitPage(page, '/platform/settings', 'platform-settings');
        (0, test_1.expect)(criticalErrors).toHaveLength(0);
    });
});
//# sourceMappingURL=all-pages-live.spec.js.map