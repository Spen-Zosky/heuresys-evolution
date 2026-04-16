/**
 * Interviews Routes - Behavioral Tests
 * Tests HTTP request/response behavior for recruiting interview endpoints.
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
const { default: routeHandler } = await import('../../routes/interviews.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const CANDIDATE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const INTERVIEW_ID = DEFAULT_IDS.GOAL_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/interviews', authMiddleware);
    app.use('/api/v1/interviews', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/interviews', routeHandler);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
function sysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('Interviews Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = sysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('GET /stats', () => {
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/interviews/stats');
            expect(res.status).toBe(401);
        });
        it('should return 200 with interview statistics', async () => {
            const stats = {
                total: '20',
                scheduled: '5',
                completed: '12',
                cancelled: '3',
                upcoming: '3',
                avg_rating: '4.2',
            };
            mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/interviews/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe('20');
            expect(res.body.data.avg_rating).toBe('4.2');
        });
    });
    describe('GET /upcoming', () => {
        it('should return 200 with upcoming interviews', async () => {
            const upcoming = [
                { id: INTERVIEW_ID, candidate_name: 'Mario Rossi', scheduled_at: '2025-06-15' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: upcoming, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/interviews/upcoming')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].candidate_name).toBe('Mario Rossi');
        });
        it('should accept custom days parameter', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/interviews/upcoming?days=14')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
    describe('GET / (list)', () => {
        it('should return 200 with interviews and meta', async () => {
            const interviews = [
                { id: INTERVIEW_ID, candidate_name: 'Lucia Bianchi', status: 'scheduled' },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '15' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: interviews, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/interviews')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(15);
            expect(res.body.meta.limit).toBe(50);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should filter by candidate_id, status, interview_type', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/interviews?candidate_id=${CANDIDATE_ID}&status=scheduled&interview_type=video&limit=10&offset=5`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(10);
            expect(res.body.meta.offset).toBe(5);
        });
    });
    describe('GET /:id', () => {
        it('should return 200 with interview details and interviewers', async () => {
            const interview = { id: INTERVIEW_ID, candidate_name: 'Marco Verdi', status: 'scheduled' };
            const interviewers = [
                { employee_id: 'e1', interviewer_name: 'Anna Neri', interviewer_email: 'anna@rtl.com' },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: [interview], rowCount: 1 })
                .mockResolvedValueOnce({ rows: interviewers, rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/interviews/${INTERVIEW_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.candidate_name).toBe('Marco Verdi');
            expect(res.body.data.interviewers).toHaveLength(1);
            expect(res.body.data.interviewers[0].interviewer_name).toBe('Anna Neri');
        });
        it('should return 404 when interview not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/interviews/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('POST / (create)', () => {
        it('should return 201 when creating an interview', async () => {
            const created = { id: INTERVIEW_ID, candidate_id: CANDIDATE_ID, status: 'scheduled' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: CANDIDATE_ID }], rowCount: 1 }) // candidate check
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // insert
            const res = await supertest(app)
                .post('/api/v1/interviews')
                .set('Authorization', `Bearer ${token}`)
                .send({
                candidate_id: CANDIDATE_ID,
                scheduled_at: '2025-06-15T10:00:00Z',
                interview_type: 'video',
                title: 'Technical Interview',
                duration_minutes: 60,
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Interview scheduled');
        });
        it('should return 400 when candidate_id is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/interviews')
                .set('Authorization', `Bearer ${token}`)
                .send({ scheduled_at: '2025-06-15T10:00:00Z' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when scheduled_at is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/interviews')
                .set('Authorization', `Bearer ${token}`)
                .send({ candidate_id: CANDIDATE_ID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when candidate is invalid', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // candidate check fails
            const res = await supertest(app)
                .post('/api/v1/interviews')
                .set('Authorization', `Bearer ${token}`)
                .send({ candidate_id: CANDIDATE_ID, scheduled_at: '2025-06-15T10:00:00Z' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid candidate');
        });
        it('should return 400 for invalid interview_type (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/interviews')
                .set('Authorization', `Bearer ${token}`)
                .send({
                candidate_id: CANDIDATE_ID,
                scheduled_at: '2025-06-15T10:00:00Z',
                interview_type: 'invalid',
            });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('PATCH /:id', () => {
        it('should return 200 when updating an interview', async () => {
            const updated = { id: INTERVIEW_ID, title: 'Updated Interview', status: 'scheduled' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: INTERVIEW_ID }], rowCount: 1 }) // check exists
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // update
            const res = await supertest(app)
                .patch(`/api/v1/interviews/${INTERVIEW_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated Interview', duration_minutes: 90 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Interview updated');
        });
        it('should return 404 when interview not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/interviews/nonexistent')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when no fields to update', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: INTERVIEW_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/interviews/${INTERVIEW_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No fields to update');
        });
        it('should return 400 for invalid status (Zod)', async () => {
            const res = await supertest(app)
                .patch(`/api/v1/interviews/${INTERVIEW_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'invalid_status' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /:id/complete', () => {
        it('should return 200 when completing an interview', async () => {
            const completed = { id: INTERVIEW_ID, status: 'completed', outcome: 'pass', rating: 4 };
            mockQuery.mockResolvedValueOnce({ rows: [completed], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/interviews/${INTERVIEW_ID}/complete`)
                .set('Authorization', `Bearer ${token}`)
                .send({ outcome: 'pass', feedback: 'Great candidate', rating: 4 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Interview completed');
            expect(res.body.data.outcome).toBe('pass');
        });
        it('should return 404 when interview not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/interviews/nonexistent/complete')
                .set('Authorization', `Bearer ${token}`)
                .send({ outcome: 'pass' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 for invalid outcome (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/interviews/${INTERVIEW_ID}/complete`)
                .set('Authorization', `Bearer ${token}`)
                .send({ outcome: 'invalid_outcome' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /:id/cancel', () => {
        it('should return 200 when cancelling an interview', async () => {
            const cancelled = { id: INTERVIEW_ID, status: 'cancelled' };
            mockQuery.mockResolvedValueOnce({ rows: [cancelled], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/interviews/${INTERVIEW_ID}/cancel`)
                .set('Authorization', `Bearer ${token}`)
                .send({ reason: 'Candidate unavailable' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Interview cancelled');
        });
        it('should return 404 when interview not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/interviews/nonexistent/cancel')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('DELETE /:id', () => {
        it('should return 200 when deleting an interview', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: INTERVIEW_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/interviews/${INTERVIEW_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Interview deleted');
        });
        it('should return 404 when interview not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/interviews/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
});
//# sourceMappingURL=interviews.test.js.map