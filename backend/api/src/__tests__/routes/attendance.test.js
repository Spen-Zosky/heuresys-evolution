/**
 * Attendance Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for attendance CRUD,
 * clock-in/out, validation, and statistics endpoints.
 * All external dependencies (database, redis) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS, } from '../factories/index.js';
// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
});
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockQuery },
    appPool: { connect: mockConnect },
    testConnection: jest.fn().mockResolvedValue(true),
    testAppConnection: jest.fn().mockResolvedValue(true),
    closePool: jest.fn().mockResolvedValue(undefined),
    getAppClient: jest.fn(),
    withTenantClient: jest.fn(),
}));
jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
    getRedis: jest.fn(),
    isRedisReady: jest.fn().mockReturnValue(false),
    blacklistToken: jest.fn().mockResolvedValue(true),
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    closeRedis: jest.fn().mockResolvedValue(undefined),
}));
jest.unstable_mockModule(resolve('../../errors/sentry.js'), () => ({
    initSentry: jest.fn(),
    sentryErrorLogger: jest.fn(),
    captureException: jest.fn(),
    setUser: jest.fn(),
    clearUser: jest.fn(),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    flush: jest.fn(),
    close: jest.fn(),
    isActive: jest.fn().mockReturnValue(false),
}));
// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------
const { default: express } = await import('express');
const { default: attendanceRoutes } = await import('../../routes/attendance.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const ATTENDANCE_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/attendance', authMiddleware);
    app.use('/api/v1/attendance', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/attendance', attendanceRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({
            success: false,
            error: err.message || 'Internal Server Error',
            code: err.code,
        });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('Attendance Routes - Behavioral Tests', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
    });
    // =========================================================================
    // Authentication Enforcement
    // =========================================================================
    describe('Authentication Enforcement', () => {
        it('should return 401 for GET /attendance without auth token', async () => {
            const res = await supertest(app).get('/api/v1/attendance');
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST /attendance without auth token', async () => {
            const res = await supertest(app)
                .post('/api/v1/attendance')
                .send({ employee_id: EMPLOYEE_ID, attendance_date: '2025-01-15' });
            expect(res.status).toBe(401);
        });
        it('should return 401 for DELETE /attendance/:id without auth token', async () => {
            const res = await supertest(app).delete(`/api/v1/attendance/${ATTENDANCE_ID}`);
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /attendance/stats - Attendance statistics
    // =========================================================================
    describe('GET /attendance/stats', () => {
        it('should return attendance statistics', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_records: '200',
                        employees_tracked: '50',
                        total_regular_hours: '1600.0',
                        total_overtime_hours: '80.5',
                        total_hours: '1680.5',
                        present_days: '180',
                        absent_days: '10',
                        late_days: '10',
                        validated_count: '150',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/attendance/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total_records).toBe('200');
            expect(res.body.data.employees_tracked).toBe('50');
            expect(res.body.data.year).toBeDefined();
            expect(res.body.data.month).toBeDefined();
        });
        it('should accept year and month query params', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ total_records: '0' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/attendance/stats')
                .query({ year: '2024', month: '6' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.year).toBe(2024);
            expect(res.body.data.month).toBe(6);
        });
    });
    // =========================================================================
    // GET /attendance - List attendance records
    // =========================================================================
    describe('GET /attendance', () => {
        it('should return attendance records with pagination', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '100' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'att-1',
                        employee_name: 'Mario Rossi',
                        status: 'present',
                        attendance_date: '2025-01-15',
                    },
                    {
                        id: 'att-2',
                        employee_name: 'Lucia Bianchi',
                        status: 'late',
                        attendance_date: '2025-01-15',
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/attendance')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta.total).toBe(100);
        });
        it('should accept employee_id, status, and date filters', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/attendance')
                .query({
                employee_id: EMPLOYEE_ID,
                status: 'present',
                date_from: '2025-01-01',
                date_to: '2025-01-31',
            })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
        it('should cap limit at 200', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/attendance')
                .query({ limit: '5000' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(200);
        });
    });
    // =========================================================================
    // GET /attendance/:id - Get single record
    // =========================================================================
    describe('GET /attendance/:id', () => {
        it('should return single attendance record', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ATTENDANCE_ID,
                        employee_name: 'Mario Rossi',
                        status: 'present',
                        clock_in: '09:00',
                        clock_out: '18:00',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(ATTENDANCE_ID);
            expect(res.body.data.employee_name).toBe('Mario Rossi');
        });
        it('should return 404 when record not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // GET /attendance/employee/:employeeId/summary - Employee summary
    // =========================================================================
    describe('GET /attendance/employee/:employeeId/summary', () => {
        it('should return employee attendance summary', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_days: '22',
                        regular_hours: '176.0',
                        overtime_hours: '12.5',
                        total_hours: '188.5',
                        avg_daily_hours: '8.6',
                        present_days: '20',
                        absent_days: '1',
                        late_days: '1',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/attendance/employee/${EMPLOYEE_ID}/summary`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.employee_id).toBe(EMPLOYEE_ID);
            expect(res.body.data.total_days).toBe('22');
        });
    });
    // =========================================================================
    // POST /attendance - Create attendance record
    // =========================================================================
    describe('POST /attendance', () => {
        it('should create attendance record', async () => {
            const token = createSysadminToken();
            // Verify employee belongs to tenant
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            // Insert
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ATTENDANCE_ID,
                        employee_id: EMPLOYEE_ID,
                        attendance_date: '2025-01-15',
                        status: 'present',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/attendance')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: EMPLOYEE_ID,
                attendance_date: '2025-01-15',
                clock_in: '09:00',
                status: 'present',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(ATTENDANCE_ID);
            expect(res.body.message).toBe('Attendance record created successfully');
        });
        it('should return 400 when employee_id is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/attendance')
                .set('Authorization', `Bearer ${token}`)
                .send({ attendance_date: '2025-01-15' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when attendance_date is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/attendance')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when employee not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/attendance')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID, attendance_date: '2025-01-15' });
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
        it('should return 409 on duplicate attendance record', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 });
            const dbError = new Error('unique violation');
            dbError.code = '23505';
            mockQuery.mockRejectedValueOnce(dbError);
            const res = await supertest(app)
                .post('/api/v1/attendance')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID, attendance_date: '2025-01-15' });
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // POST /attendance/clock-in
    // =========================================================================
    describe('POST /attendance/clock-in', () => {
        it('should clock in successfully', async () => {
            const token = createSysadminToken();
            // Check existing
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // Insert/upsert
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, clock_in: '09:00', status: 'present' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/attendance/clock-in')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Clocked in successfully');
        });
        it('should return 400 when already clocked in', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, clock_in: '09:00', clock_out: null }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/attendance/clock-in')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
        it('should return 400 when employee_id is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/attendance/clock-in')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /attendance/clock-out
    // =========================================================================
    describe('POST /attendance/clock-out', () => {
        it('should clock out successfully', async () => {
            const token = createSysadminToken();
            // Check existing
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, clock_in: '09:00:00', clock_out: null }],
                rowCount: 1,
            });
            // Update
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, clock_in: '09:00', clock_out: '18:00', hours_regular: 8 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/attendance/clock-out')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Clocked out successfully');
        });
        it('should return 400 when not clocked in', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/attendance/clock-out')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
        it('should return 400 when already clocked out', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, clock_in: '09:00', clock_out: '18:00' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/attendance/clock-out')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // PATCH /attendance/:id - Update record
    // =========================================================================
    describe('PATCH /attendance/:id', () => {
        it('should update attendance record', async () => {
            const token = createSysadminToken();
            // Verify exists
            mockQuery.mockResolvedValueOnce({ rows: [{ id: ATTENDANCE_ID }], rowCount: 1 });
            // Update
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, status: 'late', notes: 'Traffic delay' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'late', notes: 'Traffic delay' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('late');
        });
        it('should return 404 when record not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'absent' });
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
        it('should return 400 when no fields to update', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: ATTENDANCE_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // PATCH /attendance/:id/validate - Validate record
    // =========================================================================
    describe('PATCH /attendance/:id/validate', () => {
        it('should validate attendance record', async () => {
            const token = createSysadminToken();
            // Verify exists
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, is_validated: false }],
                rowCount: 1,
            });
            // Update
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, is_validated: true }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/attendance/${ATTENDANCE_ID}/validate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ validated_by: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Attendance record validated successfully');
        });
        it('should return 404 when record not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/attendance/${ATTENDANCE_ID}/validate`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
        it('should return 400 when already validated', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, is_validated: true }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/attendance/${ATTENDANCE_ID}/validate`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // DELETE /attendance/:id - Delete record
    // =========================================================================
    describe('DELETE /attendance/:id', () => {
        it('should delete attendance record', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, is_validated: false }],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Attendance record deleted successfully');
        });
        it('should return 404 when record not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
        it('should return 400 when trying to delete validated record', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: ATTENDANCE_ID, is_validated: true }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .delete(`/api/v1/attendance/${ATTENDANCE_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
});
//# sourceMappingURL=attendance.test.js.map