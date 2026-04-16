/**
 * SAP Migration Routes - Comprehensive Behavioral Tests
 * Tests actual HTTP request/response behavior for all sap-migration endpoints.
 * Covers: infotypes listing, formats, parse-test, jobs CRUD, parse/preview,
 * validation, mappings, execution, rollback, delta-sync, employee-mappings, stats.
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
// Mock SAP migration service
const mockListJobs = jest.fn();
const mockCreateMigrationJob = jest.fn();
const mockGetJob = jest.fn();
const mockUpdateJobStatus = jest.fn();
const mockParseAndStage = jest.fn();
const mockValidateStagedData = jest.fn();
const mockGetValidationErrors = jest.fn();
const mockGetMappings = jest.fn();
const mockCreateMapping = jest.fn();
const mockUpdateMapping = jest.fn();
const mockDeleteMapping = jest.fn();
const mockMapStagedData = jest.fn();
const mockExecuteMigration = jest.fn();
const mockRollbackMigration = jest.fn();
const mockDeltaSyncCheck = jest.fn();
const mockExecuteDeltaSync = jest.fn();
const mockGetDeltaSyncHistory = jest.fn();
const mockGetEmployeeMappings = jest.fn();
const mockCreateEmployeeMapping = jest.fn();
const mockGetStats = jest.fn();
const mockParseCSV = jest.fn();
const mockParseJSON = jest.fn();
const mockParseXML = jest.fn();
jest.unstable_mockModule(resolve('../../services/sap-migration.js'), () => ({
    SAPMigrationService: jest.fn().mockImplementation(() => ({
        listJobs: mockListJobs,
        createMigrationJob: mockCreateMigrationJob,
        getJob: mockGetJob,
        updateJobStatus: mockUpdateJobStatus,
        parseAndStage: mockParseAndStage,
        validateStagedData: mockValidateStagedData,
        getValidationErrors: mockGetValidationErrors,
        getMappings: mockGetMappings,
        createMapping: mockCreateMapping,
        updateMapping: mockUpdateMapping,
        deleteMapping: mockDeleteMapping,
        mapStagedData: mockMapStagedData,
        executeMigration: mockExecuteMigration,
        rollbackMigration: mockRollbackMigration,
        deltaSyncCheck: mockDeltaSyncCheck,
        executeDeltaSync: mockExecuteDeltaSync,
        getDeltaSyncHistory: mockGetDeltaSyncHistory,
        getEmployeeMappings: mockGetEmployeeMappings,
        createEmployeeMapping: mockCreateEmployeeMapping,
        getStats: mockGetStats,
    })),
    SAPExportParser: jest.fn().mockImplementation(() => ({
        parseCSV: mockParseCSV,
        parseJSON: mockParseJSON,
        parseXML: mockParseXML,
    })),
    MigrationJobConfig: undefined,
}));
const { default: express } = await import('express');
const { default: sapMigrationRoutes } = await import('../../routes/sap-migration.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const JOB_ID = '11111111-aaaa-bbbb-cccc-dddddddddddd';
const MAPPING_ID = '22222222-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/sap-migration', authMiddleware);
    app.use('/api/v1/sap-migration', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/sap-migration', sapMigrationRoutes);
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
describe('SAP Migration Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // ===========================================================================
    // PUBLIC ENDPOINTS
    // ===========================================================================
    describe('GET /sap-migration/infotypes', () => {
        it('should return list of supported SAP infotypes with summary', async () => {
            const res = await supertest(app)
                .get('/api/v1/sap-migration/infotypes')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.infotypes).toBeInstanceOf(Array);
            expect(res.body.data.infotypes.length).toBeGreaterThan(0);
            expect(res.body.data.summary).toBeDefined();
            expect(res.body.data.summary.totalPA).toBeGreaterThan(0);
            expect(res.body.data.summary.totalHRP).toBeGreaterThan(0);
            expect(res.body.data.summary.total).toBe(res.body.data.summary.totalPA + res.body.data.summary.totalHRP);
        });
        it('should include PA and HRP infotype codes', async () => {
            const res = await supertest(app)
                .get('/api/v1/sap-migration/infotypes')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const codes = res.body.data.infotypes.map((i) => i.code);
            expect(codes).toContain('PA0000');
            expect(codes).toContain('PA0002');
            expect(codes).toContain('HRP1000');
        });
        it('should have code, name, and description for each infotype', async () => {
            const res = await supertest(app)
                .get('/api/v1/sap-migration/infotypes')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            for (const infotype of res.body.data.infotypes) {
                expect(infotype).toHaveProperty('code');
                expect(infotype).toHaveProperty('name');
                expect(infotype).toHaveProperty('description');
            }
        });
    });
    describe('GET /sap-migration/formats', () => {
        it('should return supported file formats', async () => {
            const res = await supertest(app)
                .get('/api/v1/sap-migration/formats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.supported).toBeInstanceOf(Array);
            expect(res.body.data.supported.length).toBe(4);
            expect(res.body.data.maxFileSize).toBe('100MB');
            expect(res.body.data.maxFiles).toBe(10);
        });
        it('should include csv, xml, json, and zip formats', async () => {
            const res = await supertest(app)
                .get('/api/v1/sap-migration/formats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const extensions = res.body.data.supported.map((f) => f.extension);
            expect(extensions).toContain('.csv');
            expect(extensions).toContain('.xml');
            expect(extensions).toContain('.json');
            expect(extensions).toContain('.zip');
        });
    });
    describe('POST /sap-migration/parse-test', () => {
        it('should parse CSV content and return preview', async () => {
            const csvRecords = [
                { infotype: 'PA0002', pernr: '00001', data: { first_name: 'Mario', last_name: 'Rossi' } },
            ];
            mockParseCSV.mockReturnValue(csvRecords);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'PERNR|FIRST_NAME\n00001|Mario', format: 'csv' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRecords).toBe(1);
            expect(res.body.data.previewRecords).toHaveLength(1);
            expect(res.body.data.detectedFormat).toBe('csv');
        });
        it('should parse JSON content', async () => {
            const jsonRecords = [{ infotype: 'PA0002', pernr: '00002', data: { first_name: 'Lucia' } }];
            mockParseJSON.mockReturnValue(jsonRecords);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: '[{"PERNR":"00002"}]', format: 'json' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRecords).toBe(1);
        });
        it('should parse XML content', async () => {
            const xmlRecords = [{ infotype: 'PA0002', pernr: '00003', data: { first_name: 'Marco' } }];
            mockParseXML.mockReturnValue(xmlRecords);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: '<records></records>', format: 'xml' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should reject invalid format', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data', format: 'invalid' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing fileContent', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'csv' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing format', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'some data' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should respect limit parameter', async () => {
            const manyRecords = Array.from({ length: 20 }, (_, i) => ({
                infotype: 'PA0002',
                pernr: String(i).padStart(5, '0'),
                data: { name: `Record ${i}` },
            }));
            mockParseCSV.mockReturnValue(manyRecords);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-test')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data', format: 'csv', limit: 5 });
            expect(res.status).toBe(200);
            expect(res.body.data.totalRecords).toBe(20);
            expect(res.body.data.previewRecords).toHaveLength(5);
        });
    });
    // ===========================================================================
    // AUTH / UNAUTH
    // ===========================================================================
    describe('Authentication', () => {
        it('should return 401 for protected endpoint without token', async () => {
            const res = await supertest(app).get('/api/v1/sap-migration/jobs');
            expect(res.status).toBe(401);
        });
    });
    // ===========================================================================
    // MIGRATION JOBS
    // ===========================================================================
    describe('GET /sap-migration/jobs', () => {
        it('should return list of migration jobs', async () => {
            const jobs = [
                { id: JOB_ID, name: 'Full Migration', status: 'pending', created_at: '2025-01-01' },
            ];
            mockListJobs.mockResolvedValue(jobs);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/jobs')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(jobs);
        });
        it('should pass status filter to service', async () => {
            mockListJobs.mockResolvedValue([]);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/jobs?status=pending')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(mockListJobs).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
        });
        it('should pass pagination params to service', async () => {
            mockListJobs.mockResolvedValue([]);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/jobs?limit=10&offset=5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(mockListJobs).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 5 }));
        });
    });
    describe('POST /sap-migration/jobs', () => {
        it('should create a new migration job and return 201', async () => {
            mockCreateMigrationJob.mockResolvedValue(JOB_ID);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/jobs')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Full Migration', sourceSystem: 'SAP ECC 6.0' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.jobId).toBe(JOB_ID);
            expect(res.body.message).toBe('Migration job created');
        });
        it('should reject when name is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/jobs')
                .set('Authorization', `Bearer ${token}`)
                .send({ sourceSystem: 'SAP ECC 6.0' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('GET /sap-migration/jobs/:id', () => {
        it('should return job details when found', async () => {
            const job = { id: JOB_ID, name: 'Full Migration', status: 'pending' };
            mockGetJob.mockResolvedValue(job);
            const res = await supertest(app)
                .get(`/api/v1/sap-migration/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(job);
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .get(`/api/v1/sap-migration/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('DELETE /sap-migration/jobs/:id', () => {
        it('should cancel a pending job', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'pending' });
            mockUpdateJobStatus.mockResolvedValue(undefined);
            const res = await supertest(app)
                .delete(`/api/v1/sap-migration/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Migration job cancelled');
            expect(mockUpdateJobStatus).toHaveBeenCalledWith(JOB_ID, 'cancelled');
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .delete(`/api/v1/sap-migration/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when trying to delete a completed job', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'completed' });
            const res = await supertest(app)
                .delete(`/api/v1/sap-migration/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Cannot delete completed or in-progress jobs');
        });
        it('should return 400 when trying to delete an in-progress job', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'in_progress' });
            const res = await supertest(app)
                .delete(`/api/v1/sap-migration/jobs/${JOB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Cannot delete completed or in-progress jobs');
        });
    });
    // ===========================================================================
    // FILE PARSING & STAGING
    // ===========================================================================
    describe('POST /sap-migration/jobs/:id/parse', () => {
        it('should parse and stage data for a job', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'pending' });
            mockParseAndStage.mockResolvedValue({ totalRecords: 50, stagedCount: 48 });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/parse`)
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'PERNR|NAME\n00001|Mario', format: 'csv', infotype: 'PA0002' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRecords).toBe(50);
            expect(res.body.data.stagedCount).toBe(48);
            expect(res.body.message).toContain('Parsed 50 records');
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/parse`)
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data', format: 'csv' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should reject missing fileContent', async () => {
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/parse`)
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'csv' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing format', async () => {
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/parse`)
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /sap-migration/parse-preview', () => {
        it('should return preview of parsed data', async () => {
            const records = [{ infotype: 'PA0002', pernr: '00001', data: { first_name: 'Mario' } }];
            mockParseCSV.mockReturnValue(records);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-preview')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'PERNR|NAME\n00001|Mario', format: 'csv' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRecords).toBe(1);
            expect(res.body.data.detectedFormat).toBe('csv');
        });
        it('should reject missing fileContent', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-preview')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'csv' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject unsupported format', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/parse-preview')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data', format: 'yaml' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // ===========================================================================
    // VALIDATION
    // ===========================================================================
    describe('POST /sap-migration/jobs/:id/validate', () => {
        it('should validate staged data and return results', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'parsed' });
            mockValidateStagedData.mockResolvedValue({
                validCount: 45,
                errorCount: 3,
                warningCount: 2,
            });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/validate`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.validCount).toBe(45);
            expect(res.body.data.errorCount).toBe(3);
            expect(res.body.data.warningCount).toBe(2);
            expect(res.body.message).toContain('45 valid');
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/validate`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    describe('GET /sap-migration/jobs/:id/validation-errors', () => {
        it('should return validation errors for a job', async () => {
            const errors = [{ field: 'PERNR', message: 'Invalid format', severity: 'error' }];
            mockGetValidationErrors.mockResolvedValue(errors);
            const res = await supertest(app)
                .get(`/api/v1/sap-migration/jobs/${JOB_ID}/validation-errors`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(errors);
        });
        it('should pass severity filter and pagination', async () => {
            mockGetValidationErrors.mockResolvedValue([]);
            const res = await supertest(app)
                .get(`/api/v1/sap-migration/jobs/${JOB_ID}/validation-errors?severity=error&limit=50&offset=10`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(mockGetValidationErrors).toHaveBeenCalledWith(JOB_ID, {
                severity: 'error',
                limit: 50,
                offset: 10,
            });
        });
    });
    // ===========================================================================
    // MAPPING
    // ===========================================================================
    describe('GET /sap-migration/mappings', () => {
        it('should return mapping rules', async () => {
            const mappings = [
                { id: MAPPING_ID, infotype: 'PA0002', sapField: 'NACHN', targetField: 'last_name' },
            ];
            mockGetMappings.mockResolvedValue(mappings);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/mappings')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mappings);
        });
        it('should pass infotype filter', async () => {
            mockGetMappings.mockResolvedValue([]);
            await supertest(app)
                .get('/api/v1/sap-migration/mappings?infotype=PA0002')
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetMappings).toHaveBeenCalledWith('PA0002');
        });
    });
    describe('POST /sap-migration/mappings', () => {
        const validMapping = {
            infotype: 'PA0002',
            infotypeName: 'Personal Data',
            sapField: 'NACHN',
            targetTable: 'employees',
            targetField: 'last_name',
            transformType: 'direct',
            required: true,
        };
        it('should create a new mapping and return 201', async () => {
            mockCreateMapping.mockResolvedValue(MAPPING_ID);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/mappings')
                .set('Authorization', `Bearer ${token}`)
                .send(validMapping);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.mappingId).toBe(MAPPING_ID);
            expect(res.body.message).toBe('Mapping created');
        });
        it('should reject when infotype is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...validMapping, infotype: undefined });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject when sapField is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...validMapping, sapField: undefined });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject when targetTable is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...validMapping, targetTable: undefined });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject when targetField is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ ...validMapping, targetField: undefined });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('PUT /sap-migration/mappings/:id', () => {
        it('should update a mapping', async () => {
            mockUpdateMapping.mockResolvedValue(undefined);
            const res = await supertest(app)
                .put(`/api/v1/sap-migration/mappings/${MAPPING_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ targetField: 'first_name' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Mapping updated');
        });
    });
    describe('DELETE /sap-migration/mappings/:id', () => {
        it('should delete a mapping', async () => {
            mockDeleteMapping.mockResolvedValue(undefined);
            const res = await supertest(app)
                .delete(`/api/v1/sap-migration/mappings/${MAPPING_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Mapping deleted');
        });
    });
    describe('POST /sap-migration/jobs/:id/map', () => {
        it('should apply mappings to staged data', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'validated' });
            mockMapStagedData.mockResolvedValue({ mappedCount: 40, errorCount: 2 });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/map`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.mappedCount).toBe(40);
            expect(res.body.data.errorCount).toBe(2);
            expect(res.body.message).toContain('40 mapped');
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/map`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // ===========================================================================
    // MIGRATION EXECUTION
    // ===========================================================================
    describe('POST /sap-migration/jobs/:id/dry-run', () => {
        it('should execute dry run and return results', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'mapped' });
            mockExecuteMigration.mockResolvedValue({ successCount: 45, errorCount: 3 });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/dry-run`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.successCount).toBe(45);
            expect(res.body.data.errorCount).toBe(3);
            expect(res.body.message).toContain('45 would succeed');
            expect(mockExecuteMigration).toHaveBeenCalledWith(JOB_ID, true);
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/dry-run`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /sap-migration/jobs/:id/execute', () => {
        it('should execute migration when confirmed', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'mapped' });
            mockExecuteMigration.mockResolvedValue({
                success: true,
                successCount: 48,
                errorCount: 0,
            });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/execute`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmExecution: true });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.successCount).toBe(48);
            expect(res.body.message).toContain('48 records migrated');
            expect(mockExecuteMigration).toHaveBeenCalledWith(JOB_ID, false);
        });
        it('should return 400 when confirmExecution is not true', async () => {
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/execute`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmExecution: false });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Must set confirmExecution: true to proceed');
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/execute`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmExecution: true });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 for already completed job', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'completed' });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/execute`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmExecution: true });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Job already completed');
        });
    });
    describe('POST /sap-migration/jobs/:id/rollback', () => {
        it('should rollback a completed migration', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'completed' });
            mockRollbackMigration.mockResolvedValue({ rolledBackCount: 48 });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/rollback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmRollback: true });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.rolledBackCount).toBe(48);
            expect(res.body.message).toContain('48 records restored');
        });
        it('should return 400 when confirmRollback is not true', async () => {
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/rollback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmRollback: false });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Must set confirmRollback: true to proceed');
        });
        it('should return 404 when job not found', async () => {
            mockGetJob.mockResolvedValue(null);
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/rollback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmRollback: true });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when job is not completed', async () => {
            mockGetJob.mockResolvedValue({ id: JOB_ID, status: 'pending' });
            const res = await supertest(app)
                .post(`/api/v1/sap-migration/jobs/${JOB_ID}/rollback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ confirmRollback: true });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Can only rollback completed jobs');
        });
    });
    // ===========================================================================
    // DELTA SYNC
    // ===========================================================================
    describe('POST /sap-migration/delta-sync/check', () => {
        it('should check for changes since last sync', async () => {
            mockDeltaSyncCheck.mockResolvedValue({
                changedRecords: 5,
                newRecords: 2,
                deletedRecords: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/sap-migration/delta-sync/check')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'PERNR|NAME\n00001|Mario', format: 'csv' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.changedRecords).toBe(5);
            expect(res.body.data.newRecords).toBe(2);
            expect(res.body.data.deletedRecords).toBe(1);
            expect(res.body.message).toContain('5 changed');
        });
        it('should reject missing fileContent', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/delta-sync/check')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'csv' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing format', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/delta-sync/check')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('POST /sap-migration/delta-sync/execute', () => {
        it('should execute delta sync when confirmed', async () => {
            mockExecuteDeltaSync.mockResolvedValue({
                updatedCount: 5,
                createdCount: 2,
            });
            const res = await supertest(app)
                .post('/api/v1/sap-migration/delta-sync/execute')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'PERNR|NAME\n00001|Mario', format: 'csv', confirmSync: true });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.updatedCount).toBe(5);
            expect(res.body.data.createdCount).toBe(2);
            expect(res.body.message).toContain('5 updated');
        });
        it('should return 400 when confirmSync is not true', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/delta-sync/execute')
                .set('Authorization', `Bearer ${token}`)
                .send({ fileContent: 'data', format: 'csv', confirmSync: false });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Must set confirmSync: true to proceed');
        });
        it('should reject missing fileContent', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/delta-sync/execute')
                .set('Authorization', `Bearer ${token}`)
                .send({ format: 'csv', confirmSync: true });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    describe('GET /sap-migration/delta-sync/history', () => {
        it('should return delta sync history', async () => {
            const history = [{ id: '1', synced_at: '2025-01-01', records_updated: 10 }];
            mockGetDeltaSyncHistory.mockResolvedValue(history);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/delta-sync/history')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(history);
        });
        it('should pass pagination params', async () => {
            mockGetDeltaSyncHistory.mockResolvedValue([]);
            await supertest(app)
                .get('/api/v1/sap-migration/delta-sync/history?limit=10&offset=5')
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetDeltaSyncHistory).toHaveBeenCalledWith({ limit: 10, offset: 5 });
        });
    });
    // ===========================================================================
    // EMPLOYEE MAPPINGS
    // ===========================================================================
    describe('GET /sap-migration/employee-mappings', () => {
        it('should return employee mappings', async () => {
            const mappings = [
                { sap_pernr: '00001', employee_id: DEFAULT_IDS.EMPLOYEE_ID, first_name: 'Mario' },
            ];
            mockGetEmployeeMappings.mockResolvedValue(mappings);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/employee-mappings')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mappings);
        });
        it('should pass pagination params', async () => {
            mockGetEmployeeMappings.mockResolvedValue([]);
            await supertest(app)
                .get('/api/v1/sap-migration/employee-mappings?limit=50&offset=25')
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetEmployeeMappings).toHaveBeenCalledWith({ limit: 50, offset: 25 });
        });
    });
    describe('POST /sap-migration/employee-mappings', () => {
        it('should create employee mapping and return 201', async () => {
            mockCreateEmployeeMapping.mockResolvedValue(undefined);
            const res = await supertest(app)
                .post('/api/v1/sap-migration/employee-mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ sapPernr: '00001', employeeId: DEFAULT_IDS.EMPLOYEE_ID });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Employee mapping created');
        });
        it('should reject missing sapPernr', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/employee-mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ employeeId: DEFAULT_IDS.EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject missing employeeId', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/employee-mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ sapPernr: '00001' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject invalid employeeId format', async () => {
            const res = await supertest(app)
                .post('/api/v1/sap-migration/employee-mappings')
                .set('Authorization', `Bearer ${token}`)
                .send({ sapPernr: '00001', employeeId: 'not-a-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // ===========================================================================
    // STATISTICS
    // ===========================================================================
    describe('GET /sap-migration/stats', () => {
        it('should return migration statistics', async () => {
            const stats = {
                totalJobs: 5,
                completedJobs: 3,
                totalRecordsMigrated: 500,
                lastMigration: '2025-01-15',
            };
            mockGetStats.mockResolvedValue(stats);
            const res = await supertest(app)
                .get('/api/v1/sap-migration/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(stats);
        });
    });
});
//# sourceMappingURL=sap-migration.test.js.map