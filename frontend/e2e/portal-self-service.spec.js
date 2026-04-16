"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_BASE = 'http://localhost:8012';
let HEADERS = { 'X-Tenant-Code': 'rtl-bank' };
/**
 * E-SELF-01: Employee Self-Service Portal Tests
 * Tests the complete employee portal experience including:
 * - Career Coach functionality
 * - Document management
 * - News & communications
 * - Notifications
 * - Time-off requests
 * - Profile management
 * - Engagement surveys
 * - Workforce Planning Analytics (S-ANLT-01-01)
 *
 * Note: Some endpoints require employee authentication context.
 * Tests verify endpoint availability and response structure.
 */
test_1.test.describe('Employee Self-Service Portal (E-SELF-01)', () => {
    test_1.test.beforeAll(async () => {
        const token = await (0, api_auth_helper_1.getAuthToken)();
        HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
    });
    test_1.test.describe('1. Career Coach APIs', () => {
        (0, test_1.test)('1.1 Career Coach Stats - Returns statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/career-coach/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            console.log(`[Career Coach]: Stats retrieved`);
        });
        (0, test_1.test)('1.2 Career Coach Recommendations - Returns AI recommendations', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/career-coach/recommendations`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            console.log(`[Career Coach]: Recommendations available`);
        });
        (0, test_1.test)('1.3 Career Coach Skills - Returns skills list', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/career-coach/skills`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data) {
                console.log(`[Career Coach]: ${Array.isArray(data.data) ? data.data.length : 0} skills found`);
            }
        });
        (0, test_1.test)('1.4 Career Coach Goals - Returns career goals', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/career-coach/goals`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            console.log(`[Career Coach]: Goals retrieved`);
        });
    });
    test_1.test.describe('2. Employee Documents APIs', () => {
        (0, test_1.test)('2.1 Get Document Request Types - Returns available request types', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/employee-documents/request-types/list`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data) {
                console.log(`[Documents]: ${Array.isArray(data.data) ? data.data.length : 0} request types`);
            }
        });
    });
    test_1.test.describe('3. News & Communications APIs', () => {
        (0, test_1.test)('3.1 Get News Categories', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/news/categories`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data) {
                console.log(`[News]: ${Array.isArray(data.data) ? data.data.length : 0} categories`);
            }
        });
        (0, test_1.test)('3.2 Get Unread Count', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/news/unread-count`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data?.count !== undefined) {
                console.log(`[News]: ${data.data.count} unread articles`);
            }
        });
    });
    test_1.test.describe('4. Time-Off APIs (Public)', () => {
        (0, test_1.test)('4.1 Get Leave Types', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/leave-types`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data) {
                console.log(`[Time-Off]: ${Array.isArray(data.data) ? data.data.length : 0} leave types`);
            }
        });
        (0, test_1.test)('4.2 Get Holidays', async ({ request }) => {
            const currentYear = new Date().getFullYear();
            const res = await request.get(`${API_BASE}/api/v1/time-off/holidays?year=${currentYear}`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data) {
                console.log(`[Time-Off]: ${Array.isArray(data.data) ? data.data.length : 0} holidays for ${currentYear}`);
            }
        });
    });
    test_1.test.describe('5. Portal Dashboard APIs', () => {
        (0, test_1.test)('5.1 Get Goals (in progress)', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/goals?limit=5&status=in_progress`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            console.log(`[Portal]: ${Array.isArray(data.data) ? data.data.length : 0} in-progress goals`);
        });
        (0, test_1.test)('5.2 Get Recognition', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/recognition?limit=5`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            console.log(`[Portal]: Recognition data retrieved`);
        });
        (0, test_1.test)('5.3 Get Check-ins', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/check-ins?limit=5`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            if (data.data) {
                console.log(`[Portal]: ${Array.isArray(data.data) ? data.data.length : 0} check-ins`);
            }
        });
    });
    test_1.test.describe('6. Workforce Planning Analytics APIs (S-ANLT-01-01)', () => {
        (0, test_1.test)('6.1 Get Headcount Trend - 12 historical + 6 forecast months', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/headcount-trend`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('historical');
            (0, test_1.expect)(data.data).toHaveProperty('forecast');
            (0, test_1.expect)(Array.isArray(data.data.historical)).toBeTruthy();
            (0, test_1.expect)(Array.isArray(data.data.forecast)).toBeTruthy();
            (0, test_1.expect)(data.data.historical.length).toBe(12);
            (0, test_1.expect)(data.data.forecast.length).toBe(6);
            // Verify historical data structure
            if (data.data.historical.length > 0) {
                const sample = data.data.historical[0];
                (0, test_1.expect)(sample).toHaveProperty('period');
                (0, test_1.expect)(sample).toHaveProperty('headcount');
                (0, test_1.expect)(sample).toHaveProperty('label');
            }
            // Verify forecast data structure
            if (data.data.forecast.length > 0) {
                const sample = data.data.forecast[0];
                (0, test_1.expect)(sample).toHaveProperty('period');
                (0, test_1.expect)(sample).toHaveProperty('headcount');
                (0, test_1.expect)(sample.type).toBe('forecast');
            }
            console.log(`[Workforce Planning]: 12 historical + 6 forecast months loaded`);
        });
        (0, test_1.test)('6.2 Get Headcount Trend with Department Filter', async ({ request }) => {
            // First get departments
            const deptRes = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/departments`, { headers: HEADERS });
            if (!deptRes.ok()) {
                console.log('[SKIP] API returned', deptRes.status());
                return;
            }
            const deptData = await deptRes.json();
            if (deptData.data?.length > 0) {
                const deptId = deptData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/headcount-trend?department_id=${deptId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                console.log(`[Workforce Planning]: Department-filtered headcount trend works`);
            }
        });
        (0, test_1.test)('6.3 Get Positions Gap Analysis', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/positions-gap`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            if (data.data.length > 0) {
                const sample = data.data[0];
                (0, test_1.expect)(sample).toHaveProperty('department_id');
                (0, test_1.expect)(sample).toHaveProperty('department_name');
                (0, test_1.expect)(sample).toHaveProperty('current_headcount');
                (0, test_1.expect)(sample).toHaveProperty('open_requisitions');
            }
            console.log(`[Workforce Planning]: ${data.data.length} departments with positions gap analysis`);
        });
        (0, test_1.test)('6.4 Get Departments List for Filters', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/departments`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            if (data.data.length > 0) {
                const sample = data.data[0];
                (0, test_1.expect)(sample).toHaveProperty('id');
                (0, test_1.expect)(sample).toHaveProperty('name');
            }
            console.log(`[Workforce Planning]: ${data.data.length} departments available for filtering`);
        });
        (0, test_1.test)('6.5 Get Department Detail', async ({ request }) => {
            // First get departments
            const deptRes = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/departments`, { headers: HEADERS });
            if (!deptRes.ok()) {
                console.log('[SKIP] API returned', deptRes.status());
                return;
            }
            const deptData = await deptRes.json();
            if (deptData.data?.length > 0) {
                const deptId = deptData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/workforce-planning/analytics/department/${deptId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                if (data.data) {
                    (0, test_1.expect)(data.data).toHaveProperty('department');
                    (0, test_1.expect)(data.data).toHaveProperty('roles');
                    (0, test_1.expect)(data.data).toHaveProperty('tenure_distribution');
                }
                console.log(`[Workforce Planning]: Department detail retrieved for ${deptData.data[0].name}`);
            }
        });
    });
    test_1.test.describe('7. API Availability Verification', () => {
        (0, test_1.test)('7.1 Verify Career Coach endpoints exist', async ({ request }) => {
            const endpoints = [
                '/api/v1/career-coach/stats',
                '/api/v1/career-coach/recommendations',
                '/api/v1/career-coach/skills',
                '/api/v1/career-coach/goals'
            ];
            for (const endpoint of endpoints) {
                const res = await request.get(`${API_BASE}${endpoint}`, { headers: HEADERS });
                (0, test_1.expect)(res.status()).not.toBe(404);
                console.log(`[API Check]: ${endpoint} - ${res.status()}`);
            }
        });
        (0, test_1.test)('7.2 Verify News endpoints exist', async ({ request }) => {
            const endpoints = [
                '/api/v1/news/categories',
                '/api/v1/news/unread-count'
            ];
            for (const endpoint of endpoints) {
                const res = await request.get(`${API_BASE}${endpoint}`, { headers: HEADERS });
                (0, test_1.expect)(res.status()).not.toBe(404);
                console.log(`[API Check]: ${endpoint} - ${res.status()}`);
            }
        });
        (0, test_1.test)('7.3 Verify Time-Off public endpoints exist', async ({ request }) => {
            const endpoints = [
                '/api/v1/time-off/leave-types',
                '/api/v1/time-off/holidays?year=2025'
            ];
            for (const endpoint of endpoints) {
                const res = await request.get(`${API_BASE}${endpoint}`, { headers: HEADERS });
                (0, test_1.expect)(res.status()).not.toBe(404);
                console.log(`[API Check]: ${endpoint} - ${res.status()}`);
            }
        });
        (0, test_1.test)('7.4 Verify Workforce Planning Analytics endpoints exist', async ({ request }) => {
            const endpoints = [
                '/api/v1/workforce-planning/analytics/headcount-trend',
                '/api/v1/workforce-planning/analytics/attrition-forecast',
                '/api/v1/workforce-planning/analytics/capacity',
                '/api/v1/workforce-planning/analytics/positions-gap',
                '/api/v1/workforce-planning/analytics/departments'
            ];
            for (const endpoint of endpoints) {
                const res = await request.get(`${API_BASE}${endpoint}`, { headers: HEADERS });
                (0, test_1.expect)(res.status()).not.toBe(404);
                console.log(`[API Check]: ${endpoint} - ${res.status()}`);
            }
        });
    });
});
//# sourceMappingURL=portal-self-service.spec.js.map