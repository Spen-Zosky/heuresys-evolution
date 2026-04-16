/**
 * Audit Logs Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for audit log viewing,
 * configuration, export, and metadata endpoints.
 * All external dependencies (database, redis) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, buildEmployeeTokenPayload, resetFactories, DEFAULT_IDS, } from '../factories/index.js';
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
const { default: express } = await import('express');
const { default: auditLogsRoutes } = await import('../../routes/audit-logs.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const LOG_ID = 'log-11111111-2222-3333-4444-555555555555';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/audit-logs', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/audit-logs', auditLogsRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('Audit Logs Routes - Behavioral Tests', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
    });
    describe('Authentication Enforcement', () => {
        it('should return 401 for GET /audit-logs without auth token', async () => {
            const res = await supertest(app).get('/api/v1/audit-logs');
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST /audit-logs without auth token', async () => {
            const res = await supertest(app)
                .post('/api/v1/audit-logs')
                .send({ action: 'CREATE', category: 'USER' });
            expect(res.status).toBe(401);
        });
    });
    describe('GET /audit-logs/stats', () => {
        it('should return audit log statistics', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total: '1500',
                        successful: '1450',
                        failed: '50',
                        unique_users: '30',
                        action_types: '8',
                        resource_types: '12',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({
                rows: [{ last_24h: '50', last_7d: '300', last_30d: '1200' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/audit-logs/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe('1500');
            expect(res.body.data.last_24h).toBe('50');
        });
    });
    describe('GET /audit-logs/actions', () => {
        it('should return action breakdown', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { action: 'CREATE', category: 'USER', count: '200' },
                    { action: 'LOGIN', category: 'AUTH', count: '500' },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/audit-logs/actions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
        });
    });
    describe('GET /audit-logs/recent', () => {
        it('should return recent audit logs', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'LOGIN', user_name: 'Mario Rossi' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/audit-logs/recent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('GET /audit-logs', () => {
        it('should return paginated audit logs', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '500' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'CREATE', category: 'EMPLOYEE' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/audit-logs')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(500);
        });
        it('should accept filter parameters', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/audit-logs')
                .query({ action: 'LOGIN', category: 'AUTH', success: 'true' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    describe('GET /audit-logs/:id', () => {
        it('should return single audit log entry', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'UPDATE', user_name: 'Lucia Bianchi' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/audit-logs/${LOG_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(LOG_ID);
        });
        it('should return 404 when log not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/audit-logs/${LOG_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('POST /audit-logs', () => {
        it('should create an audit log entry', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'CREATE', category: 'EMPLOYEE' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/audit-logs')
                .set('Authorization', `Bearer ${token}`)
                .send({ action: 'CREATE', category: 'EMPLOYEE', description: 'Created employee record' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Audit log created');
        });
        it('should return 400 when action is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/audit-logs')
                .set('Authorization', `Bearer ${token}`)
                .send({ category: 'EMPLOYEE' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /audit-logs/export', () => {
        it('should export audit logs as JSON', async () => {
            const token = createSysadminToken();
            // Export query
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'CREATE', timestamp: '2025-01-01T00:00:00Z' }],
                rowCount: 1,
            });
            // Log the export action
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/audit-logs/export')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'json' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.count).toBe(1);
            expect(res.body.data.logs).toHaveLength(1);
        });
        it('should export audit logs as CSV', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: LOG_ID,
                        timestamp: '2025-01-01',
                        user_email: 'admin@test.com',
                        user_role: 'ADMIN',
                        action: 'CREATE',
                        category: 'USER',
                        resource_type: 'employee',
                        resource_id: 'emp-1',
                        resource_name: 'Test',
                        description: 'Test export',
                        success: true,
                        ip_address: '127.0.0.1',
                    },
                ],
                rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/audit-logs/export')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'csv' });
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/csv');
        });
        it('should return 403 for non-admin users', async () => {
            const token = generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
            const res = await supertest(app)
                .post('/api/v1/audit-logs/export')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'json' });
            expect(res.status).toBe(403);
        });
    });
    describe('GET /audit-logs/meta/actions', () => {
        it('should return static action types', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .get('/api/v1/audit-logs/meta/actions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0]).toHaveProperty('value');
            expect(res.body.data[0]).toHaveProperty('label');
        });
    });
    describe('GET /audit-logs/meta/categories', () => {
        it('should return static category types', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .get('/api/v1/audit-logs/meta/categories')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
        });
    });
    describe('GET /audit-logs/user/:userId', () => {
        it('should return logs for a specific user', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'LOGIN', user_id: 'user-1' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/audit-logs/user/user-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });
    describe('GET /audit-logs/resource/:resourceType/:resourceId', () => {
        it('should return logs for a specific resource', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: LOG_ID, action: 'UPDATE', resource_type: 'employee', resource_id: 'emp-1' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/audit-logs/resource/employee/emp-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=audit-logs.test.js.map