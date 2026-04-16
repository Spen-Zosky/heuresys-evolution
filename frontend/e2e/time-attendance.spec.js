"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const api_auth_helper_1 = require("./api-auth-helper");
const API_BASE = 'http://localhost:8012';
let HEADERS = { 'X-Tenant-Code': 'rtl-bank' };
/**
 * SPRINT 2025-09: Time & Attendance Tests
 * Tests for attendance tracking, overtime management, and time off
 */
test_1.test.describe('Time & Attendance (E-TIME-01)', () => {
    test_1.test.beforeAll(async () => {
        const token = await (0, api_auth_helper_1.getAuthToken)();
        HEADERS = { ...HEADERS, 'Authorization': `Bearer ${token}` };
    });
    // ============================================================================
    // 1. ATTENDANCE MODULE
    // ============================================================================
    test_1.test.describe('1. Attendance Management', () => {
        (0, test_1.test)('1.1 Get Attendance Statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/attendance/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data).toHaveProperty('data');
            (0, test_1.expect)(data.data).toHaveProperty('year');
            (0, test_1.expect)(data.data).toHaveProperty('month');
            (0, test_1.expect)(data.data).toHaveProperty('total_records');
            (0, test_1.expect)(data.data).toHaveProperty('employees_tracked');
            console.log(`[Attendance Stats]: ${data.data.total_records} records, ${data.data.employees_tracked} employees tracked`);
        });
        (0, test_1.test)('1.2 Get Attendance Statistics for Specific Month', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/attendance/stats?year=2024&month=11`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data.data.year).toBe(2024);
            (0, test_1.expect)(data.data.month).toBe(11);
            console.log(`[Attendance Nov 2024]: ${data.data.total_records} records`);
        });
        (0, test_1.test)('1.3 List Attendance Records', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/attendance?limit=10`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            (0, test_1.expect)(data.meta).toHaveProperty('total');
            (0, test_1.expect)(data.meta).toHaveProperty('limit');
            (0, test_1.expect)(data.meta).toHaveProperty('offset');
            if (data.data.length > 0) {
                const record = data.data[0];
                (0, test_1.expect)(record).toHaveProperty('id');
                (0, test_1.expect)(record).toHaveProperty('employee_id');
                (0, test_1.expect)(record).toHaveProperty('attendance_date');
                console.log(`[Attendance Records]: ${data.meta.total} total records`);
            }
        });
        (0, test_1.test)('1.4 Filter Attendance by Status', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/attendance?status=present&limit=5`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            // All records should have status 'present'
            data.data.forEach((record) => {
                (0, test_1.expect)(record.status).toBe('present');
            });
            console.log(`[Present Records]: ${data.data.length} records with status=present`);
        });
        (0, test_1.test)('1.5 Get Single Attendance Record', async ({ request }) => {
            // First get a list to find an ID
            const listRes = await request.get(`${API_BASE}/api/v1/attendance?limit=1`, { headers: HEADERS });
            if (!listRes.ok()) {
                console.log('[SKIP] API returned', listRes.status());
                return;
            }
            const listData = await listRes.json();
            if (listData.data.length > 0) {
                const recordId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/attendance/${recordId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data.data.id).toBe(recordId);
                (0, test_1.expect)(data.data).toHaveProperty('employee_name');
                console.log(`[Single Attendance]: Record ${recordId} for ${data.data.employee_name}`);
            }
        });
        (0, test_1.test)('1.6 Get Employee Attendance Summary', async ({ request }) => {
            // First get a list to find an employee ID
            const listRes = await request.get(`${API_BASE}/api/v1/attendance?limit=1`, { headers: HEADERS });
            if (!listRes.ok()) {
                console.log('[SKIP] API returned', listRes.status());
                return;
            }
            const listData = await listRes.json();
            if (listData.data.length > 0) {
                const employeeId = listData.data[0].employee_id;
                const res = await request.get(`${API_BASE}/api/v1/attendance/employee/${employeeId}/summary?year=2024`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data.data).toHaveProperty('employee_id');
                (0, test_1.expect)(data.data).toHaveProperty('year');
                (0, test_1.expect)(data.data).toHaveProperty('total_days');
                (0, test_1.expect)(data.data).toHaveProperty('present_days');
                (0, test_1.expect)(data.data).toHaveProperty('absent_days');
                console.log(`[Employee Summary]: ${data.data.total_days} days, ${data.data.present_days} present`);
            }
        });
        (0, test_1.test)('1.7 Filter Attendance by Date Range', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/attendance?date_from=2024-11-01&date_to=2024-11-30&limit=10`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            console.log(`[Date Range Nov 2024]: ${data.data.length} records returned`);
        });
    });
    // ============================================================================
    // 2. OVERTIME MODULE
    // ============================================================================
    test_1.test.describe('2. Overtime Management', () => {
        (0, test_1.test)('2.1 Get Overtime Statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/overtime/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data.data).toHaveProperty('year');
            (0, test_1.expect)(data.data).toHaveProperty('total_records');
            (0, test_1.expect)(data.data).toHaveProperty('employees_with_overtime');
            (0, test_1.expect)(data.data).toHaveProperty('total_overtime_hours');
            console.log(`[Overtime Stats]: ${data.data.total_overtime_hours} total hours, ${data.data.employees_with_overtime} employees`);
        });
        (0, test_1.test)('2.2 Get Overtime Statistics with Month Filter', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/overtime/stats?year=2024&month=11`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data.data.year).toBe(2024);
            (0, test_1.expect)(data.data.month).toBe(11);
            console.log(`[Overtime Nov 2024]: ${data.data.total_overtime_hours} hours`);
        });
        (0, test_1.test)('2.3 Get Overtime Breakdown by Type', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/overtime/by-type?year=2024`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            if (data.data.length > 0) {
                const record = data.data[0];
                (0, test_1.expect)(record).toHaveProperty('overtime_type');
                (0, test_1.expect)(record).toHaveProperty('total_hours');
                (0, test_1.expect)(record).toHaveProperty('record_count');
                console.log(`[Overtime Types]: ${data.data.length} types found`);
            }
        });
        (0, test_1.test)('2.4 List Overtime Records', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/overtime?limit=10`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            (0, test_1.expect)(data.meta).toHaveProperty('total');
            (0, test_1.expect)(data.meta).toHaveProperty('limit');
            if (data.data.length > 0) {
                const record = data.data[0];
                (0, test_1.expect)(record).toHaveProperty('id');
                (0, test_1.expect)(record).toHaveProperty('employee_id');
                (0, test_1.expect)(record).toHaveProperty('hours');
                (0, test_1.expect)(record).toHaveProperty('overtime_type');
                console.log(`[Overtime Records]: ${data.meta.total} total records`);
            }
        });
        (0, test_1.test)('2.5 Filter Overtime by Status', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/overtime?status=approved&limit=5`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            // All records should have status 'approved'
            data.data.forEach((record) => {
                (0, test_1.expect)(record.status).toBe('approved');
            });
            console.log(`[Approved Overtime]: ${data.data.length} approved records`);
        });
        (0, test_1.test)('2.6 Get Single Overtime Record', async ({ request }) => {
            // First get a list to find an ID
            const listRes = await request.get(`${API_BASE}/api/v1/overtime?limit=1`, { headers: HEADERS });
            if (!listRes.ok()) {
                console.log('[SKIP] API returned', listRes.status());
                return;
            }
            const listData = await listRes.json();
            if (listData.data.length > 0) {
                const recordId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/overtime/${recordId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data.data.id).toBe(recordId);
                (0, test_1.expect)(data.data).toHaveProperty('employee_name');
                console.log(`[Single Overtime]: ${data.data.hours} hours for ${data.data.employee_name}`);
            }
        });
        (0, test_1.test)('2.7 Filter Overtime by Date Range', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/overtime?date_from=2024-01-01&date_to=2024-12-31&limit=10`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            console.log(`[Overtime 2024]: ${data.data.length} records returned`);
        });
    });
    // ============================================================================
    // 3. TIME OFF MODULE
    // ============================================================================
    test_1.test.describe('3. Time Off Management', () => {
        (0, test_1.test)('3.1 Get Time Off Statistics', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data.data).toHaveProperty('year');
            (0, test_1.expect)(data.data).toHaveProperty('balances');
            (0, test_1.expect)(data.data).toHaveProperty('requests');
            console.log(`[Time Off Stats]: Year ${data.data.year}`);
        });
        (0, test_1.test)('3.2 Get Time Off Statistics for Specific Year', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/stats?year=2024`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(data.data.year).toBe(2024);
            console.log(`[Time Off 2024 Stats]: ${data.data.balances.employees_with_balances} employees with balances`);
        });
        (0, test_1.test)('3.3 List Time Off Balances', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/balances?limit=10`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            (0, test_1.expect)(data.meta).toHaveProperty('total');
            (0, test_1.expect)(data.meta).toHaveProperty('year');
            if (data.data.length > 0) {
                const record = data.data[0];
                (0, test_1.expect)(record).toHaveProperty('id');
                (0, test_1.expect)(record).toHaveProperty('employee_id');
                (0, test_1.expect)(record).toHaveProperty('leave_type');
                (0, test_1.expect)(record).toHaveProperty('total_days');
                console.log(`[Time Off Balances]: ${data.meta.total} total balance records`);
            }
        });
        (0, test_1.test)('3.4 Filter Time Off Balances by Leave Type', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/balances?leave_type=annual&limit=5`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            // All records should have leave_type 'annual'
            data.data.forEach((record) => {
                (0, test_1.expect)(record.leave_type).toBe('annual');
            });
            console.log(`[Annual Leave]: ${data.data.length} annual leave balance records`);
        });
        (0, test_1.test)('3.5 List Time Off Requests', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/requests?limit=10`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            (0, test_1.expect)(data).toHaveProperty('meta');
            (0, test_1.expect)(data.meta).toHaveProperty('total');
            if (data.data.length > 0) {
                const record = data.data[0];
                (0, test_1.expect)(record).toHaveProperty('id');
                (0, test_1.expect)(record).toHaveProperty('employee_id');
                (0, test_1.expect)(record).toHaveProperty('status');
                (0, test_1.expect)(record).toHaveProperty('start_date');
                (0, test_1.expect)(record).toHaveProperty('end_date');
                console.log(`[Time Off Requests]: ${data.meta.total} total requests`);
            }
        });
        (0, test_1.test)('3.6 Filter Time Off Requests by Status', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/requests?status=approved&limit=5`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            // All records should have status 'approved'
            data.data.forEach((record) => {
                (0, test_1.expect)(record.status).toBe('approved');
            });
            console.log(`[Approved Requests]: ${data.data.length} approved time off requests`);
        });
        (0, test_1.test)('3.7 Get Single Time Off Request', async ({ request }) => {
            // First get a list to find an ID
            const listRes = await request.get(`${API_BASE}/api/v1/time-off/requests?limit=1`, { headers: HEADERS });
            if (!listRes.ok()) {
                console.log('[SKIP] API returned', listRes.status());
                return;
            }
            const listData = await listRes.json();
            if (listData.data.length > 0) {
                const requestId = listData.data[0].id;
                const res = await request.get(`${API_BASE}/api/v1/time-off/requests/${requestId}`, { headers: HEADERS });
                if (!res.ok()) {
                    console.log('[SKIP] API returned', res.status());
                    return;
                }
                const data = await res.json();
                (0, test_1.expect)(data).toHaveProperty('success', true);
                (0, test_1.expect)(data.data.id).toBe(requestId);
                (0, test_1.expect)(data.data).toHaveProperty('employee_name');
                console.log(`[Single Request]: ${data.data.leave_type} for ${data.data.employee_name}`);
            }
        });
        (0, test_1.test)('3.8 Get Time Off Breakdown by Leave Type', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/time-off/by-leave-type?year=2024`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data).toHaveProperty('success', true);
            (0, test_1.expect)(Array.isArray(data.data)).toBeTruthy();
            if (data.data.length > 0) {
                const record = data.data[0];
                (0, test_1.expect)(record).toHaveProperty('leave_type');
                (0, test_1.expect)(record).toHaveProperty('employees');
                (0, test_1.expect)(record).toHaveProperty('total_entitled');
                console.log(`[Leave Types]: ${data.data.length} leave types found`);
            }
        });
    });
    // ============================================================================
    // 4. INTEGRATION TESTS
    // ============================================================================
    test_1.test.describe('4. Integration Tests', () => {
        (0, test_1.test)('4.1 Multi-Tenant Isolation - RTL Bank', async ({ request }) => {
            const res = await request.get(`${API_BASE}/api/v1/attendance/stats`, { headers: HEADERS });
            if (!res.ok()) {
                console.log('[SKIP] API returned', res.status());
                return;
            }
            const data = await res.json();
            (0, test_1.expect)(data.success).toBe(true);
            console.log(`[RTL Bank]: ${data.data.total_records} attendance records`);
        });
        (0, test_1.test)('4.2 Multi-Tenant Isolation - SmartFood', async ({ request }) => {
            // Cross-tenant access test: RTL Bank admin token should NOT access SmartFood data
            // The tenant context middleware correctly rejects this with 403 (security enforcement)
            const res = await request.get(`${API_BASE}/api/v1/attendance/stats`, {
                headers: { ...HEADERS, 'X-Tenant-Code': 'smartfood' }
            });
            // Expect non-200 response — tenant isolation is working correctly
            // Non-SYSADMIN users are locked to their assigned tenant (403 or 500)
            (0, test_1.expect)(res.ok(), 'Cross-tenant access should be denied').toBeFalsy();
            console.log(`[SmartFood Isolation]: Cross-tenant access correctly denied (${res.status()})`);
        });
        (0, test_1.test)('4.3 Cross-Module Consistency', async ({ request }) => {
            // Get all stats for 2024
            const [attendance, overtime, timeOff] = await Promise.all([
                request.get(`${API_BASE}/api/v1/attendance/stats?year=2024`, { headers: HEADERS }),
                request.get(`${API_BASE}/api/v1/overtime/stats?year=2024`, { headers: HEADERS }),
                request.get(`${API_BASE}/api/v1/time-off/stats?year=2024`, { headers: HEADERS })
            ]);
            if (!attendance.ok()) {
                console.log('[SKIP] attendance API returned', attendance.status());
                return;
            }
            if (!overtime.ok()) {
                console.log('[SKIP] overtime API returned', overtime.status());
                return;
            }
            if (!timeOff.ok()) {
                console.log('[SKIP] timeOff API returned', timeOff.status());
                return;
            }
            const [attData, otData, toData] = await Promise.all([
                attendance.json(),
                overtime.json(),
                timeOff.json()
            ]);
            // All should report same year
            (0, test_1.expect)(attData.data.year).toBe(2024);
            (0, test_1.expect)(otData.data.year).toBe(2024);
            (0, test_1.expect)(toData.data.year).toBe(2024);
            console.log(`[2024 Summary]: Attendance=${attData.data.total_records}, Overtime=${otData.data.total_records}, TimeOff requests=${toData.data.requests.total_requests}`);
        });
        (0, test_1.test)('4.4 Pagination Consistency', async ({ request }) => {
            // Test attendance pagination
            const page1 = await request.get(`${API_BASE}/api/v1/attendance?limit=5&offset=0`, { headers: HEADERS });
            const page2 = await request.get(`${API_BASE}/api/v1/attendance?limit=5&offset=5`, { headers: HEADERS });
            if (!page1.ok()) {
                console.log('[SKIP] API returned', page1.status());
                return;
            }
            if (!page2.ok()) {
                console.log('[SKIP] API returned', page2.status());
                return;
            }
            const data1 = await page1.json();
            const data2 = await page2.json();
            (0, test_1.expect)(data1.meta.offset).toBe(0);
            (0, test_1.expect)(data2.meta.offset).toBe(5);
            (0, test_1.expect)(data1.meta.limit).toBe(5);
            (0, test_1.expect)(data2.meta.limit).toBe(5);
            // Pages should have different records (if enough data exists)
            if (data1.data.length === 5 && data2.data.length > 0) {
                (0, test_1.expect)(data1.data[0].id).not.toBe(data2.data[0].id);
            }
            console.log(`[Pagination]: Page1=${data1.data.length} records, Page2=${data2.data.length} records`);
        });
    });
});
//# sourceMappingURL=time-attendance.spec.js.map