/**
 * Contracts Routes - Unit Tests
 *
 * Tests:
 *   GET    /contracts/meta/types          - Contract types metadata
 *   GET    /contracts/meta/ccnl           - CCNL types metadata
 *   GET    /contracts/meta/amendment-types - Amendment types metadata
 *   GET    /contracts                     - List contracts
 *   GET    /contracts/expiring            - Expiring contracts
 *   GET    /contracts/employee/:employeeId - Employee contracts
 *   GET    /contracts/:id                 - Contract by ID
 *   POST   /contracts                     - Create contract
 *   PUT    /contracts/:id                 - Update contract
 *   POST   /contracts/:id/terminate       - Terminate contract
 *   POST   /contracts/:id/amendments      - Add amendment
 *   GET    /contracts/:id/amendments      - List amendments
 *   DELETE /contracts/:id                 - Delete contract
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
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
const { default: routes } = await import('../../routes/contracts.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/contracts', authMiddleware);
    app.use('/api/v1/contracts', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery, release: mockClientRelease };
        next();
    });
    app.use('/api/v1/contracts', routes);
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
describe('Contracts Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/contracts');
        expect(res.status).toBe(401);
    });
    // =========================================================================
    // METADATA ENDPOINTS (no DB queries)
    // =========================================================================
    it('GET /meta/types should return contract types', async () => {
        const res = await supertest(app)
            .get('/api/v1/contracts/meta/types')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data[0]).toHaveProperty('value');
        expect(res.body.data[0]).toHaveProperty('label');
    });
    it('GET /meta/ccnl should return CCNL options', async () => {
        const res = await supertest(app)
            .get('/api/v1/contracts/meta/ccnl')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
    it('GET /meta/amendment-types should return amendment types', async () => {
        const res = await supertest(app)
            .get('/api/v1/contracts/meta/amendment-types')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
    // =========================================================================
    // GET /contracts
    // =========================================================================
    it('GET / should return paginated contracts', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ total: '5' }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: '11111111-1111-1111-1111-111111111111',
                    contract_type: 'tempo_indeterminato',
                    status: 'active',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.meta).toBeDefined();
        expect(res.body.meta.total).toBe(5);
    });
    it('GET / should return 500 on DB error', async () => {
        mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app)
            .get('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // =========================================================================
    // GET /contracts/:id
    // =========================================================================
    it('GET /:id should return contract by ID', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: '11111111-1111-1111-1111-111111111111',
                    contract_type: 'tempo_indeterminato',
                    status: 'active',
                },
            ],
            rowCount: 1,
        });
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/contracts/11111111-1111-1111-1111-111111111111')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('11111111-1111-1111-1111-111111111111');
        expect(res.body.data.amendments).toEqual([]);
    });
    it('GET /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/contracts/00000000-0000-0000-0000-000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });
    // =========================================================================
    // GET /contracts/employee/:employeeId
    // =========================================================================
    it('GET /employee/:employeeId should return employee contracts', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [
                { id: '11111111-1111-1111-1111-111111111111', status: 'active' },
                { id: 'c2', status: 'terminated' },
            ],
            rowCount: 2,
        });
        const res = await supertest(app)
            .get(`/api/v1/contracts/employee/${DEFAULT_IDS.EMPLOYEE_ID}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.contracts).toHaveLength(2);
        expect(res.body.data.activeContract).toBeDefined();
        expect(res.body.data.totalContracts).toBe(2);
    });
    // =========================================================================
    // POST /contracts (Zod validation)
    // =========================================================================
    it('POST / should return 400 on Zod validation error (missing required fields)', async () => {
        const res = await supertest(app)
            .post('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST / should return 400 on invalid contract type', async () => {
        const res = await supertest(app)
            .post('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`)
            .send({
            employeeId: DEFAULT_IDS.EMPLOYEE_ID,
            contractType: 'invalid_type',
            startDate: '2025-01-01',
        });
        expect(res.status).toBe(400);
    });
    it('POST / should create contract successfully', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: DEFAULT_IDS.EMPLOYEE_ID }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'new-contract', contract_type: 'tempo_indeterminato', status: 'active' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`)
            .send({
            employeeId: DEFAULT_IDS.EMPLOYEE_ID,
            contractType: 'tempo_indeterminato',
            startDate: '2025-01-01',
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe('new-contract');
    });
    it('POST / should return 404 when employee not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`)
            .send({
            employeeId: 'aaaaaaaa-1111-2222-3333-444444444444',
            contractType: 'tempo_indeterminato',
            startDate: '2025-01-01',
        });
        expect(res.status).toBe(404);
    });
    it('POST / should return 409 when overlapping contract exists', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: DEFAULT_IDS.EMPLOYEE_ID }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-contract' }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/contracts')
            .set('Authorization', `Bearer ${token}`)
            .send({
            employeeId: DEFAULT_IDS.EMPLOYEE_ID,
            contractType: 'tempo_indeterminato',
            startDate: '2025-01-01',
        });
        expect(res.status).toBe(409);
    });
    // =========================================================================
    // POST /contracts/:id/terminate
    // =========================================================================
    it('POST /:id/terminate should terminate active contract', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: '11111111-1111-1111-1111-111111111111', status: 'active' }],
            rowCount: 1,
        });
        mockClientQuery.mockResolvedValueOnce({
            rows: [
                {
                    id: '11111111-1111-1111-1111-111111111111',
                    status: 'terminated',
                    termination_date: '2025-06-30',
                },
            ],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/contracts/11111111-1111-1111-1111-111111111111/terminate')
            .set('Authorization', `Bearer ${token}`)
            .send({ terminationDate: '2025-06-30', terminationReason: 'End of project' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('POST /:id/terminate should return 404 when contract not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .post('/api/v1/contracts/00000000-0000-0000-0000-000000000000/terminate')
            .set('Authorization', `Bearer ${token}`)
            .send({ terminationDate: '2025-06-30' });
        expect(res.status).toBe(404);
    });
    it('POST /:id/terminate should return 400 for non-active contract', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: '11111111-1111-1111-1111-111111111111', status: 'terminated' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/contracts/11111111-1111-1111-1111-111111111111/terminate')
            .set('Authorization', `Bearer ${token}`)
            .send({ terminationDate: '2025-06-30' });
        expect(res.status).toBe(400);
    });
    it('POST /:id/terminate should return 400 with Zod validation error when missing terminationDate', async () => {
        const res = await supertest(app)
            .post('/api/v1/contracts/11111111-1111-1111-1111-111111111111/terminate')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    // =========================================================================
    // DELETE /contracts/:id
    // =========================================================================
    it('DELETE /:id should delete draft contract', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ status: 'draft' }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/contracts/11111111-1111-1111-1111-111111111111')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('DELETE /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/contracts/00000000-0000-0000-0000-000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('DELETE /:id should return 400 for non-draft contract', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ status: 'active' }], rowCount: 1 });
        const res = await supertest(app)
            .delete('/api/v1/contracts/11111111-1111-1111-1111-111111111111')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
    // =========================================================================
    // GET/POST amendments
    // =========================================================================
    it('GET /:id/amendments should return amendments list', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: '11111111-1111-1111-1111-111111111111' }],
            rowCount: 1,
        });
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'a1', amendment_type: 'salary_change' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/contracts/11111111-1111-1111-1111-111111111111/amendments')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    it('GET /:id/amendments should return 404 when contract not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/contracts/00000000-0000-0000-0000-000000000000/amendments')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('POST /:id/amendments should return 500 on DB error', async () => {
        mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app)
            .post('/api/v1/contracts/11111111-1111-1111-1111-111111111111/amendments')
            .set('Authorization', `Bearer ${token}`)
            .send({
            amendmentType: 'salary_change',
            effectiveDate: '2025-03-01',
        });
        expect(res.status).toBe(500);
    });
});
//# sourceMappingURL=contracts.test.js.map