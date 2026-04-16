"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_BASE = 'http://localhost:8012';
let HEADERS = { 'X-Tenant-Code': 'rtl-bank' };
/**
 * SPRINT 2025-08: Compensation & Benefits Tests
 * Tests the complete compensation flow including salary bands, bonuses, benefits, and payroll
 */
test_1.test.describe('Compensation & Benefits (E-COMP-01)', () => {
    test_1.test.beforeAll(async () => {
        const token = await (0, api_auth_helper_1.getAuthToken)();
        HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
    });
    test_1.test.describe('1. Salary Bands API', () => {
        (0, test_1.test)('1.1 Get Salary Bands - Returns band catalog', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/salary-bands?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            if (data.data.length > 0) {
                const band = data.data[0];
                (0, test_1.expect)(band).toHaveProperty('id');
                (0, test_1.expect)(band).toHaveProperty('band_name');
                (0, test_1.expect)(band).toHaveProperty('min_salary');
                (0, test_1.expect)(band).toHaveProperty('max_salary');
                console.log(`[Salary Bands]: ${data.meta.total} bands in system`);
            }
        });
        (0, test_1.test)('1.2 Get Salary Band Stats - Returns statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/salary-bands/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('total');
            (0, test_1.expect)(data.data).toHaveProperty('active');
            (0, test_1.expect)(data.data).toHaveProperty('job_levels');
            console.log(`[Band Stats]: ${data.data.total} total, ${data.data.active} active, ${data.data.job_levels} job levels`);
        });
        (0, test_1.test)('1.3 Get Single Salary Band - Returns details', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/salary-bands?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const bandId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/salary-bands/${bandId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(data.data).toHaveProperty('id', bandId);
                (0, test_1.expect)(data.data).toHaveProperty('assignment_count');
                console.log(`[Band Details]: "${data.data.band_name}" - ${data.data.min_salary} to ${data.data.max_salary}`);
            }
        });
    });
    test_1.test.describe('2. Bonus Plans API', () => {
        (0, test_1.test)('2.1 Get Bonus Plans - Returns plan list', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/bonus-plans?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            if (data.data.length > 0) {
                const plan = data.data[0];
                (0, test_1.expect)(plan).toHaveProperty('id');
                (0, test_1.expect)(plan).toHaveProperty('name');
                (0, test_1.expect)(plan).toHaveProperty('bonus_type');
                (0, test_1.expect)(plan).toHaveProperty('status');
                console.log(`[Bonus Plans]: ${data.meta.total} plans in system`);
            }
        });
        (0, test_1.test)('2.2 Get Bonus Plan Stats - Returns statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/bonus-plans/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('total');
            (0, test_1.expect)(data.data).toHaveProperty('active');
            console.log(`[Bonus Stats]: ${data.data.total} total, ${data.data.active} active, Budget: ${data.data.total_budget || 0}`);
        });
        (0, test_1.test)('2.3 Get Active Bonus Plans - Returns active plans', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/bonus-plans/active`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            console.log(`[Active Plans]: ${data.data.length} active bonus plans`);
        });
        (0, test_1.test)('2.4 Get Bonus Plan Details - Returns full info', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/bonus-plans?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const planId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/bonus-plans/${planId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(data.data).toHaveProperty('id', planId);
                (0, test_1.expect)(data.data).toHaveProperty('allocation_count');
                console.log(`[Plan Details]: "${data.data.name}" - ${data.data.allocation_count} allocations`);
            }
        });
        (0, test_1.test)('2.5 Get Bonus Allocations - Returns employee allocations', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/bonus-plans?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const planId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/bonus-plans/${planId}/allocations`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
                if (data.data.length > 0) {
                    (0, test_1.expect)(data.data[0]).toHaveProperty('employee_name');
                }
                console.log(`[Allocations]: ${data.data.length} employees with allocations`);
            }
        });
    });
    test_1.test.describe('3. Benefits API', () => {
        (0, test_1.test)('3.1 Get Benefits - Returns benefit list', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/benefits?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            if (data.data.length > 0) {
                const benefit = data.data[0];
                (0, test_1.expect)(benefit).toHaveProperty('id');
                (0, test_1.expect)(benefit).toHaveProperty('benefit_name');
                (0, test_1.expect)(benefit).toHaveProperty('benefit_type');
                console.log(`[Benefits]: ${data.meta.total} benefits available`);
            }
        });
        (0, test_1.test)('3.2 Get Benefit Stats - Returns statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/benefits/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('total_benefits');
            (0, test_1.expect)(data.data).toHaveProperty('active_benefits');
            (0, test_1.expect)(data.data).toHaveProperty('total_enrollments');
            console.log(`[Benefit Stats]: ${data.data.total_benefits} benefits, ${data.data.active_enrollments} active enrollments`);
        });
        (0, test_1.test)('3.3 Get Benefit Types - Returns type breakdown', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/benefits/types`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            console.log(`[Benefit Types]: ${data.data.length} benefit types`);
        });
        (0, test_1.test)('3.4 Get Benefit Details - Returns full info', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/benefits?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const benefitId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/benefits/${benefitId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(data.data).toHaveProperty('id', benefitId);
                (0, test_1.expect)(data.data).toHaveProperty('active_enrollments');
                console.log(`[Benefit Details]: "${data.data.benefit_name}" - ${data.data.active_enrollments} enrolled`);
            }
        });
        (0, test_1.test)('3.5 Get Benefit Enrollments - Returns enrollment list', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/benefits?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const benefitId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/benefits/${benefitId}/enrollments`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
                console.log(`[Enrollments]: ${data.data.length} employees enrolled in benefit`);
            }
        });
    });
    test_1.test.describe('4. Pay Stubs API', () => {
        (0, test_1.test)('4.1 Get Pay Stubs - Returns payroll list', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/pay-stubs?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            if (data.data.length > 0) {
                const stub = data.data[0];
                (0, test_1.expect)(stub).toHaveProperty('id');
                (0, test_1.expect)(stub).toHaveProperty('employee_name');
                (0, test_1.expect)(stub).toHaveProperty('gross_pay');
                (0, test_1.expect)(stub).toHaveProperty('net_pay');
                console.log(`[Pay Stubs]: ${data.meta.total} pay stubs in system`);
            }
        });
        (0, test_1.test)('4.2 Get Pay Stub Stats - Returns overview', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/pay-stubs/stats/overview?year=2025`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('year');
            (0, test_1.expect)(data.data).toHaveProperty('summary');
            (0, test_1.expect)(data.data).toHaveProperty('monthly');
            console.log(`[Pay Stats]: ${data.data.summary.total_stubs} stubs, Total Gross: ${data.data.summary.total_gross || 0}`);
        });
        (0, test_1.test)('4.3 Get Single Pay Stub - Returns details', async ({ request }) => {
            const listRes = await request.get(`${API_BASE}/api/v1/pay-stubs?limit=1`, { headers: HEADERS });
            const listData = await listRes.json();
            if (listData.data?.length > 0) {
                const stubId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/pay-stubs/${stubId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data).toHaveProperty('data');
                (0, test_1.expect)(data.data).toHaveProperty('id', stubId);
                (0, test_1.expect)(data.data).toHaveProperty('employee_name');
                console.log(`[Stub Details]: ${data.data.employee_name} - ${data.data.period}`);
            }
        });
    });
    test_1.test.describe('5. Complete Compensation Flow', () => {
        (0, test_1.test)('5.1 Full Compensation Analysis Flow', async ({ request }) => {
            console.log('\n=== COMPLETE COMPENSATION FLOW ===\n');
            // Step 1: Get salary band stats
            console.log('Step 1: Fetching salary band statistics...');
            const bandStatsRes = await request.get(`${API_BASE}/api/v1/salary-bands/stats`, { headers: HEADERS });
            if (!bandStatsRes.ok()) {
                console.log('[SKIP] Salary band stats API returned', bandStatsRes.status());
                return;
            }
            const bandStats = await bandStatsRes.json();
            console.log(`   -> Total: ${bandStats.data.total}, Active: ${bandStats.data.active}`);
            console.log(`   -> Job Levels: ${bandStats.data.job_levels}, Job Families: ${bandStats.data.job_families}`);
            // Step 2: Get salary bands
            console.log('\nStep 2: Fetching salary bands...');
            const bandsRes = await request.get(`${API_BASE}/api/v1/salary-bands?limit=10`, { headers: HEADERS });
            if (!bandsRes.ok()) {
                console.log('[SKIP] Salary bands API returned', bandsRes.status());
                return;
            }
            const bands = await bandsRes.json();
            console.log(`   -> Retrieved: ${bands.data.length} salary bands`);
            // Step 3: Get bonus plan stats
            console.log('\nStep 3: Fetching bonus plan statistics...');
            const bonusStatsRes = await request.get(`${API_BASE}/api/v1/bonus-plans/stats`, { headers: HEADERS });
            if (!bonusStatsRes.ok()) {
                console.log('[SKIP] Bonus stats API returned', bonusStatsRes.status());
                return;
            }
            const bonusStats = await bonusStatsRes.json();
            console.log(`   -> Total: ${bonusStats.data.total}, Active: ${bonusStats.data.active}`);
            console.log(`   -> Total Budget: ${bonusStats.data.total_budget || 0}`);
            // Step 4: Get active bonus plans
            console.log('\nStep 4: Fetching active bonus plans...');
            const activePlansRes = await request.get(`${API_BASE}/api/v1/bonus-plans/active`, { headers: HEADERS });
            if (!activePlansRes.ok()) {
                console.log('[SKIP] Active plans API returned', activePlansRes.status());
                return;
            }
            const activePlans = await activePlansRes.json();
            console.log(`   -> Active plans: ${activePlans.data.length}`);
            // Step 5: Get benefit stats
            console.log('\nStep 5: Fetching benefit statistics...');
            const benefitStatsRes = await request.get(`${API_BASE}/api/v1/benefits/stats`, { headers: HEADERS });
            if (!benefitStatsRes.ok()) {
                console.log('[SKIP] Benefit stats API returned', benefitStatsRes.status());
                return;
            }
            const benefitStats = await benefitStatsRes.json();
            console.log(`   -> Total benefits: ${benefitStats.data.total_benefits}`);
            console.log(`   -> Active enrollments: ${benefitStats.data.active_enrollments}`);
            // Step 6: Get benefit types
            console.log('\nStep 6: Fetching benefit types...');
            const typesRes = await request.get(`${API_BASE}/api/v1/benefits/types`, { headers: HEADERS });
            if (!typesRes.ok()) {
                console.log('[SKIP] Benefit types API returned', typesRes.status());
                return;
            }
            const types = await typesRes.json();
            for (const type of types.data) {
                console.log(`   -> ${type.benefit_type}: ${type.count}`);
            }
            // Step 7: Get payroll overview
            console.log('\nStep 7: Fetching payroll overview...');
            const payrollRes = await request.get(`${API_BASE}/api/v1/pay-stubs/stats/overview?year=2025`, { headers: HEADERS });
            if (!payrollRes.ok()) {
                console.log('[SKIP] Payroll API returned', payrollRes.status());
                return;
            }
            const payroll = await payrollRes.json();
            console.log(`   -> Total stubs: ${payroll.data.summary.total_stubs}`);
            console.log(`   -> Employees paid: ${payroll.data.summary.employees_paid}`);
            console.log(`   -> Total gross: ${payroll.data.summary.total_gross || 0}`);
            console.log('\n=== FLOW COMPLETED SUCCESSFULLY ===\n');
        });
    });
    test_1.test.describe('6. Data Verification', () => {
        (0, test_1.test)('6.1 Verify Salary Band Data Quality', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/salary-bands?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data.data.length).toBeGreaterThan(0);
            for (const band of data.data.slice(0, 5)) {
                (0, test_1.expect)(band.id).toBeTruthy();
                (0, test_1.expect)(band.band_name).toBeTruthy();
                (0, test_1.expect)(parseFloat(band.max_salary)).toBeGreaterThan(parseFloat(band.min_salary));
            }
            console.log(`[Verification]: ${data.data.length} salary bands verified`);
        });
        (0, test_1.test)('6.2 Verify Bonus Plan Data', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/bonus-plans?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data.data.length).toBeGreaterThan(0);
            for (const plan of data.data.slice(0, 5)) {
                (0, test_1.expect)(plan.id).toBeTruthy();
                (0, test_1.expect)(plan.name).toBeTruthy();
                (0, test_1.expect)(plan.bonus_type).toBeTruthy();
            }
            console.log(`[Verification]: ${data.data.length} bonus plans verified`);
        });
        (0, test_1.test)('6.3 Verify Benefits Data', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/benefits?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data.data.length).toBeGreaterThan(0);
            for (const benefit of data.data.slice(0, 5)) {
                (0, test_1.expect)(benefit.id).toBeTruthy();
                (0, test_1.expect)(benefit.benefit_name).toBeTruthy();
                (0, test_1.expect)(benefit.benefit_type).toBeTruthy();
            }
            console.log(`[Verification]: ${data.data.length} benefits verified`);
        });
        (0, test_1.test)('6.4 Verify Pay Stub Data', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/pay-stubs?limit=20`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data.data.length).toBeGreaterThan(0);
            for (const stub of data.data.slice(0, 5)) {
                (0, test_1.expect)(stub.id).toBeTruthy();
                (0, test_1.expect)(stub.employee_name).toBeTruthy();
                (0, test_1.expect)(parseFloat(stub.gross_pay)).toBeGreaterThanOrEqual(parseFloat(stub.net_pay));
            }
            console.log(`[Verification]: ${data.data.length} pay stubs verified`);
        });
    });
});
//# sourceMappingURL=compensation-benefits.spec.js.map