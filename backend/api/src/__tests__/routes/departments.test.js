/**
 * Departments Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for department CRUD endpoints.
 * All external dependencies (database, redis) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildDepartment, buildSysadminTokenPayload, buildEmployeeTokenPayload, resetFactories, DEFAULT_IDS, } from '../factories/index.js';
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
const { default: departmentsRoutes } = await import('../../routes/departments.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
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
    app.use('/api/v1/departments', authMiddleware);
    app.use('/api/v1/departments', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        // Attach mock dbClient
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/departments', departmentsRoutes);
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
// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
function createEmployeeToken() {
    return generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
}
// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('Departments Routes - Behavioral Tests', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
    });
    // =========================================================================
    // Auth enforcement
    // =========================================================================
    describe('Authentication Enforcement', () => {
        it('should return 401 for GET /departments without auth token', async () => {
            const res = await supertest(app).get('/api/v1/departments').set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST /departments without auth token', async () => {
            const res = await supertest(app)
                .post('/api/v1/departments')
                .set('X-Tenant-ID', TENANT_ID)
                .send({ code: 'TEST', name: 'Test Department' });
            expect(res.status).toBe(401);
        });
        it('should return 401 for DELETE /departments/:id without auth token', async () => {
            const res = await supertest(app)
                .delete(`/api/v1/departments/${VALID_UUID}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /api/v1/departments - List departments
    // =========================================================================
    describe('GET /api/v1/departments', () => {
        it('should return list of departments', async () => {
            const token = createSysadminToken();
            const dept1 = buildDepartment({ id: 'dept-1', code: 'IT', name: 'Information Technology' });
            const dept2 = buildDepartment({ id: 'dept-2', code: 'HR', name: 'Human Resources' });
            // List query
            mockQuery.mockResolvedValueOnce({
                rows: [dept1, dept2],
                rowCount: 2,
            });
            // Count query
            mockQuery.mockResolvedValueOnce({
                rows: [{ count: '2' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta).toHaveProperty('total', 2);
        });
        it('should return empty list when no departments found', async () => {
            const token = createSysadminToken();
            // List query
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // Count query
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.total).toBe(0);
        });
        it('should apply is_active filter', async () => {
            const token = createSysadminToken();
            const activeDept = buildDepartment({ id: 'dept-active', is_active: true });
            mockQuery.mockResolvedValueOnce({ rows: [activeDept], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/departments?is_active=true')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should apply search filter', async () => {
            const token = createSysadminToken();
            const hrDept = buildDepartment({ id: 'dept-hr', code: 'HR', name: 'Human Resources' });
            mockQuery.mockResolvedValueOnce({ rows: [hrDept], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/departments?search=Human')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should respect limit and offset parameters', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [buildDepartment()], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/departments?limit=1&offset=2')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.meta).toHaveProperty('limit', 1);
            expect(res.body.meta).toHaveProperty('offset', 2);
        });
    });
    // =========================================================================
    // GET /api/v1/departments/:id - Get single department
    // =========================================================================
    describe('GET /api/v1/departments/:id', () => {
        it('should return department details for valid ID', async () => {
            const token = createSysadminToken();
            const department = buildDepartment({ id: VALID_UUID, code: 'IT', name: 'IT Department' });
            mockQuery.mockResolvedValueOnce({
                rows: [{ ...department, employee_count: '15' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id', VALID_UUID);
            expect(res.body.data).toHaveProperty('name', 'IT Department');
            expect(res.body.data).toHaveProperty('employee_count', '15');
        });
        it('should return 404 when department not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /api/v1/departments - Create department
    // =========================================================================
    describe('POST /api/v1/departments', () => {
        it('should create department successfully with valid data', async () => {
            const token = createSysadminToken();
            const newDept = {
                id: 'new-dept-uuid',
                tenant_id: TENANT_ID,
                code: 'SALES',
                name: 'Sales Department',
                name_en: 'Sales',
                description: 'Sales team',
                is_active: true,
                created_at: '2025-01-01T00:00:00Z',
            };
            // Duplicate code check - not found
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // INSERT
            mockQuery.mockResolvedValueOnce({ rows: [newDept], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({
                code: 'SALES',
                name: 'Sales Department',
                name_en: 'Sales',
                description: 'Sales team',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('code', 'SALES');
            expect(res.body.data).toHaveProperty('name', 'Sales Department');
        });
        it('should return 409 when department code already exists', async () => {
            const token = createSysadminToken();
            // Duplicate code check - found existing
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ code: 'IT', name: 'IT Duplicate' });
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when required fields are missing (no code)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ name: 'No Code Department' });
            // Zod validation will catch this (validate middleware) OR the manual check
            expect(res.status).toBe(400);
        });
        it('should return 400 when required fields are missing (no name)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ code: 'NONAME' });
            expect(res.status).toBe(400);
        });
    });
    // =========================================================================
    // PUT /api/v1/departments/:id - Update department
    // =========================================================================
    describe('PUT /api/v1/departments/:id', () => {
        it('should update department successfully', async () => {
            const token = createSysadminToken();
            // Department exists check
            mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 });
            // Code conflict check (updating code to 'SALES-NEW')
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // UPDATE query
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: VALID_UUID,
                        code: 'SALES-NEW',
                        name: 'Updated Sales',
                        is_active: true,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .put(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ code: 'SALES-NEW', name: 'Updated Sales' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('code', 'SALES-NEW');
        });
        it('should return 404 when department not found', async () => {
            const token = createSysadminToken();
            // Department exists check - not found
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .put(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ name: 'Updated' });
            expect(res.status).toBe(404);
        });
        it('should return 409 when updated code conflicts with existing department', async () => {
            const token = createSysadminToken();
            // Department exists check
            mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 });
            // Code conflict check - found existing with same code
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-dept-id' }], rowCount: 1 });
            const res = await supertest(app)
                .put(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ code: 'EXISTING-CODE', name: 'Conflicting' });
            expect(res.status).toBe(409);
        });
    });
    // =========================================================================
    // DELETE /api/v1/departments/:id - Soft delete department
    // =========================================================================
    describe('DELETE /api/v1/departments/:id', () => {
        it('should soft-delete department when no employees assigned', async () => {
            const token = createSysadminToken();
            // Employee count check - zero employees
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            // Soft delete UPDATE
            mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('deactivated');
        });
        it('should return 400 when department has assigned employees', async () => {
            const token = createSysadminToken();
            // Employee count check - has employees
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when department not found for deletion', async () => {
            const token = createSysadminToken();
            // Employee count check - zero
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            // Soft delete returns empty (not found)
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/departments/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(404);
        });
    });
    // =========================================================================
    // GET /api/v1/departments/:id/employees - List employees in department
    // =========================================================================
    describe('GET /api/v1/departments/:id/employees', () => {
        it('should return employees in the department', async () => {
            const token = createSysadminToken();
            const employees = [
                {
                    id: 'emp-1',
                    first_name: 'Mario',
                    last_name: 'Rossi',
                    email: 'mario@rtl.com',
                    job_title: 'Developer',
                    is_active: true,
                    hire_date: '2020-01-01',
                },
                {
                    id: 'emp-2',
                    first_name: 'Lucia',
                    last_name: 'Bianchi',
                    email: 'lucia@rtl.com',
                    job_title: 'Analyst',
                    is_active: true,
                    hire_date: '2021-06-01',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: employees, rowCount: 2 });
            const res = await supertest(app)
                .get(`/api/v1/departments/${VALID_UUID}/employees`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0]).toHaveProperty('first_name', 'Mario');
        });
        it('should return empty list when no employees in department', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/departments/${VALID_UUID}/employees`)
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // Database error handling
    // =========================================================================
    describe('Database Error Handling', () => {
        it('should return 500 when database query fails on GET /', async () => {
            const token = createSysadminToken();
            mockQuery.mockRejectedValueOnce(new Error('Connection failed'));
            const res = await supertest(app)
                .get('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID);
            expect(res.status).toBe(500);
        });
        it('should return 500 when database query fails on POST /', async () => {
            const token = createSysadminToken();
            // Duplicate check passes
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            // INSERT fails
            mockQuery.mockRejectedValueOnce(new Error('Insert failed'));
            const res = await supertest(app)
                .post('/api/v1/departments')
                .set('Authorization', `Bearer ${token}`)
                .set('X-Tenant-ID', TENANT_ID)
                .send({ code: 'NEW', name: 'New Department' });
            expect(res.status).toBe(500);
        });
    });
});
//# sourceMappingURL=departments.test.js.map