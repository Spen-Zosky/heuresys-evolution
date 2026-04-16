/**
 * prototypes Routes - Comprehensive Behavioral Tests
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
// Mock service modules
const mockResearchIndustryProcesses = jest.fn();
jest.unstable_mockModule(resolve('../../services/business-process-research.js'), () => ({
    BusinessProcessResearchService: jest.fn().mockImplementation(() => ({
        researchIndustryProcesses: mockResearchIndustryProcesses,
    })),
}));
const mockGenerateFromPrototype = jest.fn();
const mockExportToExcalidraw = jest.fn();
jest.unstable_mockModule(resolve('../../services/prototype-generator.js'), () => ({
    PrototypeGeneratorService: jest.fn().mockImplementation(() => ({
        generateFromPrototype: mockGenerateFromPrototype,
        exportToExcalidraw: mockExportToExcalidraw,
    })),
}));
const mockGetStaffingRules = jest.fn();
const mockSaveStaffingRules = jest.fn();
const mockCalculateOptimalStaffing = jest.fn();
const mockGetIndustryBenchmarks = jest.fn();
const mockValidateStaffingRatios = jest.fn();
jest.unstable_mockModule(resolve('../../services/staffing-rules-generator.js'), () => ({
    StaffingRulesGeneratorService: jest.fn().mockImplementation(() => ({
        getStaffingRules: mockGetStaffingRules,
        saveStaffingRules: mockSaveStaffingRules,
        calculateOptimalStaffing: mockCalculateOptimalStaffing,
        getIndustryBenchmarks: mockGetIndustryBenchmarks,
        validateStaffingRatios: mockValidateStaffingRatios,
    })),
}));
const mockEnrichAllJobSkills = jest.fn();
const mockEnrichJobTemplateSkills = jest.fn();
const mockGetJobSkillDistribution = jest.fn();
const mockGetSkillBalanceRecommendations = jest.fn();
const mockSuggestSkillsForJobTemplate = jest.fn();
const mockAddSkillToJobTemplate = jest.fn();
const mockSuggestSkillsByCluster = jest.fn();
jest.unstable_mockModule(resolve('../../services/job-skills-enrichment.js'), () => ({
    JobSkillsEnrichmentService: jest.fn().mockImplementation(() => ({
        enrichAllJobSkills: mockEnrichAllJobSkills,
        enrichJobTemplateSkills: mockEnrichJobTemplateSkills,
        getJobSkillDistribution: mockGetJobSkillDistribution,
        getSkillBalanceRecommendations: mockGetSkillBalanceRecommendations,
        suggestSkillsForJobTemplate: mockSuggestSkillsForJobTemplate,
        addSkillToJobTemplate: mockAddSkillToJobTemplate,
        suggestSkillsByCluster: mockSuggestSkillsByCluster,
    })),
}));
jest.unstable_mockModule(resolve('../../services/industry-prototype.js'), () => ({
    CompanySize: {},
}));
const { default: express } = await import('express');
const { default: routeHandler } = await import('../../routes/prototypes.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const PROTO_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/prototypes', authMiddleware);
    app.use('/api/v1/prototypes', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/prototypes', routeHandler);
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
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('prototypes Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
        mockClientQuery.mockReset();
        mockConnect.mockReset();
        mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
        mockResearchIndustryProcesses.mockReset();
        mockGenerateFromPrototype.mockReset();
        mockExportToExcalidraw.mockReset();
        mockGetStaffingRules.mockReset();
        mockSaveStaffingRules.mockReset();
        mockCalculateOptimalStaffing.mockReset();
        mockGetIndustryBenchmarks.mockReset();
        mockValidateStaffingRatios.mockReset();
        mockEnrichAllJobSkills.mockReset();
        mockEnrichJobTemplateSkills.mockReset();
        mockGetJobSkillDistribution.mockReset();
        mockGetSkillBalanceRecommendations.mockReset();
        mockSuggestSkillsForJobTemplate.mockReset();
        mockAddSkillToJobTemplate.mockReset();
        mockSuggestSkillsByCluster.mockReset();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Auth enforcement', () => {
        it('should return 401 for GET / without token', async () => {
            const res = await supertest(app).get('/api/v1/prototypes');
            expect(res.status).toBe(401);
        });
        it('should return 401 for GET /:id without token', async () => {
            const res = await supertest(app).get(`/api/v1/prototypes/${PROTO_ID}`);
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST /research without token', async () => {
            const res = await supertest(app)
                .post('/api/v1/prototypes/research')
                .send({ nace_code: '6419' });
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET / — List all industry prototypes
    // =========================================================================
    describe('GET /', () => {
        it('should return 200 with prototypes list and meta', async () => {
            const protoRow = {
                id: PROTO_ID,
                name: 'Banking Prototype',
                nace_section: 'K',
                size_class: 'MEDIUM',
                process_count: '3',
                staffing_rules_count: '5',
                org_chart_count: '1',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [protoRow], rowCount: 1 }) // main SELECT
                .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 }); // COUNT
            const res = await supertest(app)
                .get('/api/v1/prototypes')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Banking Prototype');
            expect(res.body.meta.total).toBe(10);
            expect(res.body.meta.limit).toBe(50);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should accept nace_section filter', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/prototypes?nace_section=K')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
            // Verify nace_section was included in query params (route appends '%')
            const callArgs = mockQuery.mock.calls[0];
            expect(callArgs[1]).toContain('K%');
        });
        it('should accept size_class filter and uppercase it', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/prototypes?size_class=medium')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const callArgs = mockQuery.mock.calls[0];
            expect(callArgs[1]).toContain('MEDIUM');
        });
        it('should accept search filter', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/prototypes?search=banking')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const callArgs = mockQuery.mock.calls[0];
            expect(callArgs[1]).toContain('%banking%');
        });
        it('should accept custom limit and offset', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/prototypes?limit=10&offset=5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(10);
            expect(res.body.meta.offset).toBe(5);
        });
        it('should return 500 when query fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/prototypes')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /nace-sections
    // =========================================================================
    describe('GET /nace-sections', () => {
        it('should return 200 with enriched NACE sections', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        code: 'K',
                        name: 'Financial and insurance activities',
                        name_it: 'Attività finanziarie',
                        icon: null,
                        color: null,
                        profile_count: '5',
                    },
                    {
                        code: 'J',
                        name: 'Information and communication',
                        name_it: 'Informazione e comunicazione',
                        icon: null,
                        color: null,
                        profile_count: '3',
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/prototypes/nace-sections')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            // Route returns rows from industry_classifications query
            expect(res.body.data.length).toBe(2);
            const sectionK = res.body.data.find((s) => s.code === 'K');
            expect(sectionK).toBeDefined();
            expect(sectionK.profile_count).toBe('5');
            expect(sectionK.name).toBe('Financial and insurance activities');
        });
        it('should return empty array for sections without prototypes', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/prototypes/nace-sections')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /:id — Prototype details
    // =========================================================================
    describe('GET /:id', () => {
        it('should return 200 with prototype details', async () => {
            const protoRow = {
                id: PROTO_ID,
                name: 'Banking Proto',
                nace_section: 'K',
                process_count: '2',
                staffing_rules_count: '3',
                org_chart_count: '1',
            };
            mockQuery.mockResolvedValueOnce({ rows: [protoRow], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(PROTO_ID);
            expect(res.body.data.name).toBe('Banking Proto');
        });
        it('should return 404 when prototype not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /research
    // =========================================================================
    describe('POST /research', () => {
        it('should return 200 with research results', async () => {
            const researchResult = { processes: [{ name: 'Lending' }], nace_code: '6419' };
            mockResearchIndustryProcesses.mockResolvedValueOnce(researchResult);
            const res = await supertest(app)
                .post('/api/v1/prototypes/research')
                .set('Authorization', `Bearer ${token}`)
                .send({ nace_code: '6419' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(researchResult);
            expect(res.body.message).toContain('6419');
        });
        it('should return 400 when nace_code is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/prototypes/research')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 when service fails', async () => {
            mockResearchIndustryProcesses.mockRejectedValueOnce(new Error('AI service error'));
            const res = await supertest(app)
                .post('/api/v1/prototypes/research')
                .set('Authorization', `Bearer ${token}`)
                .send({ nace_code: '6419' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /:id/processes
    // =========================================================================
    describe('GET /:id/processes', () => {
        it('should return 200 with processes list', async () => {
            const processRows = [
                { id: 'p1', process_name: 'Lending', process_category: 'core', cost_center_count: '2' },
                {
                    id: 'p2',
                    process_name: 'Compliance',
                    process_category: 'support',
                    cost_center_count: '1',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: processRows, rowCount: 2 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/processes`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].process_name).toBe('Lending');
        });
        it('should filter by process_category', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/processes?process_category=core`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const callArgs = mockQuery.mock.calls[0];
            expect(callArgs[1]).toContain('core');
        });
        it('should return empty array when no processes', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/processes`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // POST /:id/processes
    // =========================================================================
    describe('POST /:id/processes', () => {
        const validBody = {
            process_code: 'LEND-001',
            process_name: 'Retail Lending',
            process_category: 'core',
            value_chain_position: 'primary',
        };
        it('should return 201 when creating a business process', async () => {
            const insertedRow = { id: 'new-proc', ...validBody, profile_id: PROTO_ID };
            mockQuery.mockResolvedValueOnce({ rows: [insertedRow], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/processes`)
                .set('Authorization', `Bearer ${token}`)
                .send(validBody);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.process_code).toBe('LEND-001');
            expect(res.body.message).toBe('Business process created');
        });
        it('should return 400 when process_code is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/processes`)
                .set('Authorization', `Bearer ${token}`)
                .send({ process_name: 'Lending', process_category: 'core', value_chain_position: 1 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when process_name is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/processes`)
                .set('Authorization', `Bearer ${token}`)
                .send({ process_code: 'LEND-001', process_category: 'core', value_chain_position: 1 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 on DB error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('unique constraint'));
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/processes`)
                .set('Authorization', `Bearer ${token}`)
                .send(validBody);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /processes/:id/cost-centers
    // =========================================================================
    describe('GET /processes/:id/cost-centers', () => {
        it('should return 200 with cost centers for a process', async () => {
            const ccRows = [
                { id: 'cc1', process_id: 'p1', cost_center_code: 'CC-100' },
                { id: 'cc2', process_id: 'p1', cost_center_code: 'CC-200' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: ccRows, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/prototypes/processes/p1/cost-centers')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].cost_center_code).toBe('CC-100');
        });
        it('should return empty array when no cost centers found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/prototypes/processes/p1/cost-centers')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /:id/staffing-rules
    // =========================================================================
    describe('GET /:id/staffing-rules', () => {
        it('should return 200 with staffing rules', async () => {
            const rulesData = [{ role: 'Manager', min: 1, max: 3 }];
            mockGetStaffingRules.mockResolvedValueOnce(rulesData);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/staffing-rules`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(rulesData);
        });
        it('should pass company_size query param to service', async () => {
            mockGetStaffingRules.mockResolvedValueOnce([]);
            await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/staffing-rules?company_size=large`)
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetStaffingRules).toHaveBeenCalledWith(PROTO_ID, 'large');
        });
        it('should return 500 when service fails', async () => {
            mockGetStaffingRules.mockRejectedValueOnce(new Error('Service error'));
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/staffing-rules`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /:id/staffing-rules
    // =========================================================================
    describe('POST /:id/staffing-rules', () => {
        it('should return 200 when saving staffing rules', async () => {
            mockSaveStaffingRules.mockResolvedValueOnce(undefined);
            const rules = [
                {
                    role_name: 'Manager',
                    department_code: 'IT',
                    min_headcount: 1,
                    max_headcount: 3,
                    company_size: 'medium',
                },
            ];
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/staffing-rules`)
                .set('Authorization', `Bearer ${token}`)
                .send({ rules });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('1 staffing rules saved');
        });
        it('should return 400 when rules is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/staffing-rules`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /:id/staffing-rules/calculate
    // =========================================================================
    describe('POST /:id/staffing-rules/calculate', () => {
        it('should return 200 with calculated staffing', async () => {
            const calcResult = { total_headcount: 50, departments: [] };
            mockCalculateOptimalStaffing.mockResolvedValueOnce(calcResult);
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/staffing-rules/calculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ company_size: 100 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total_headcount).toBe(50);
        });
        it('should return 400 when company_size is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/${PROTO_ID}/staffing-rules/calculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /:id/benchmarks
    // =========================================================================
    describe('GET /:id/benchmarks', () => {
        it('should return 200 with industry benchmarks', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ nace_class_code: 'K.64' }],
                rowCount: 1,
            });
            const benchmarks = { avg_headcount: 200, median_headcount: 150 };
            mockGetIndustryBenchmarks.mockResolvedValueOnce(benchmarks);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/benchmarks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(benchmarks);
            expect(mockGetIndustryBenchmarks).toHaveBeenCalledWith('K.64');
        });
        it('should return 404 when prototype not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/benchmarks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /:id/tasks
    // =========================================================================
    describe('GET /:id/tasks', () => {
        it('should return 200 with tasks list', async () => {
            const taskRows = [
                { id: 't1', task_code: 'TSK-001', org_unit_code: 'IT', org_unit_name: 'IT OrgUnit' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: taskRows, rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/tasks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].task_code).toBe('TSK-001');
        });
        it('should return empty array when no tasks', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/tasks`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /:id/kpis
    // =========================================================================
    describe('GET /:id/kpis', () => {
        it('should return 200 with KPIs list', async () => {
            const kpiRows = [
                { id: 'k1', kpi_code: 'KPI-001', org_unit_code: 'FIN', org_unit_name: 'Finance' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: kpiRows, rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/${PROTO_ID}/kpis`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].kpi_code).toBe('KPI-001');
        });
    });
    // =========================================================================
    // POST /tenants/:tenantId/generate
    // =========================================================================
    describe('POST /tenants/:tenantId/generate', () => {
        it('should return 200 on successful generation', async () => {
            const genResult = { departments: 5, employees: 50, org_units: 10 };
            mockGenerateFromPrototype.mockResolvedValueOnce(genResult);
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/generate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ prototype_id: PROTO_ID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(genResult);
            expect(res.body.message).toBe('Structure generated successfully');
        });
        it('should return 400 when prototype_id is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/generate`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when prototype_id is not a valid UUID', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/generate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ prototype_id: 'not-a-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // generation-status route was removed (prototype_generation_sessions table dropped)
    // =========================================================================
    // POST /tenants/:tenantId/generate/preview
    // =========================================================================
    describe('POST /tenants/:tenantId/generate/preview', () => {
        it('should return 200 with preview data', async () => {
            const protoRow = { id: PROTO_ID, name: 'Banking Proto' };
            const processRows = [{ id: 'p1', process_name: 'Lending' }];
            const staffingResult = { total: 50 };
            const orgChartRow = { id: 'oc1', unit_count: '5', job_count: '20' };
            mockQuery
                .mockResolvedValueOnce({ rows: [protoRow], rowCount: 1 }) // prototype lookup
                .mockResolvedValueOnce({ rows: processRows, rowCount: 1 }); // processes
            mockCalculateOptimalStaffing.mockResolvedValueOnce(staffingResult);
            mockQuery.mockResolvedValueOnce({ rows: [orgChartRow], rowCount: 1 }); // org chart
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/generate/preview`)
                .set('Authorization', `Bearer ${token}`)
                .send({ prototype_id: PROTO_ID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.preview).toBe(true);
            expect(res.body.data.prototype.name).toBe('Banking Proto');
            expect(res.body.data.processes).toHaveLength(1);
        });
        it('should return 404 when prototype not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/generate/preview`)
                .set('Authorization', `Bearer ${token}`)
                .send({ prototype_id: PROTO_ID });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when prototype_id is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/generate/preview`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /tenants/:tenantId/validate-staffing
    // =========================================================================
    describe('POST /tenants/:tenantId/validate-staffing', () => {
        it('should return 200 with validation result', async () => {
            const validationResult = { valid: true, warnings: [] };
            mockValidateStaffingRatios.mockResolvedValueOnce(validationResult);
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/validate-staffing`)
                .set('Authorization', `Bearer ${token}`)
                .send({ staffing_plan: { managers: 5, analysts: 20 } });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.valid).toBe(true);
        });
        it('should return 400 when staffing_plan is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/tenants/${TENANT_ID}/validate-staffing`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /tenants/:tenantId/org-chart/excalidraw
    // =========================================================================
    describe('GET /tenants/:tenantId/org-chart/excalidraw', () => {
        it('should return 200 with excalidraw data', async () => {
            const orgUnitRows = [
                {
                    id: 'ou1',
                    code: 'CEO',
                    name_en: 'CEO Office',
                    name_it: 'Ufficio CEO',
                    level: 0,
                    parent_code: null,
                },
                {
                    id: 'ou2',
                    code: 'IT',
                    name_en: 'IT OrgUnit',
                    name_it: 'Dipartimento IT',
                    level: 1,
                    parent_code: 'CEO',
                },
            ];
            const excalidrawResult = { type: 'excalidraw', elements: [] };
            // Route queries org_units directly (no session check)
            mockQuery.mockResolvedValueOnce({ rows: orgUnitRows, rowCount: 2 });
            mockExportToExcalidraw.mockResolvedValueOnce(excalidrawResult);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/tenants/${TENANT_ID}/org-chart/excalidraw`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.type).toBe('excalidraw');
            expect(res.body.contentType).toBe('application/json');
        });
        it('should return 200 with empty excalidraw when no org units', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const excalidrawResult = { type: 'excalidraw', elements: [] };
            mockExportToExcalidraw.mockResolvedValueOnce(excalidrawResult);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/tenants/${TENANT_ID}/org-chart/excalidraw`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /tenants/:tenantId/prototype-report
    // =========================================================================
    describe('GET /tenants/:tenantId/prototype-report', () => {
        it('should return 200 with complete report', async () => {
            const tenantRow = {
                id: TENANT_ID,
                name: 'RTL Bank',
                profile_code: 'BANK-K-MED',
                profile_name: 'Banking',
            };
            const statsRow = {
                org_unit_count: '10',
                employee_count: '200',
                cost_center_count: '8',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [tenantRow], rowCount: 1 }) // tenant with industry profile join
                .mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 }); // stats
            const res = await supertest(app)
                .get(`/api/v1/prototypes/tenants/${TENANT_ID}/prototype-report`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.tenant.name).toBe('RTL Bank');
            expect(res.body.data.statistics.org_unit_count).toBe('10');
        });
        it('should return 404 when tenant not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/prototypes/tenants/${TENANT_ID}/prototype-report`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /job-skills/enrich-all
    // =========================================================================
    describe('POST /job-skills/enrich-all', () => {
        it('should return 200 with enrichment results', async () => {
            const enrichResult = { enriched: 45, total_skills: 60 };
            mockEnrichAllJobSkills.mockResolvedValueOnce(enrichResult);
            const res = await supertest(app)
                .post('/api/v1/prototypes/job-skills/enrich-all')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.enriched).toBe(45);
            expect(res.body.message).toContain('45');
            expect(res.body.message).toContain('60');
        });
        it('should return 500 when service fails', async () => {
            mockEnrichAllJobSkills.mockRejectedValueOnce(new Error('Enrichment failed'));
            const res = await supertest(app)
                .post('/api/v1/prototypes/job-skills/enrich-all')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /job-templates/:jobTemplateId/enrich-skills
    // =========================================================================
    describe('POST /job-templates/:jobTemplateId/enrich-skills', () => {
        it('should return 200 with enrichment results', async () => {
            const enrichResult = { enriched: 5, total_skills: 8 };
            mockEnrichJobTemplateSkills.mockResolvedValueOnce(enrichResult);
            const res = await supertest(app)
                .post(`/api/v1/prototypes/job-templates/${VALID_UUID}/enrich-skills`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.enriched).toBe(5);
        });
    });
    // =========================================================================
    // GET /job-templates/:jobTemplateId/skill-distribution
    // =========================================================================
    describe('GET /job-templates/:jobTemplateId/skill-distribution', () => {
        it('should return 200 with skill distribution', async () => {
            const distData = { hard: 5, soft: 3, hybrid: 2 };
            mockGetJobSkillDistribution.mockResolvedValueOnce(distData);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/job-templates/${VALID_UUID}/skill-distribution`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(distData);
        });
        it('should return 404 when job template not found', async () => {
            mockGetJobSkillDistribution.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/job-templates/${VALID_UUID}/skill-distribution`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /job-templates/:jobTemplateId/skill-balance
    // =========================================================================
    describe('GET /job-templates/:jobTemplateId/skill-balance', () => {
        it('should return 200 with skill balance recommendations', async () => {
            const balanceData = { balanced: true, recommendations: [] };
            mockGetSkillBalanceRecommendations.mockResolvedValueOnce(balanceData);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/job-templates/${VALID_UUID}/skill-balance`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.balanced).toBe(true);
        });
    });
    // =========================================================================
    // GET /job-templates/:jobTemplateId/suggest-skills
    // =========================================================================
    describe('GET /job-templates/:jobTemplateId/suggest-skills', () => {
        it('should return 200 with skill suggestions', async () => {
            const suggestions = [{ skill_id: 's1', name: 'JavaScript' }];
            mockSuggestSkillsForJobTemplate.mockResolvedValueOnce(suggestions);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/job-templates/${VALID_UUID}/suggest-skills`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should pass query params to service', async () => {
            mockSuggestSkillsForJobTemplate.mockResolvedValueOnce([]);
            await supertest(app)
                .get(`/api/v1/prototypes/job-templates/${VALID_UUID}/suggest-skills?max_suggestions=5&include_hard=true&include_soft=false&min_transferability=0.5`)
                .set('Authorization', `Bearer ${token}`);
            expect(mockSuggestSkillsForJobTemplate).toHaveBeenCalledWith(VALID_UUID, expect.objectContaining({
                max_suggestions: 5,
                include_hard: true,
                include_soft: false,
                min_transferability_score: 0.5,
            }));
        });
    });
    // =========================================================================
    // POST /job-templates/:jobTemplateId/add-skill
    // =========================================================================
    describe('POST /job-templates/:jobTemplateId/add-skill', () => {
        const validSkillBody = {
            esco_skill_id: PROTO_ID,
            required_level: 3,
            is_required: true,
            importance: 'critical',
        };
        it('should return 201 when skill added successfully', async () => {
            const addResult = { success: true, message: 'Skill added', skill_id: PROTO_ID };
            mockAddSkillToJobTemplate.mockResolvedValueOnce(addResult);
            const res = await supertest(app)
                .post(`/api/v1/prototypes/job-templates/${VALID_UUID}/add-skill`)
                .set('Authorization', `Bearer ${token}`)
                .send(validSkillBody);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should return 400 when service returns failure', async () => {
            const addResult = { success: false, message: 'Skill already exists' };
            mockAddSkillToJobTemplate.mockResolvedValueOnce(addResult);
            const res = await supertest(app)
                .post(`/api/v1/prototypes/job-templates/${VALID_UUID}/add-skill`)
                .set('Authorization', `Bearer ${token}`)
                .send(validSkillBody);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Skill already exists');
        });
        it('should return 400 when esco_skill_id is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/job-templates/${VALID_UUID}/add-skill`)
                .set('Authorization', `Bearer ${token}`)
                .send({ required_level: 3 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when esco_skill_id is not a valid UUID', async () => {
            const res = await supertest(app)
                .post(`/api/v1/prototypes/job-templates/${VALID_UUID}/add-skill`)
                .set('Authorization', `Bearer ${token}`)
                .send({ esco_skill_id: 'not-a-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /clusters/:clusterId/suggest-skills
    // =========================================================================
    describe('GET /clusters/:clusterId/suggest-skills', () => {
        it('should return 200 with cluster skill suggestions', async () => {
            const suggestions = [{ skill_id: 's1', name: 'Data Analysis' }];
            mockSuggestSkillsByCluster.mockResolvedValueOnce(suggestions);
            const res = await supertest(app)
                .get(`/api/v1/prototypes/clusters/${VALID_UUID}/suggest-skills`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
        it('should pass exclude_ids and limit to service', async () => {
            mockSuggestSkillsByCluster.mockResolvedValueOnce([]);
            await supertest(app)
                .get(`/api/v1/prototypes/clusters/${VALID_UUID}/suggest-skills?exclude_ids=a,b,c&limit=5`)
                .set('Authorization', `Bearer ${token}`);
            expect(mockSuggestSkillsByCluster).toHaveBeenCalledWith(VALID_UUID, ['a', 'b', 'c'], 5);
        });
        it('should default limit to 10', async () => {
            mockSuggestSkillsByCluster.mockResolvedValueOnce([]);
            await supertest(app)
                .get(`/api/v1/prototypes/clusters/${VALID_UUID}/suggest-skills`)
                .set('Authorization', `Bearer ${token}`);
            expect(mockSuggestSkillsByCluster).toHaveBeenCalledWith(VALID_UUID, [], 10);
        });
    });
});
//# sourceMappingURL=prototypes.test.js.map