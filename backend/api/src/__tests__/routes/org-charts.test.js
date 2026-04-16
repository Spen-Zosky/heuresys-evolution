/**
 * org-charts Routes - Unit Tests
 * Comprehensive behavioral tests for org-charts endpoints.
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
// Mock services used by org-charts routes
const mockCreateSession = jest.fn();
const mockGetSession = jest.fn();
const mockGenerate = jest.fn();
const mockAssignEmployeesToPositions = jest.fn();
const mockGenerateComparison = jest.fn();
const mockApproveChanges = jest.fn();
const mockApplyApprovedChanges = jest.fn();
const mockExportAsCSV = jest.fn();
const mockExportDetailedCSV = jest.fn();
const mockExportToExcalidraw = jest.fn();
const mockExportStagingToExcalidraw = jest.fn();
const mockGetSnapshot = jest.fn();
const mockSaveSnapshot = jest.fn();
const mockGetTenantContext = jest.fn();
const mockGetPrototypeForTenant = jest.fn();
jest.unstable_mockModule(resolve('../../services/org-chart-generator.js'), () => ({
    createOrgChartGeneratorService: jest.fn().mockReturnValue({
        createSession: mockCreateSession,
        getSession: mockGetSession,
        generate: mockGenerate,
    }),
}));
jest.unstable_mockModule(resolve('../../services/employee-assignment.js'), () => ({
    createEmployeeAssignmentService: jest.fn().mockReturnValue({
        assignEmployeesToPositions: mockAssignEmployeesToPositions,
    }),
}));
jest.unstable_mockModule(resolve('../../services/comparison-report.js'), () => ({
    createComparisonReportService: jest.fn().mockReturnValue({
        generateComparison: mockGenerateComparison,
        approveChanges: mockApproveChanges,
        applyApprovedChanges: mockApplyApprovedChanges,
        exportAsCSV: mockExportAsCSV,
        exportDetailedCSV: mockExportDetailedCSV,
    }),
}));
jest.unstable_mockModule(resolve('../../services/excalidraw-export.js'), () => ({
    createExcalidrawExportService: jest.fn().mockReturnValue({
        exportToExcalidraw: mockExportToExcalidraw,
        exportStagingToExcalidraw: mockExportStagingToExcalidraw,
        getSnapshot: mockGetSnapshot,
        saveSnapshot: mockSaveSnapshot,
    }),
}));
jest.unstable_mockModule(resolve('../../services/industry-prototype.js'), () => ({
    createIndustryPrototypeService: jest.fn().mockReturnValue({
        getTenantContext: mockGetTenantContext,
        getPrototypeForTenant: mockGetPrototypeForTenant,
    }),
}));
const { default: express } = await import('express');
const { default: routeHandler } = await import('../../routes/org-charts.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/org-charts', authMiddleware);
    app.use('/api/v1/org-charts', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/org-charts', routeHandler);
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
describe('org-charts Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Authentication', () => {
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/org-charts/sessions');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // POST /sessions
    // =========================================================================
    describe('POST /sessions', () => {
        it('should create a session and return 201', async () => {
            const sessionData = { id: VALID_UUID, sessionName: 'Test Session', status: 'created' };
            mockCreateSession.mockResolvedValueOnce(sessionData);
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionName: 'Test Session', config: { method: 'combined' } });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(sessionData);
        });
        it('should reject when sessionName is missing (Zod validation)', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ config: { method: 'combined' } });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject when sessionName is empty string', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionName: '', config: { method: 'combined' } });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should accept valid config methods', async () => {
            mockCreateSession.mockResolvedValueOnce({ id: VALID_UUID });
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionName: 'Test', config: { method: 'nace_esco' } });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should reject invalid config method via Zod', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionName: 'Test', config: { method: 'invalid_method' } });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /sessions
    // =========================================================================
    describe('GET /sessions', () => {
        it('should list sessions with pagination', async () => {
            const sessions = [
                { id: VALID_UUID, session_name: 'Session 1', status: 'completed', staging_count: 5 },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: sessions, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.sessions).toHaveLength(1);
            expect(res.body.data.meta).toBeDefined();
            expect(res.body.data.meta.total).toBe(1);
        });
        it('should return empty list when no sessions exist', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-charts/sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.sessions).toHaveLength(0);
            expect(res.body.data.meta.total).toBe(0);
        });
        it('should filter sessions by status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-charts/sessions?status=completed')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /sessions/:id
    // =========================================================================
    describe('GET /sessions/:id', () => {
        it('should return session details', async () => {
            const sessionData = { id: VALID_UUID, sessionName: 'Test', status: 'completed' };
            mockGetSession.mockResolvedValueOnce(sessionData);
            const res = await supertest(app)
                .get(`/api/v1/org-charts/sessions/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(sessionData);
        });
        it('should return 400 for invalid UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/sessions/not-a-uuid')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/[Ii]nvalid session/i);
        });
        it('should return 404 when session not found', async () => {
            mockGetSession.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/org-charts/sessions/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /sessions/:id/generate
    // =========================================================================
    describe('POST /sessions/:id/generate', () => {
        it('should generate org chart for valid session', async () => {
            const orgChart = { units: [{ code: 'CEO', name: 'CEO', level: 1 }] };
            mockGenerate.mockResolvedValueOnce(orgChart);
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/generate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ method: 'combined' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(orgChart);
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions/bad-id/generate')
                .set('Authorization', `Bearer ${token}`)
                .send({ method: 'combined' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /generate-prototype
    // =========================================================================
    describe('POST /generate-prototype', () => {
        it('should create session and generate in one step', async () => {
            mockCreateSession.mockResolvedValueOnce({ id: VALID_UUID, sessionName: 'Gen 1' });
            mockGenerate.mockResolvedValueOnce({ units: [] });
            const res = await supertest(app)
                .post('/api/v1/org-charts/generate-prototype')
                .set('Authorization', `Bearer ${token}`)
                .send({ sessionName: 'Gen 1', method: 'template' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.session.id).toBe(VALID_UUID);
            expect(res.body.data.session.status).toBe('generated');
            expect(res.body.data.orgChart).toBeDefined();
        });
    });
    // =========================================================================
    // POST /sessions/:id/assign-employees
    // =========================================================================
    describe('POST /sessions/:id/assign-employees', () => {
        it('should assign employees to positions', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ generated_structure: { units: [{ code: 'IT', name: 'IT' }] } }],
                rowCount: 1,
            });
            const assignResult = { assigned: 10, unassigned: 2 };
            mockAssignEmployeesToPositions.mockResolvedValueOnce(assignResult);
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/assign-employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(assignResult);
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions/bad-uuid/assign-employees')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/assign-employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when no generated structure exists', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ generated_structure: null }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/assign-employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/[Nn]o generated structure/i);
        });
    });
    // =========================================================================
    // GET /staging/:sessionId/compare
    // =========================================================================
    describe('GET /staging/:sessionId/compare', () => {
        it('should return comparison report as JSON', async () => {
            const report = { matched: 10, new: 3, changed: 2, removed: 1 };
            mockGenerateComparison.mockResolvedValueOnce(report);
            const res = await supertest(app)
                .get(`/api/v1/org-charts/staging/${VALID_UUID}/compare`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(report);
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/staging/not-valid/compare')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should export as CSV when format=csv', async () => {
            mockExportAsCSV.mockResolvedValueOnce('col1,col2\nval1,val2');
            const res = await supertest(app)
                .get(`/api/v1/org-charts/staging/${VALID_UUID}/compare?format=csv`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toContain('col1,col2');
        });
        it('should export as detailed CSV when format=detailed-csv', async () => {
            mockExportDetailedCSV.mockResolvedValueOnce('col1,col2,col3\nv1,v2,v3');
            const res = await supertest(app)
                .get(`/api/v1/org-charts/staging/${VALID_UUID}/compare?format=detailed-csv`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/csv/);
        });
    });
    // =========================================================================
    // GET /staging/:sessionId/employees
    // =========================================================================
    describe('GET /staging/:sessionId/employees', () => {
        it('should return staging employees', async () => {
            const employees = [{ id: '1', first_name: 'Mario', last_name: 'Rossi', change_type: 'new' }];
            mockQuery.mockResolvedValueOnce({ rows: employees, rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/staging/${VALID_UUID}/employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].first_name).toBe('Mario');
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/staging/bad-id/employees')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should support level and changeType filters', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/staging/${VALID_UUID}/employees?level=2&changeType=modified`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // POST /staging/:sessionId/approve
    // =========================================================================
    describe('POST /staging/:sessionId/approve', () => {
        it('should approve staging changes', async () => {
            const approveResult = { approved: 15 };
            mockApproveChanges.mockResolvedValueOnce(approveResult);
            const res = await supertest(app)
                .post(`/api/v1/org-charts/staging/${VALID_UUID}/approve`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.approved).toBe(15);
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/staging/invalid/approve')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /staging/:sessionId/apply
    // =========================================================================
    describe('POST /staging/:sessionId/apply', () => {
        it('should apply approved changes', async () => {
            const applyResult = { applied: 12, skipped: 3 };
            mockApplyApprovedChanges.mockResolvedValueOnce(applyResult);
            const res = await supertest(app)
                .post(`/api/v1/org-charts/staging/${VALID_UUID}/apply`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(applyResult);
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/staging/bad/apply')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /sessions/:id/export/json
    // =========================================================================
    describe('GET /sessions/:id/export/json', () => {
        it('should export org chart as JSON', async () => {
            const structure = { units: [{ code: 'CEO', name: 'CEO' }] };
            mockQuery.mockResolvedValueOnce({ rows: [{ generated_structure: structure }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/sessions/${VALID_UUID}/export/json`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/application\/json/);
            expect(res.headers['content-disposition']).toMatch(/org_chart_/);
        });
        it('should return 400 for invalid UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/sessions/bad/export/json')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/sessions/${VALID_UUID}/export/json`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when no generated structure', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ generated_structure: null }], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/sessions/${VALID_UUID}/export/json`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /sessions/:id/export/excalidraw
    // =========================================================================
    describe('GET /sessions/:id/export/excalidraw', () => {
        it('should export as excalidraw', async () => {
            mockExportToExcalidraw.mockResolvedValueOnce({ type: 'excalidraw', elements: [] });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/sessions/${VALID_UUID}/export/excalidraw`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toMatch(/\.excalidraw/);
        });
        it('should return 400 for invalid UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/sessions/invalid/export/excalidraw')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /staging/:sessionId/export/excalidraw
    // =========================================================================
    describe('GET /staging/:sessionId/export/excalidraw', () => {
        it('should export staging as excalidraw', async () => {
            mockExportStagingToExcalidraw.mockResolvedValueOnce({ type: 'excalidraw', elements: [] });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/staging/${VALID_UUID}/export/excalidraw`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toMatch(/staging_org_chart/);
        });
        it('should return 400 for invalid UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/staging/bad/export/excalidraw')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /sessions/:id/export/tenant-org-units
    // =========================================================================
    describe('POST /sessions/:id/export/tenant-org-units', () => {
        it('should export to tenant org units', async () => {
            const structure = {
                units: [
                    {
                        code: 'CEO',
                        name: 'CEO',
                        level: 1,
                        parentCode: null,
                        type: 'company',
                        headcountBudget: 1,
                    },
                ],
            };
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ session_name: 'Session 1', generated_structure: structure }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ id: 'chart-id' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'unit-id' }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/export/tenant-org-units`)
                .set('Authorization', `Bearer ${token}`)
                .send({ chartName: 'My Chart', setAsActive: false });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.chartId).toBe('chart-id');
            expect(res.body.data.unitsCreated).toBe(1);
        });
        it('should return 400 for invalid UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions/bad/export/tenant-org-units')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/export/tenant-org-units`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when no generated structure', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ session_name: 'Test', generated_structure: null }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/export/tenant-org-units`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /tenant-units
    // =========================================================================
    describe('GET /tenant-units', () => {
        it('should return active chart and units', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: 'chart-1', name: 'Main', status: 'active', effective_date: '2025-01-01' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: 'u1',
                        code: 'CEO',
                        name_it: 'CEO',
                        name_en: 'CEO',
                        short_name: null,
                        level: 1,
                        depth: 0,
                        path: 'CEO',
                        parent_id: null,
                        parent_code: null,
                        parent_name: null,
                        headcount_budget: 1,
                        headcount_actual: 1,
                        is_line: false,
                        is_management: true,
                        cost_center: null,
                        manager_employee_id: null,
                        manager_first_name: null,
                        manager_last_name: null,
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/org-charts/tenant-units')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.chart.id).toBe('chart-1');
            expect(res.body.data.units).toHaveLength(1);
            expect(res.body.data.units[0].code).toBe('CEO');
        });
        it('should return null chart when no active chart exists', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/org-charts/tenant-units')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.chart).toBeNull();
            expect(res.body.data.units).toEqual([]);
        });
    });
    // =========================================================================
    // GET /tenant-context
    // =========================================================================
    describe('GET /tenant-context', () => {
        it('should return tenant context and prototype', async () => {
            mockGetTenantContext.mockResolvedValueOnce({ naceCode: '6419', industry: 'Banking' });
            mockGetPrototypeForTenant.mockResolvedValueOnce({ name: 'Banking Standard', levels: 7 });
            const res = await supertest(app)
                .get('/api/v1/org-charts/tenant-context')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.context.naceCode).toBe('6419');
            expect(res.body.data.prototype.name).toBe('Banking Standard');
        });
    });
    // =========================================================================
    // GET /industry-prototype
    // =========================================================================
    describe('GET /industry-prototype', () => {
        it('should return industry prototype', async () => {
            mockGetPrototypeForTenant.mockResolvedValueOnce({ name: 'Banking Proto', units: [] });
            const res = await supertest(app)
                .get('/api/v1/org-charts/industry-prototype')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Banking Proto');
        });
    });
    // =========================================================================
    // GET /snapshots
    // =========================================================================
    describe('GET /snapshots', () => {
        it('should list snapshots', async () => {
            const snapshots = [{ id: 's1', snapshot_name: 'Snap 1', snapshot_type: 'staging' }];
            mockQuery.mockResolvedValueOnce({ rows: snapshots, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-charts/snapshots')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].snapshot_name).toBe('Snap 1');
        });
        it('should filter by sessionId and type', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/org-charts/snapshots?sessionId=${VALID_UUID}&type=staging`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /snapshots/:id
    // =========================================================================
    describe('GET /snapshots/:id', () => {
        it('should return snapshot details', async () => {
            const snap = { id: VALID_UUID, snapshotName: 'Snap', excalidrawFormat: { elements: [] } };
            mockGetSnapshot.mockResolvedValueOnce(snap);
            const res = await supertest(app)
                .get(`/api/v1/org-charts/snapshots/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.snapshotName).toBe('Snap');
        });
        it('should return 400 for invalid UUID', async () => {
            const res = await supertest(app)
                .get('/api/v1/org-charts/snapshots/bad')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when snapshot not found', async () => {
            mockGetSnapshot.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/org-charts/snapshots/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should export as excalidraw format', async () => {
            const snap = { id: VALID_UUID, excalidrawFormat: { type: 'excalidraw', elements: [] } };
            mockGetSnapshot.mockResolvedValueOnce(snap);
            const res = await supertest(app)
                .get(`/api/v1/org-charts/snapshots/${VALID_UUID}?format=excalidraw`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-disposition']).toMatch(/snapshot_/);
        });
    });
    // =========================================================================
    // POST /sessions/:id/snapshots
    // =========================================================================
    describe('POST /sessions/:id/snapshots', () => {
        it('should create a snapshot', async () => {
            mockExportStagingToExcalidraw.mockResolvedValueOnce({ elements: [] });
            mockSaveSnapshot.mockResolvedValueOnce('snap-id-1');
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/snapshots`)
                .set('Authorization', `Bearer ${token}`)
                .send({ snapshotName: 'My Snapshot', snapshotType: 'staging' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.snapshotId).toBe('snap-id-1');
            expect(res.body.data.snapshotName).toBe('My Snapshot');
        });
        it('should return 400 for invalid session UUID', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-charts/sessions/bad/snapshots')
                .set('Authorization', `Bearer ${token}`)
                .send({ snapshotName: 'Snap' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject invalid snapshotType via Zod', async () => {
            const res = await supertest(app)
                .post(`/api/v1/org-charts/sessions/${VALID_UUID}/snapshots`)
                .set('Authorization', `Bearer ${token}`)
                .send({ snapshotType: 'invalid_type' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=org-charts.test.js.map