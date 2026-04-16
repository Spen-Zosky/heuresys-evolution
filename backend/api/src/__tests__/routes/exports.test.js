/**
 * Exports Routes - Unit Tests
 *
 * Tests:
 *   GET    /exports/stats                - Export statistics
 *   GET    /exports/configs              - List export configs
 *   GET    /exports/configs/:id          - Get config by ID
 *   POST   /exports/configs              - Create config (Zod)
 *   PATCH  /exports/configs/:id          - Update config
 *   DELETE /exports/configs/:id          - Delete config
 *   GET    /exports/jobs                 - List export jobs
 *   GET    /exports/jobs/:id             - Get job by ID
 *   POST   /exports/jobs                 - Create export job (Zod)
 *   POST   /exports/jobs/:id/cancel      - Cancel export job
 *   POST   /exports/report/:reportId     - Quick export report
 *   POST   /exports/table/:tableName     - Quick export table
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
// Mock dataExportService
const mockDataExportService = {
    getExportStats: jest.fn(),
    listConfigs: jest.fn(),
    getConfig: jest.fn(),
    createConfig: jest.fn(),
    updateConfig: jest.fn(),
    deleteConfig: jest.fn(),
    listJobs: jest.fn(),
    getJob: jest.fn(),
    createExportJob: jest.fn(),
    cancelJob: jest.fn(),
};
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
jest.unstable_mockModule(resolve('../../services/data-export.js'), () => ({
    dataExportService: mockDataExportService,
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/exports.js');
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
    app.use('/api/v1/exports', authMiddleware);
    app.use('/api/v1/exports', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        next();
    });
    app.use('/api/v1/exports', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
describe('Exports Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/exports/stats');
        expect(res.status).toBe(401);
    });
    // GET /stats
    it('GET /stats should return export statistics', async () => {
        mockDataExportService.getExportStats.mockResolvedValueOnce({
            totalConfigs: 5,
            totalJobs: 20,
            completedJobs: 15,
        });
        const res = await supertest(app)
            .get('/api/v1/exports/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.totalConfigs).toBe(5);
    });
    it('GET /stats should return 500 on service error', async () => {
        mockDataExportService.getExportStats.mockRejectedValueOnce(new Error('Service error'));
        const res = await supertest(app)
            .get('/api/v1/exports/stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
    // GET /configs
    it('GET /configs should return config list', async () => {
        mockDataExportService.listConfigs.mockResolvedValueOnce([
            { id: 'c1', name: 'Employee Export', data_source: 'employees' },
        ]);
        const res = await supertest(app)
            .get('/api/v1/exports/configs')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // GET /configs/:id
    it('GET /configs/:id should return config', async () => {
        mockDataExportService.getConfig.mockResolvedValueOnce({
            id: 'c1',
            name: 'Employee Export',
            data_source: 'employees',
        });
        const res = await supertest(app)
            .get('/api/v1/exports/configs/c1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Employee Export');
    });
    it('GET /configs/:id should return 404 when not found', async () => {
        mockDataExportService.getConfig.mockResolvedValueOnce(null);
        const res = await supertest(app)
            .get('/api/v1/exports/configs/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // POST /configs (Zod: name, data_source, options required)
    it('POST /configs should return 400 when missing required fields', async () => {
        const res = await supertest(app)
            .post('/api/v1/exports/configs')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /configs should create config successfully', async () => {
        mockDataExportService.createConfig.mockResolvedValueOnce({
            id: 'c-new',
            name: 'New Export',
            data_source: 'departments',
        });
        const res = await supertest(app)
            .post('/api/v1/exports/configs')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'New Export', data_source: 'departments', options: { format: 'csv' } });
        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe('c-new');
    });
    // PATCH /configs/:id
    it('PATCH /configs/:id should return 404 when not found', async () => {
        mockDataExportService.updateConfig.mockResolvedValueOnce(null);
        const res = await supertest(app)
            .patch('/api/v1/exports/configs/nonexistent')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated' });
        expect(res.status).toBe(404);
    });
    it('PATCH /configs/:id should update config', async () => {
        mockDataExportService.updateConfig.mockResolvedValueOnce({
            id: 'c1',
            name: 'Updated Export',
        });
        const res = await supertest(app)
            .patch('/api/v1/exports/configs/c1')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Export' });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Updated Export');
    });
    // DELETE /configs/:id
    it('DELETE /configs/:id should return 404 when not found', async () => {
        mockDataExportService.deleteConfig.mockResolvedValueOnce(false);
        const res = await supertest(app)
            .delete('/api/v1/exports/configs/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('DELETE /configs/:id should delete config', async () => {
        mockDataExportService.deleteConfig.mockResolvedValueOnce(true);
        const res = await supertest(app)
            .delete('/api/v1/exports/configs/c1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    // GET /jobs
    it('GET /jobs should return job list with pagination', async () => {
        mockDataExportService.listJobs.mockResolvedValueOnce({
            jobs: [{ id: 'j1', type: 'report', status: 'completed' }],
            total: 1,
        });
        const res = await supertest(app)
            .get('/api/v1/exports/jobs')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.meta.total).toBe(1);
    });
    // GET /jobs/:id
    it('GET /jobs/:id should return job details', async () => {
        mockDataExportService.getJob.mockResolvedValueOnce({
            id: 'j1',
            type: 'report',
            status: 'completed',
        });
        const res = await supertest(app)
            .get('/api/v1/exports/jobs/j1')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('j1');
    });
    it('GET /jobs/:id should return 404 when not found', async () => {
        mockDataExportService.getJob.mockResolvedValueOnce(null);
        const res = await supertest(app)
            .get('/api/v1/exports/jobs/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    // POST /jobs (Zod: type, options.format required)
    it('POST /jobs should return 400 when missing required fields', async () => {
        const res = await supertest(app)
            .post('/api/v1/exports/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(res.status).toBe(400);
    });
    it('POST /jobs should create export job', async () => {
        mockDataExportService.createExportJob.mockResolvedValueOnce({
            id: 'j-new',
            type: 'report',
            status: 'processing',
        });
        const res = await supertest(app)
            .post('/api/v1/exports/jobs')
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'report', options: { format: 'csv' } });
        expect(res.status).toBe(202);
        expect(res.body.data.id).toBe('j-new');
    });
    // POST /jobs/:id/cancel
    it('POST /jobs/:id/cancel should return 400 when cannot cancel', async () => {
        mockDataExportService.cancelJob.mockResolvedValueOnce(false);
        const res = await supertest(app)
            .post('/api/v1/exports/jobs/j1/cancel')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
    it('POST /jobs/:id/cancel should cancel job', async () => {
        mockDataExportService.cancelJob.mockResolvedValueOnce(true);
        const res = await supertest(app)
            .post('/api/v1/exports/jobs/j1/cancel')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
    // POST /report/:reportId
    it('POST /report/:reportId should create report export', async () => {
        mockDataExportService.createExportJob.mockResolvedValueOnce({
            id: 'j-report',
            type: 'report',
            status: 'processing',
        });
        const res = await supertest(app)
            .post('/api/v1/exports/report/r1')
            .set('Authorization', `Bearer ${token}`)
            .send({ format: 'csv' });
        expect(res.status).toBe(202);
    });
    // POST /table/:tableName
    it('POST /table/:tableName should create table export', async () => {
        mockDataExportService.createExportJob.mockResolvedValueOnce({
            id: 'j-table',
            type: 'table',
            status: 'processing',
        });
        const res = await supertest(app)
            .post('/api/v1/exports/table/employees')
            .set('Authorization', `Bearer ${token}`)
            .send({ format: 'csv' });
        expect(res.status).toBe(202);
    });
});
//# sourceMappingURL=exports.test.js.map