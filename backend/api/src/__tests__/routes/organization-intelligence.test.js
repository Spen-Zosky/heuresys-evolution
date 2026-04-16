/**
 * Organization Intelligence Routes - Unit Tests
 *
 * Tests:
 *   GET /skill-intelligence                   - Organizational skill distribution
 *   GET /similar-occupations/:occupationUri   - Similar occupations from MV
 *   GET /concentration-risk                   - Skill concentration risk
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
jest.unstable_mockModule(resolve('../../services/cache.js'), () => ({
    cached: jest.fn().mockImplementation(async (_key, fn) => fn()),
    cachedForTenant: jest
        .fn()
        .mockImplementation(async (_tenantId, _key, fn) => fn()),
    CACHE_TTL: { SHORT: 60, MODERATE: 300, REFERENCE: 900, STATIC: 3600 },
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/organization-intelligence.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const { cached, cachedForTenant } = await import('../../services/cache.js');
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/organization', authMiddleware);
    app.use('/api/v1/organization', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/organization', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
const OCCUPATION_URI = 'http://data.europa.eu/esco/occupation/f2b15a0e-e65a-4b7e-ad2d-d4f2e1b3c5a7';
describe('Organization Intelligence Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        cached.mockImplementation(async (_key, fn) => fn());
        cachedForTenant.mockImplementation(async (_tenantId, _key, fn) => fn());
        app = createTestApp();
        token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    });
    it('should return 401 without auth token', async () => {
        const res = await supertest(app).get('/api/v1/organization/skill-intelligence');
        expect(res.status).toBe(401);
    });
    // =========================================================================
    // GET /skill-intelligence
    // =========================================================================
    describe('GET /skill-intelligence', () => {
        it('should return skill intelligence with summary', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        skill_label: 'Financial analysis',
                        skill_type: 'skill',
                        reuse_level: 'sector-specific',
                        employees_with_skill: '15',
                        avg_proficiency: '3.20',
                        penetration_rate: '0.1120',
                        open_demand: '3',
                        risk_level: 'HEALTHY',
                    },
                    {
                        skill_label: 'Blockchain technology',
                        skill_type: 'knowledge',
                        reuse_level: 'cross-sector',
                        employees_with_skill: '1',
                        avg_proficiency: '4.00',
                        penetration_rate: '0.0075',
                        open_demand: '5',
                        risk_level: 'CRITICAL_GAP',
                    },
                    {
                        skill_label: 'Risk management',
                        skill_type: 'skill',
                        reuse_level: 'sector-specific',
                        employees_with_skill: '3',
                        avg_proficiency: '2.80',
                        penetration_rate: '0.0224',
                        open_demand: '2',
                        risk_level: 'SCARCE',
                    },
                ],
                rowCount: 3,
            });
            const res = await supertest(app)
                .get('/api/v1/organization/skill-intelligence')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.totalSkills).toBe(3);
            expect(res.body.data.summary.critical).toBe(1);
            expect(res.body.data.summary.scarce).toBe(1);
            expect(res.body.data.summary.healthy).toBe(1);
            expect(res.body.data.skills).toHaveLength(3);
            expect(typeof res.body.data.skills[0].employeesWithSkill).toBe('number');
            expect(typeof res.body.data.skills[0].penetrationRate).toBe('number');
        });
        it('should return empty result when no skills found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/organization/skill-intelligence')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.summary.totalSkills).toBe(0);
            expect(res.body.data.skills).toEqual([]);
        });
    });
    // =========================================================================
    // GET /similar-occupations/:occupationUri
    // =========================================================================
    describe('GET /similar-occupations/:occupationUri', () => {
        const encodedUri = encodeURIComponent(OCCUPATION_URI);
        it('should return similar occupations for valid URI', async () => {
            // occupation lookup
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'occ-001', preferred_label_en: 'Software Developer' }],
                rowCount: 1,
            });
            // mv_occupation_similarity query
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        occupation_label: 'Web Developer',
                        isco_code: '2513',
                        occupation_id: 'occ-002',
                        embedding_similarity: '0.8900',
                        skill_overlap: '0.7200',
                        combined_score: '0.8050',
                    },
                    {
                        occupation_label: 'Systems Analyst',
                        isco_code: '2511',
                        occupation_id: 'occ-003',
                        embedding_similarity: '0.8100',
                        skill_overlap: '0.6500',
                        combined_score: '0.7300',
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get(`/api/v1/organization/similar-occupations/${encodedUri}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.occupation).toBe('Software Developer');
            expect(res.body.data.uri).toBe(OCCUPATION_URI);
            expect(res.body.data.similarOccupations).toHaveLength(2);
            expect(typeof res.body.data.similarOccupations[0].embeddingSimilarity).toBe('number');
            expect(typeof res.body.data.similarOccupations[0].skillOverlap).toBe('number');
            expect(typeof res.body.data.similarOccupations[0].combinedScore).toBe('number');
        });
        it('should return 404 when occupation not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/organization/similar-occupations/${encodedUri}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });
    // =========================================================================
    // GET /concentration-risk
    // =========================================================================
    describe('GET /concentration-risk', () => {
        it('should return concentration risk with summary', async () => {
            // employee count
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '134' }], rowCount: 1 });
            // skills with holder counts
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        skill_label: 'Mainframe COBOL',
                        skill_type: 'skill',
                        employee_count: '1',
                        holders: ['Marco Rossi'],
                    },
                    {
                        skill_label: 'SAP ABAP',
                        skill_type: 'knowledge',
                        employee_count: '3',
                        holders: ['Anna Bianchi', 'Luca Verdi', 'Maria Neri'],
                    },
                    {
                        skill_label: 'Financial analysis',
                        skill_type: 'skill',
                        employee_count: '25',
                        holders: [
                            'Employee 1',
                            'Employee 2',
                            'Employee 3',
                            'Employee 4',
                            'Employee 5',
                            'Employee 6',
                            'Employee 7',
                            'Employee 8',
                            'Employee 9',
                            'Employee 10',
                        ],
                    },
                ],
                rowCount: 3,
            });
            const res = await supertest(app)
                .get('/api/v1/organization/concentration-risk')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.totalEmployees).toBe(134);
            expect(res.body.data.summary.totalSkills).toBe(3);
            expect(res.body.data.summary.critical).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(res.body.data.risks)).toBe(true);
            // 'healthy' risks are filtered out
            for (const risk of res.body.data.risks) {
                expect(risk.riskLevel).not.toBe('healthy');
            }
        });
        it('should handle tenant with no skills', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/organization/concentration-risk')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.summary.totalSkills).toBe(0);
            expect(res.body.data.risks).toEqual([]);
        });
    });
});
//# sourceMappingURL=organization-intelligence.test.js.map