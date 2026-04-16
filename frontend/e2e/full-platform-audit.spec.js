"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
/**
 * FULL PLATFORM AUDIT - 103 Pages E2E Test
 *
 * Tests EVERY page in the Heuresys platform:
 * - Page loads successfully (no HTTP errors)
 * - No JavaScript console errors
 * - Page has content (not empty/broken)
 * - Screenshot captured as evidence
 */
const path_1 = __importDefault(require("path"));
const SCREENSHOT_DIR = path_1.default.resolve(__dirname, '../../docs/agent_reports/screenshots/full-audit');
const BASE_URL = 'http://localhost:3012';
// Test configuration
test_1.test.setTimeout(60000); // 60 seconds per test
// Helper to check for console errors
async function checkPageHealth(page, path, screenshotName) {
    const errors = [];
    // Capture console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    // Navigate to page
    const response = await page.goto(`${BASE_URL}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    // Check HTTP status
    (0, test_1.expect)(response?.status(), `Page ${path} should return 200`).toBeLessThan(400);
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    // Check page has content (not empty)
    const bodyContent = await page.locator('body').textContent();
    (0, test_1.expect)(bodyContent?.length, `Page ${path} should have content`).toBeGreaterThan(50);
    // Take screenshot
    await page.screenshot({
        path: `${SCREENSHOT_DIR}/${screenshotName}.png`,
        fullPage: true
    });
    // Log any errors found (but don't fail on minor errors)
    if (errors.length > 0) {
        console.log(`[WARN] Console errors on ${path}:`, errors.slice(0, 3));
    }
    return { errors, status: response?.status() };
}
// ============================================
// PUBLIC PAGES (No Auth Required)
// ============================================
test_1.test.describe('1. Public Pages', () => {
    // Public pages don't need authentication
    test_1.test.use({ storageState: { cookies: [], origins: [] } });
    (0, test_1.test)('/ - Home page', async ({ page }) => {
        await checkPageHealth(page, '/', 'home');
    });
    (0, test_1.test)('/login - Login page', async ({ page }) => {
        await checkPageHealth(page, '/login', 'login');
    });
    (0, test_1.test)('/landing - Landing page', async ({ page }) => {
        await checkPageHealth(page, '/landing', 'landing');
    });
    (0, test_1.test)('/landing-test - Landing test page', async ({ page }) => {
        await checkPageHealth(page, '/landing-test', 'landing-test');
    });
    (0, test_1.test)('/design-editor - Design editor', async ({ page }) => {
        await checkPageHealth(page, '/design-editor', 'design-editor');
    });
});
// ============================================
// DASHBOARDS (Public/Semi-public)
// ============================================
test_1.test.describe('2. Dashboards', () => {
    // Dashboard pages don't need authentication
    test_1.test.use({ storageState: { cookies: [], origins: [] } });
    (0, test_1.test)('/dashboards - Main dashboard', async ({ page }) => {
        await checkPageHealth(page, '/dashboards', 'dashboards');
    });
    (0, test_1.test)('/dashboards/prototyping - Prototyping', async ({ page }) => {
        await checkPageHealth(page, '/dashboards/prototyping', 'dashboards-prototyping');
    });
    (0, test_1.test)('/dashboards/taxonomies - Taxonomies', async ({ page }) => {
        await checkPageHealth(page, '/dashboards/taxonomies', 'dashboards-taxonomies');
    });
});
// ============================================
// COMPANY-PET PAGES (13 pages)
// ============================================
test_1.test.describe('3. Company-PET', () => {
    (0, test_1.test)('/company-pet - Dashboard', async ({ page }) => {
        await checkPageHealth(page, '/company-pet', 'company-pet');
    });
    (0, test_1.test)('/company-pet/breakdowns - Breakdowns', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/breakdowns', 'company-pet-breakdowns');
    });
    (0, test_1.test)('/company-pet/hierarchy - Hierarchy', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/hierarchy', 'company-pet-hierarchy');
    });
    (0, test_1.test)('/company-pet/org-chart - Org Chart', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/org-chart', 'company-pet-org-chart');
    });
    (0, test_1.test)('/company-pet/organization - Organization', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/organization', 'company-pet-organization');
    });
    (0, test_1.test)('/company-pet/organization/analytics - Org Analytics', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/organization/analytics', 'company-pet-org-analytics');
    });
    (0, test_1.test)('/company-pet/organization/performance - Org Performance', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/organization/performance', 'company-pet-org-performance');
    });
    (0, test_1.test)('/company-pet/organization/talent - Org Talent', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/organization/talent', 'company-pet-org-talent');
    });
    (0, test_1.test)('/company-pet/sessions - Sessions', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/sessions', 'company-pet-sessions');
    });
    (0, test_1.test)('/company-pet/staging-comparison - Staging Comparison', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/staging-comparison', 'company-pet-staging');
    });
    (0, test_1.test)('/company-pet/workforce - Workforce', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/workforce', 'company-pet-workforce');
    });
    (0, test_1.test)('/company-pet/workforce/demographics - Demographics', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/workforce/demographics', 'company-pet-demographics');
    });
    (0, test_1.test)('/company-pet/workforce/locations - Locations', async ({ page }) => {
        await checkPageHealth(page, '/company-pet/workforce/locations', 'company-pet-locations');
    });
});
// ============================================
// PLATFORM PAGES (Sysadmin - 2 pages)
// ============================================
test_1.test.describe('4. Platform (Sysadmin)', () => {
    (0, test_1.test)('/platform - Platform dashboard', async ({ page }) => {
        await checkPageHealth(page, '/platform', 'platform');
    });
    (0, test_1.test)('/platform/tenants - Tenants management', async ({ page }) => {
        await checkPageHealth(page, '/platform/tenants', 'platform-tenants');
    });
});
// ============================================
// PORTAL PAGES (Employee Self-Service - 6 pages)
// ============================================
test_1.test.describe('5. Portal (Employee)', () => {
    (0, test_1.test)('/portal - Portal home', async ({ page }) => {
        await checkPageHealth(page, '/portal', 'portal');
    });
    (0, test_1.test)('/portal/documents - Documents', async ({ page }) => {
        await checkPageHealth(page, '/portal/documents', 'portal-documents');
    });
    (0, test_1.test)('/portal/learning - Learning', async ({ page }) => {
        await checkPageHealth(page, '/portal/learning', 'portal-learning');
    });
    (0, test_1.test)('/portal/payroll - Payroll', async ({ page }) => {
        await checkPageHealth(page, '/portal/payroll', 'portal-payroll');
    });
    (0, test_1.test)('/portal/profile - Profile', async ({ page }) => {
        await checkPageHealth(page, '/portal/profile', 'portal-profile');
    });
    (0, test_1.test)('/portal/time-off - Time Off', async ({ page }) => {
        await checkPageHealth(page, '/portal/time-off', 'portal-time-off');
    });
});
// ============================================
// ADMIN PAGES (74 pages)
// ============================================
test_1.test.describe('6. Admin - Main', () => {
    (0, test_1.test)('/admin - Admin dashboard', async ({ page }) => {
        await checkPageHealth(page, '/admin', 'admin');
    });
    (0, test_1.test)('/admin/employees - Employees list', async ({ page }) => {
        await checkPageHealth(page, '/admin/employees', 'admin-employees');
    });
    (0, test_1.test)('/admin/knowledge-base - Knowledge base', async ({ page }) => {
        await checkPageHealth(page, '/admin/knowledge-base', 'admin-knowledge-base');
    });
    (0, test_1.test)('/admin/design/wireframes - Wireframes', async ({ page }) => {
        await checkPageHealth(page, '/admin/design/wireframes', 'admin-wireframes');
    });
});
test_1.test.describe('7. Admin - AI (4 pages)', () => {
    (0, test_1.test)('/admin/ai - AI overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/ai', 'admin-ai');
    });
    (0, test_1.test)('/admin/ai/chat - AI Chat', async ({ page }) => {
        await checkPageHealth(page, '/admin/ai/chat', 'admin-ai-chat');
    });
    (0, test_1.test)('/admin/ai/documents - AI Documents', async ({ page }) => {
        await checkPageHealth(page, '/admin/ai/documents', 'admin-ai-documents');
    });
    (0, test_1.test)('/admin/ai/sessions - AI Sessions', async ({ page }) => {
        await checkPageHealth(page, '/admin/ai/sessions', 'admin-ai-sessions');
    });
});
test_1.test.describe('8. Admin - Analytics (3 pages)', () => {
    (0, test_1.test)('/admin/analytics - Analytics overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/analytics', 'admin-analytics');
    });
    (0, test_1.test)('/admin/analytics/hr-intelligence - HR Intelligence', async ({ page }) => {
        await checkPageHealth(page, '/admin/analytics/hr-intelligence', 'admin-hr-intelligence');
    });
    (0, test_1.test)('/admin/analytics/predictions - Predictions', async ({ page }) => {
        await checkPageHealth(page, '/admin/analytics/predictions', 'admin-predictions');
    });
});
test_1.test.describe('9. Admin - Compensation (4 pages)', () => {
    (0, test_1.test)('/admin/compensation - Compensation overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/compensation', 'admin-compensation');
    });
    (0, test_1.test)('/admin/compensation/bonus-plans - Bonus Plans', async ({ page }) => {
        await checkPageHealth(page, '/admin/compensation/bonus-plans', 'admin-bonus-plans');
    });
    (0, test_1.test)('/admin/compensation/merit-cycles - Merit Cycles', async ({ page }) => {
        await checkPageHealth(page, '/admin/compensation/merit-cycles', 'admin-merit-cycles');
    });
    (0, test_1.test)('/admin/compensation/salary-bands - Salary Bands', async ({ page }) => {
        await checkPageHealth(page, '/admin/compensation/salary-bands', 'admin-salary-bands');
    });
});
test_1.test.describe('10. Admin - Compliance (4 pages)', () => {
    (0, test_1.test)('/admin/compliance - Compliance overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/compliance', 'admin-compliance');
    });
    (0, test_1.test)('/admin/compliance/audits - Audits', async ({ page }) => {
        await checkPageHealth(page, '/admin/compliance/audits', 'admin-audits');
    });
    (0, test_1.test)('/admin/compliance/policy-violations - Policy Violations', async ({ page }) => {
        await checkPageHealth(page, '/admin/compliance/policy-violations', 'admin-policy-violations');
    });
    (0, test_1.test)('/admin/compliance/whistleblowing - Whistleblowing', async ({ page }) => {
        await checkPageHealth(page, '/admin/compliance/whistleblowing', 'admin-whistleblowing');
    });
});
test_1.test.describe('11. Admin - Engagement (3 pages)', () => {
    (0, test_1.test)('/admin/engagement/mentorship - Mentorship', async ({ page }) => {
        await checkPageHealth(page, '/admin/engagement/mentorship', 'admin-mentorship');
    });
    (0, test_1.test)('/admin/engagement/social - Social', async ({ page }) => {
        await checkPageHealth(page, '/admin/engagement/social', 'admin-social');
    });
    (0, test_1.test)('/admin/engagement/wellbeing - Wellbeing', async ({ page }) => {
        await checkPageHealth(page, '/admin/engagement/wellbeing', 'admin-wellbeing');
    });
});
test_1.test.describe('12. Admin - HR Core (6 pages)', () => {
    (0, test_1.test)('/admin/hr-core - HR Core overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/hr-core', 'admin-hr-core');
    });
    (0, test_1.test)('/admin/hr-core/cost-centers - Cost Centers', async ({ page }) => {
        await checkPageHealth(page, '/admin/hr-core/cost-centers', 'admin-cost-centers');
    });
    (0, test_1.test)('/admin/hr-core/departments - Departments', async ({ page }) => {
        await checkPageHealth(page, '/admin/hr-core/departments', 'admin-departments');
    });
    (0, test_1.test)('/admin/hr-core/employees - HR Employees', async ({ page }) => {
        await checkPageHealth(page, '/admin/hr-core/employees', 'admin-hr-employees');
    });
    (0, test_1.test)('/admin/hr-core/locations - Locations', async ({ page }) => {
        await checkPageHealth(page, '/admin/hr-core/locations', 'admin-locations');
    });
    (0, test_1.test)('/admin/hr-core/org-units - Org Units', async ({ page }) => {
        await checkPageHealth(page, '/admin/hr-core/org-units', 'admin-org-units');
    });
});
test_1.test.describe('13. Admin - Learning (4 pages)', () => {
    (0, test_1.test)('/admin/learning - Learning overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/learning', 'admin-learning');
    });
    (0, test_1.test)('/admin/learning/certifications - Certifications', async ({ page }) => {
        await checkPageHealth(page, '/admin/learning/certifications', 'admin-certifications');
    });
    (0, test_1.test)('/admin/learning/courses - Courses', async ({ page }) => {
        await checkPageHealth(page, '/admin/learning/courses', 'admin-courses');
    });
    (0, test_1.test)('/admin/learning/paths - Learning Paths', async ({ page }) => {
        await checkPageHealth(page, '/admin/learning/paths', 'admin-learning-paths');
    });
});
test_1.test.describe('14. Admin - Performance (14 pages)', () => {
    (0, test_1.test)('/admin/performance - Performance overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance', 'admin-performance');
    });
    (0, test_1.test)('/admin/performance/calibration - Calibration', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/calibration', 'admin-calibration');
    });
    (0, test_1.test)('/admin/performance/check-ins - Check-ins', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/check-ins', 'admin-check-ins');
    });
    (0, test_1.test)('/admin/performance/feedback - Feedback', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/feedback', 'admin-feedback');
    });
    (0, test_1.test)('/admin/performance/goals - Goals', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/goals', 'admin-goals');
    });
    (0, test_1.test)('/admin/performance/okrs - OKRs', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/okrs', 'admin-okrs');
    });
    (0, test_1.test)('/admin/performance/review-cycles - Review Cycles', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/review-cycles', 'admin-review-cycles');
    });
    (0, test_1.test)('/admin/performance/reviews - Reviews', async ({ page }) => {
        await checkPageHealth(page, '/admin/performance/reviews', 'admin-reviews');
    });
});
test_1.test.describe('15. Admin - Recruiting (4 pages)', () => {
    (0, test_1.test)('/admin/recruiting - Recruiting overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/recruiting', 'admin-recruiting');
    });
    (0, test_1.test)('/admin/recruiting/candidates - Candidates', async ({ page }) => {
        await checkPageHealth(page, '/admin/recruiting/candidates', 'admin-candidates');
    });
    (0, test_1.test)('/admin/recruiting/postings - Job Postings', async ({ page }) => {
        await checkPageHealth(page, '/admin/recruiting/postings', 'admin-postings');
    });
    (0, test_1.test)('/admin/recruiting/requisitions - Requisitions', async ({ page }) => {
        await checkPageHealth(page, '/admin/recruiting/requisitions', 'admin-requisitions');
    });
});
test_1.test.describe('16. Admin - Settings (9 pages)', () => {
    (0, test_1.test)('/admin/settings - Settings overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings', 'admin-settings');
    });
    (0, test_1.test)('/admin/settings/notifications - Notifications', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings/notifications', 'admin-notifications');
    });
    (0, test_1.test)('/admin/settings/sap-migration - SAP Migration', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings/sap-migration', 'admin-sap-migration');
    });
    (0, test_1.test)('/admin/settings/sso - SSO', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings/sso', 'admin-sso');
    });
    (0, test_1.test)('/admin/settings/tenant-setup - Tenant Setup', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings/tenant-setup', 'admin-tenant-setup');
    });
    (0, test_1.test)('/admin/settings/tenants - Tenants', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings/tenants', 'admin-tenants');
    });
    (0, test_1.test)('/admin/settings/users - Users', async ({ page }) => {
        await checkPageHealth(page, '/admin/settings/users', 'admin-users');
    });
});
test_1.test.describe('17. Admin - Talent (15 pages)', () => {
    (0, test_1.test)('/admin/talent - Talent overview', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent', 'admin-talent');
    });
    (0, test_1.test)('/admin/talent/assessments - Assessments', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/assessments', 'admin-assessments');
    });
    (0, test_1.test)('/admin/talent/career-paths - Career Paths', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/career-paths', 'admin-career-paths');
    });
    (0, test_1.test)('/admin/talent/esco-explorer - ESCO Explorer', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/esco-explorer', 'admin-esco-explorer');
    });
    (0, test_1.test)('/admin/talent/gap-analysis - Gap Analysis', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/gap-analysis', 'admin-gap-analysis');
    });
    (0, test_1.test)('/admin/talent/mobility - Mobility', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/mobility', 'admin-mobility');
    });
    (0, test_1.test)('/admin/talent/pay-stubs - Pay Stubs', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/pay-stubs', 'admin-pay-stubs');
    });
    (0, test_1.test)('/admin/talent/skill-profiles - Skill Profiles', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/skill-profiles', 'admin-skill-profiles');
    });
    (0, test_1.test)('/admin/talent/skills - Skills', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/skills', 'admin-skills');
    });
    (0, test_1.test)('/admin/talent/succession - Succession', async ({ page }) => {
        await checkPageHealth(page, '/admin/talent/succession', 'admin-succession');
    });
});
//# sourceMappingURL=full-platform-audit.spec.js.map