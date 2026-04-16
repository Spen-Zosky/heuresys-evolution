/**
 * Check-ins Routes - Behavioral Tests
 * Tests HTTP request/response for 1:1 check-in CRUD, stats, upcoming,
 * completion, and deletion endpoints.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest
    .fn()
    .mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
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
const { default: checkInRoutes } = await import('../../routes/check-ins.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/check-ins', authMiddleware);
    app.use('/api/v1/check-ins', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/check-ins', checkInRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Check-ins Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('Authentication', () => {
        it('should return 401 without token', async () => {
            const res = await supertest(app).get('/api/v1/check-ins');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /check-ins/stats', () => {
        it('should return check-in statistics', async () => {
            const stats = {
                total: '100',
                scheduled: '20',
                completed: '75',
                cancelled: '5',
                avg_mood: '3.8',
                avg_duration: '28',
            };
            mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/check-ins/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.total).toBe('100');
            expect(res.body.data.avg_mood).toBe('3.8');
        });
    });
    describe('GET /check-ins/upcoming', () => {
        it('should return upcoming check-ins', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: '11111111-1111-1111-1111-111111111111',
                        employee_name: 'Mario Rossi',
                        manager_name: 'Lucia Bianchi',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/check-ins/upcoming')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].employee_name).toBe('Mario Rossi');
        });
    });
    describe('GET /check-ins', () => {
        it('should return paginated list', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: '11111111-1111-1111-1111-111111111111', status: 'completed' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/check-ins')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
        });
        it('should filter by status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/check-ins?status=completed')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET /check-ins/:id', () => {
        it('should return a single check-in', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: '11111111-1111-1111-1111-111111111111',
                        employee_name: 'Mario Rossi',
                        status: 'completed',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/check-ins/11111111-1111-1111-1111-111111111111')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.employee_name).toBe('Mario Rossi');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/check-ins/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
    describe('POST /check-ins', () => {
        const validPayload = {
            employee_id: '11111111-2222-4333-a444-555555555555',
            manager_id: '22222222-3333-4444-a555-666666666666',
            scheduled_date: '2026-03-15T10:00:00Z',
        };
        it('should create a check-in', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'ci-new', ...validPayload, status: 'scheduled' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/check-ins')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(201);
            expect(res.body.message).toBe('Check-in scheduled');
        });
        it('should return 400 when employee_id missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/check-ins')
                .set('Authorization', `Bearer ${token}`)
                .send({ manager_id: '22222222-3333-4444-a555-666666666666', scheduled_date: '2026-03-15' });
            expect(res.status).toBe(400);
        });
    });
    describe('PATCH /check-ins/:id', () => {
        it('should update a check-in', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: '11111111-1111-1111-1111-111111111111' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ id: '11111111-1111-1111-1111-111111111111', agenda: 'Updated agenda' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch('/api/v1/check-ins/11111111-1111-1111-1111-111111111111')
                .set('Authorization', `Bearer ${token}`)
                .send({ agenda: 'Updated agenda' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Check-in updated');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/check-ins/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`)
                .send({ agenda: 'X' });
            expect(res.status).toBe(404);
        });
        it('should return 400 when no fields', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: '11111111-1111-1111-1111-111111111111' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch('/api/v1/check-ins/11111111-1111-1111-1111-111111111111')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
    describe('POST /check-ins/:id/complete', () => {
        it('should complete a check-in', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: '11111111-1111-1111-1111-111111111111', status: 'completed' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/check-ins/11111111-1111-1111-1111-111111111111/complete')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_mood: 4, manager_notes: 'Good progress' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Check-in completed');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/check-ins/00000000-0000-0000-0000-000000000000/complete')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
        });
    });
    describe('DELETE /check-ins/:id', () => {
        it('should delete a check-in', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: '11111111-1111-1111-1111-111111111111' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .delete('/api/v1/check-ins/11111111-1111-1111-1111-111111111111')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Check-in deleted');
        });
        it('should return 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/check-ins/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    describe('Error Handling', () => {
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/check-ins/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
        });
    });
});
//# sourceMappingURL=check-ins.test.js.map