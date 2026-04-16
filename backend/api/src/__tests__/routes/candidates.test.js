/**
 * Candidates Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for recruiting candidate CRUD,
 * pipeline stats, stage advancement, rejection, and search endpoints.
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
const { default: candidateRoutes } = await import('../../routes/candidates.js');
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
    app.use('/api/v1/candidates', authMiddleware);
    app.use('/api/v1/candidates', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/candidates', candidateRoutes);
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
describe('Candidates Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Authentication', () => {
        it('should return 401 when no token is provided', async () => {
            const res = await supertest(app).get('/api/v1/candidates');
            expect(res.status).toBe(401);
        });
        it('should return 401 with an invalid token', async () => {
            const res = await supertest(app)
                .get('/api/v1/candidates')
                .set('Authorization', 'Bearer invalid');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /candidates/stats
    // =========================================================================
    describe('GET /candidates/stats', () => {
        it('should return candidate pipeline statistics', async () => {
            const statsRow = {
                total: '50',
                new_count: '10',
                screening: '12',
                interview: '8',
                offer: '5',
                hired: '10',
                rejected: '5',
                avg_rating: '3.5',
            };
            mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/candidates/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe('50');
            expect(res.body.data.hired).toBe('10');
            expect(res.body.data.avg_rating).toBe('3.5');
        });
    });
    // =========================================================================
    // GET /candidates/pipeline
    // =========================================================================
    describe('GET /candidates/pipeline', () => {
        it('should return pipeline stages with counts', async () => {
            const pipeline = [
                { stage: 'new', count: '10' },
                { stage: 'screening', count: '8' },
                { stage: 'interview', count: '5' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: pipeline, rowCount: 3 });
            const res = await supertest(app)
                .get('/api/v1/candidates/pipeline')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(3);
            expect(res.body.data[0].stage).toBe('new');
        });
    });
    // =========================================================================
    // GET /candidates
    // =========================================================================
    describe('GET /candidates', () => {
        it('should return paginated candidate list', async () => {
            const candidates = [
                {
                    id: 'c-1',
                    first_name: 'Mario',
                    last_name: 'Rossi',
                    stage: 'interview',
                    requisition_title: 'Software Dev',
                },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: candidates, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/candidates')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].first_name).toBe('Mario');
            expect(res.body.meta.total).toBe(1);
            expect(res.body.meta.limit).toBe(50);
        });
        it('should filter by stage', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/candidates?stage=interview')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            // The count query includes stage in its params
            const countCall = mockQuery.mock.calls[0];
            expect(countCall[1]).toContain(TENANT_ID);
            expect(countCall[1]).toContain('interview');
        });
        it('should return results without unsupported filters', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/candidates?requisition_id=req-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // First handler only supports stage filter; requisition_id is ignored
            expect(res.body.meta).toHaveProperty('hasMore');
        });
        it('should return paginated results regardless of search param', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/candidates?search=Mario')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // First handler does not support search; param is ignored
            expect(res.body.meta).toHaveProperty('hasMore');
        });
        it('should respect limit and offset', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '100' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/candidates?limit=10&offset=20')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(10);
            expect(res.body.meta.offset).toBe(20);
        });
    });
    // =========================================================================
    // GET /candidates/:id
    // =========================================================================
    describe('GET /candidates/:id', () => {
        it('should return a single candidate with details', async () => {
            const candidate = {
                id: 'c-1',
                first_name: 'Mario',
                last_name: 'Rossi',
                email: 'mario@test.com',
                stage: 'interview',
                requisition_title: 'Software Dev',
                interview_count: '2',
                offer_count: '0',
            };
            mockQuery.mockResolvedValueOnce({ rows: [candidate], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/candidates/c-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.first_name).toBe('Mario');
            expect(res.body.data.interview_count).toBe('2');
        });
        it('should return 404 when candidate not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/candidates/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /candidates
    // =========================================================================
    describe('POST /candidates', () => {
        const validPayload = {
            first_name: 'Giulia',
            last_name: 'Colombo',
            email: 'giulia.colombo@example.com',
            source: 'linkedin',
        };
        it('should create a candidate and return 201', async () => {
            const created = { id: 'c-new', ...validPayload, stage: 'new' };
            mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/candidates')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.first_name).toBe('Giulia');
            expect(res.body.message).toBe('Candidate added');
        });
        it('should return 400 when first_name is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/candidates')
                .set('Authorization', `Bearer ${token}`)
                .send({ last_name: 'Colombo', email: 'test@test.com' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 400 when email is invalid', async () => {
            const res = await supertest(app)
                .post('/api/v1/candidates')
                .set('Authorization', `Bearer ${token}`)
                .send({ first_name: 'Test', last_name: 'User', email: 'not-an-email' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 409 when duplicate email for same requisition', async () => {
            // First query: duplicate check returns existing
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/candidates')
                .set('Authorization', `Bearer ${token}`)
                .send({
                ...validPayload,
                requisition_id: '11111111-2222-4333-a444-555555555555',
            });
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Candidate already applied for this position');
        });
        it('should accept optional fields', async () => {
            const fullPayload = {
                ...validPayload,
                requisition_id: '11111111-2222-4333-a444-555555555555',
                phone: '+39 02 1234567',
                current_company: 'TechCorp',
                job_title: 'Senior Developer',
                experience_years: 8,
                skills: ['TypeScript', 'React'],
            };
            // No duplicate found
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({
                rows: [{ id: 'c-new', ...fullPayload, stage: 'new' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/candidates')
                .set('Authorization', `Bearer ${token}`)
                .send(fullPayload);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // PATCH /candidates/:id
    // =========================================================================
    describe('PATCH /candidates/:id', () => {
        it('should update a candidate', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'c-1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'c-1', rating: 4.5 }], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/candidates/c-1')
                .set('Authorization', `Bearer ${token}`)
                .send({ rating: 4.5 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Candidate updated');
        });
        it('should return 404 when candidate not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/candidates/nonexistent')
                .set('Authorization', `Bearer ${token}`)
                .send({ rating: 3.0 });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when no fields to update', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c-1' }], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/candidates/c-1')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No fields to update');
        });
    });
    // =========================================================================
    // POST /candidates/:id/advance
    // =========================================================================
    describe('POST /candidates/:id/advance', () => {
        it('should advance candidate to next stage automatically', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ stage: 'new' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'c-1', stage: 'screening' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // history log
            const res = await supertest(app)
                .post('/api/v1/candidates/c-1/advance')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('advanced to');
        });
        it('should advance to a specific stage', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ stage: 'screening' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'c-1', stage: 'interview' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // history log
            const res = await supertest(app)
                .post('/api/v1/candidates/c-1/advance')
                .set('Authorization', `Bearer ${token}`)
                .send({ next_stage: 'interview' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Candidate advanced to interview');
        });
        it('should return 404 when candidate not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/candidates/nonexistent/advance')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 for invalid stage at end of pipeline', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ stage: 'hired' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/candidates/c-1/advance')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid stage transition');
        });
    });
    // =========================================================================
    // POST /candidates/:id/reject
    // =========================================================================
    describe('POST /candidates/:id/reject', () => {
        it('should reject a candidate with reason', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ stage: 'interview' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'c-1', stage: 'rejected' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // history log
            const res = await supertest(app)
                .post('/api/v1/candidates/c-1/reject')
                .set('Authorization', `Bearer ${token}`)
                .send({ reason: 'Insufficient experience' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Candidate rejected');
        });
        it('should reject without a reason', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ stage: 'screening' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'c-1', stage: 'rejected' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/candidates/c-1/reject')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return 404 when candidate not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/candidates/nonexistent/reject')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // DELETE /candidates/:id
    // =========================================================================
    describe('DELETE /candidates/:id', () => {
        it('should delete a candidate', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c-1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/candidates/c-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Candidate deleted');
        });
        it('should return 404 when candidate not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/candidates/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // Error handling
    // =========================================================================
    describe('Error Handling', () => {
        it('should return 500 when database fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/candidates/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=candidates.test.js.map