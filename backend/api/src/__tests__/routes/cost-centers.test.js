/**
 * Cost Centers Routes - Unit Tests
 *
 * Tests:
 *   GET    /cost-centers          - List cost centers
 *   GET    /cost-centers/types    - Get distinct types
 *   GET    /cost-centers/:id      - Get by ID
 *   POST   /cost-centers          - Create cost center
 *   PATCH  /cost-centers/:id      - Update cost center
 *   DELETE /cost-centers/:id      - Delete (deactivate) cost center
 *   GET    /cost-centers/:id/employees - Get employees by cost center
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
const { default: routes } = await import('../../routes/cost-centers.js');
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
    app.use('/api/v1/cost-centers', authMiddleware);
    app.use('/api/v1/cost-centers', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockClientQuery, release: mockClientRelease };
        next();
    });
    app.use('/api/v1/cost-centers', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Cost Centers Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/cost-centers');
        expect(res.status).toBe(401);
    });
    // GET /cost-centers
    it('GET / should return cost centers list', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'cc1', code: 'CC001', name: 'IT' }],
            rowCount: 1,
        });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/cost-centers')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta.total).toBe(10);
    });
    it('GET / should support search filter', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
        const res = await supertest(app)
            .get('/api/v1/cost-centers?search=IT')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    it('GET / should return 500 on DB error', async () => {
        mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app)
            .get('/api/v1/cost-centers')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // GET /cost-centers/types
    it('GET /types should return distinct types', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ cost_center_type: 'operational' }, { cost_center_type: 'project' }],
            rowCount: 2,
        });
        const res = await supertest(app)
            .get('/api/v1/cost-centers/types')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual(['operational', 'project']);
    });
    // GET /cost-centers/:id
    it('GET /:id should return cost center by ID', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'cc1', code: 'CC001', name: 'IT', employee_count: '5' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/cost-centers/cc1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.code).toBe('CC001');
    });
    it('GET /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .get('/api/v1/cost-centers/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // POST /cost-centers (Zod)
    it('POST / should return 400 on Zod validation (missing code and name)', async () => {
        const res = await supertest(app)
            .post('/api/v1/cost-centers')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST / should return 409 when code already exists', async () => {
        // existing check
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'cc-existing' }], rowCount: 1 });
        const res = await supertest(app)
            .post('/api/v1/cost-centers')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: 'CC001', name: 'IT OrgUnit' });
        expect(res.status).toBe(409);
    });
    it('POST / should create cost center successfully', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no existing
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'cc-new', code: 'CC099', name: 'New CC' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .post('/api/v1/cost-centers')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: 'CC099', name: 'New CC' });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
    // PATCH /cost-centers/:id
    it('PATCH /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .patch('/api/v1/cost-centers/nonexistent')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated' });
        expect(res.status).toBe(404);
    });
    it('PATCH /:id should update cost center', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'cc1' }], rowCount: 1 }); // exists
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'cc1', name: 'Updated' }], rowCount: 1 }); // update
        const res = await supertest(app)
            .patch('/api/v1/cost-centers/cc1')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated' });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Updated');
    });
    // DELETE /cost-centers/:id
    it('DELETE /:id should return 404 when not found', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app)
            .delete('/api/v1/cost-centers/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('DELETE /:id should return 400 when employees assigned', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'cc1', name: 'IT' }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 }); // employees exist
        const res = await supertest(app)
            .delete('/api/v1/cost-centers/cc1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
    it('DELETE /:id should deactivate cost center with no employees', async () => {
        mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'cc1', name: 'IT' }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
        mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // update
        const res = await supertest(app)
            .delete('/api/v1/cost-centers/cc1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    // GET /cost-centers/:id/employees
    it('GET /:id/employees should return employees', async () => {
        mockClientQuery.mockResolvedValueOnce({
            rows: [{ id: 'e1', first_name: 'Mario', last_name: 'Rossi' }],
            rowCount: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/cost-centers/cc1/employees')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
});
//# sourceMappingURL=cost-centers.test.js.map