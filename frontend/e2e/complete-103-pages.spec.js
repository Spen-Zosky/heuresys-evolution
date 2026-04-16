"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * COMPLETE 103 PAGES AUDIT
 * Tests ALL pages including dynamic [id] routes with real database IDs
 * Uses sysadmin authentication for protected pages
 */
const BASE_URL = 'http://localhost:3012';
const API_URL = 'http://localhost:8012';
// Real IDs from database
const REAL_IDS = {
    calibration: 'b41adc15-5416-4222-a656-1243c26ce760',
    feedback: 'c98fa097-fabe-4493-986f-14a42e1bf683',
    goal: '0771eb20-cb23-4e98-9f21-74c8dec3bd5f',
    okr: '39deed5f-b1e1-4746-b63b-2fa820d8f69a',
    reviewCycle: 'ce3a39bd-0e79-46cb-8070-14d1ffa1958e',
    review: '4b4d5680-fd83-449f-a162-c9cd1af4c8b6',
    tenant: 'd5855519-3ed1-4427-865f-fe75f1e42c4c',
    user: '255d0c4f-da3d-418f-b440-85c563736489',
    careerPath: '33165e3c-d1c9-4958-a19b-28efac9db33e',
    gapAnalysis: '2e752d05-3170-4a2b-bfdc-a4a0c020ce7c',
    skillProfile: 'd9d42fcf-e69e-4470-a8f3-fe3c42c84f34',
    skill: '37800bb3-4fbc-4786-9e3d-9266bb61f20e',
    succession: null // No data in table
};
test_1.test.setTimeout(120000);
// Login helper
async function loginAsSysadmin(page) {
    try {
        const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
            data: {
                username: 'sysadmin',
                password: 'Admin2026'
            }
        });
        if (response.ok()) {
            const data = await response.json();
            return data.data?.token || data.token || null;
        }
        return null;
    }
    catch {
        return null;
    }
}
// Page check helper
async function checkPage(page, path, token) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            // Filter out expected auth errors for pages that need auth
            if (!text.includes('401') && !text.includes('Failed to load resource')) {
                errors.push(text);
            }
        }
    });
    // Set auth token if available
    if (token) {
        await page.evaluate((t) => {
            localStorage.setItem('heuresys_token', t);
        }, token);
    }
    const response = await page.goto(`${BASE_URL}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    await page.waitForLoadState('networkidle');
    const bodyContent = await page.locator('body').textContent();
    const hasContent = (bodyContent?.length || 0) > 50;
    return {
        status: response?.status() || 0,
        errors,
        hasContent
    };
}
// ============================================
// ALL 103 PAGES TEST
// ============================================
test_1.test.describe('Complete 103 Pages Audit', () => {
    let authToken = null;
    test_1.test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        authToken = await loginAsSysadmin(page);
        console.log('Auth token obtained:', authToken ? 'YES' : 'NO');
        await context.close();
    });
    // ============ PUBLIC PAGES (5) ============
    test_1.test.describe('Public Pages (5)', () => {
        (0, test_1.test)('/ - Home', async ({ page }) => {
            const result = await checkPage(page, '/', null);
            (0, test_1.expect)(result.status).toBeLessThan(400);
            (0, test_1.expect)(result.hasContent).toBe(true);
        });
        (0, test_1.test)('/login - Login', async ({ page }) => {
            const result = await checkPage(page, '/login', null);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/landing - Landing', async ({ page }) => {
            const result = await checkPage(page, '/landing', null);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/landing-test - Landing Test', async ({ page }) => {
            const result = await checkPage(page, '/landing-test', null);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/design-editor - Design Editor', async ({ page }) => {
            const result = await checkPage(page, '/design-editor', null);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
    });
    // ============ DASHBOARDS (3) ============
    test_1.test.describe('Dashboards (3)', () => {
        (0, test_1.test)('/dashboards', async ({ page }) => {
            const result = await checkPage(page, '/dashboards', authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/dashboards/prototyping', async ({ page }) => {
            const result = await checkPage(page, '/dashboards/prototyping', authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/dashboards/taxonomies', async ({ page }) => {
            const result = await checkPage(page, '/dashboards/taxonomies', authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
    });
    // ============ COMPANY-PET (13) ============
    test_1.test.describe('Company-PET (13)', () => {
        const companyPetPages = [
            '/company-pet',
            '/company-pet/breakdowns',
            '/company-pet/hierarchy',
            '/company-pet/org-chart',
            '/company-pet/organization',
            '/company-pet/organization/analytics',
            '/company-pet/organization/performance',
            '/company-pet/organization/talent',
            '/company-pet/sessions',
            '/company-pet/staging-comparison',
            '/company-pet/workforce',
            '/company-pet/workforce/demographics',
            '/company-pet/workforce/locations'
        ];
        for (const path of companyPetPages) {
            (0, test_1.test)(path, async ({ page }) => {
                const result = await checkPage(page, path, authToken);
                (0, test_1.expect)(result.status).toBeLessThan(400);
            });
        }
    });
    // ============ PLATFORM (2) ============
    test_1.test.describe('Platform (2)', () => {
        (0, test_1.test)('/platform', async ({ page }) => {
            const result = await checkPage(page, '/platform', authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/platform/tenants', async ({ page }) => {
            const result = await checkPage(page, '/platform/tenants', authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
    });
    // ============ PORTAL (6) ============
    test_1.test.describe('Portal (6)', () => {
        const portalPages = [
            '/portal',
            '/portal/documents',
            '/portal/learning',
            '/portal/payroll',
            '/portal/profile',
            '/portal/time-off'
        ];
        for (const path of portalPages) {
            (0, test_1.test)(path, async ({ page }) => {
                const result = await checkPage(page, path, authToken);
                (0, test_1.expect)(result.status).toBeLessThan(400);
            });
        }
    });
    // ============ ADMIN STATIC PAGES (61) ============
    test_1.test.describe('Admin Static Pages (61)', () => {
        const adminPages = [
            '/admin',
            '/admin/ai',
            '/admin/ai/chat',
            '/admin/ai/documents',
            '/admin/ai/sessions',
            '/admin/analytics',
            '/admin/analytics/hr-intelligence',
            '/admin/analytics/predictions',
            '/admin/compensation',
            '/admin/compensation/bonus-plans',
            '/admin/compensation/merit-cycles',
            '/admin/compensation/salary-bands',
            '/admin/compliance',
            '/admin/compliance/audits',
            '/admin/compliance/policy-violations',
            '/admin/compliance/whistleblowing',
            '/admin/design/wireframes',
            '/admin/employees',
            '/admin/engagement/mentorship',
            '/admin/engagement/social',
            '/admin/engagement/wellbeing',
            '/admin/hr-core',
            '/admin/hr-core/cost-centers',
            '/admin/hr-core/departments',
            '/admin/hr-core/employees',
            '/admin/hr-core/locations',
            '/admin/hr-core/org-units',
            '/admin/knowledge-base',
            '/admin/learning',
            '/admin/learning/certifications',
            '/admin/learning/courses',
            '/admin/learning/paths',
            '/admin/performance',
            '/admin/performance/calibration',
            '/admin/performance/check-ins',
            '/admin/performance/feedback',
            '/admin/performance/goals',
            '/admin/performance/okrs',
            '/admin/performance/review-cycles',
            '/admin/performance/reviews',
            '/admin/recruiting',
            '/admin/recruiting/candidates',
            '/admin/recruiting/postings',
            '/admin/recruiting/requisitions',
            '/admin/settings',
            '/admin/settings/notifications',
            '/admin/settings/sap-migration',
            '/admin/settings/sso',
            '/admin/settings/tenant-setup',
            '/admin/settings/tenants',
            '/admin/settings/users',
            '/admin/talent',
            '/admin/talent/assessments',
            '/admin/talent/career-paths',
            '/admin/talent/esco-explorer',
            '/admin/talent/gap-analysis',
            '/admin/talent/mobility',
            '/admin/talent/pay-stubs',
            '/admin/talent/skill-profiles',
            '/admin/talent/skills',
            '/admin/talent/succession'
        ];
        for (const path of adminPages) {
            (0, test_1.test)(path, async ({ page }) => {
                const result = await checkPage(page, path, authToken);
                (0, test_1.expect)(result.status).toBeLessThan(400);
            });
        }
    });
    // ============ DYNAMIC [id] PAGES (13) ============
    test_1.test.describe('Dynamic [id] Pages (13)', () => {
        (0, test_1.test)('/admin/performance/calibration/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/performance/calibration/${REAL_IDS.calibration}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/performance/feedback/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/performance/feedback/${REAL_IDS.feedback}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/performance/goals/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/performance/goals/${REAL_IDS.goal}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/performance/okrs/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/performance/okrs/${REAL_IDS.okr}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/performance/review-cycles/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/performance/review-cycles/${REAL_IDS.reviewCycle}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/performance/reviews/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/performance/reviews/${REAL_IDS.review}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/settings/tenants/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/settings/tenants/${REAL_IDS.tenant}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/settings/users/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/settings/users/${REAL_IDS.user}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/talent/career-paths/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/talent/career-paths/${REAL_IDS.careerPath}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/talent/gap-analysis/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/talent/gap-analysis/${REAL_IDS.gapAnalysis}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/talent/skill-profiles/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/talent/skill-profiles/${REAL_IDS.skillProfile}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/talent/skills/[id]', async ({ page }) => {
            const result = await checkPage(page, `/admin/talent/skills/${REAL_IDS.skill}`, authToken);
            (0, test_1.expect)(result.status).toBeLessThan(400);
        });
        (0, test_1.test)('/admin/talent/succession/[id] - (no data, expect graceful handling)', async ({ page }) => {
            // succession_plans table is empty, test with a fake UUID to verify graceful 404 handling
            const result = await checkPage(page, '/admin/talent/succession/00000000-0000-0000-0000-000000000000', authToken);
            // Page should still load (may show "not found" message but shouldn't crash)
            (0, test_1.expect)(result.hasContent).toBe(true);
        });
    });
});
//# sourceMappingURL=complete-103-pages.spec.js.map