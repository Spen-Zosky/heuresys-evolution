/**
 * performance-analytics Routes - Unit Tests
 * Comprehensive behavioral tests for performance analytics endpoints.
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
const { default: routeHandler } = await import('../../routes/performance-analytics.js');
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
    app.use('/api/v1/performance-analytics', authMiddleware);
    app.use('/api/v1/performance-analytics', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/performance-analytics', routeHandler);
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
describe('performance-analytics Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    describe('Authentication', () => {
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/performance-analytics/distribution');
            expect(res.status).toBe(401);
        });
    });
    describe('GET /distribution', () => {
        it('should return rating distribution and statistics', async () => {
            const dist = [
                { rating: 3, count: '40', percentage: '40.0' },
                { rating: 4, count: '30', percentage: '30.0' },
            ];
            const stats = {
                total_reviews: '100',
                avg_rating: '3.50',
                stddev_rating: '0.85',
                min_rating: 1,
                max_rating: 5,
                median_rating: 3.5,
            };
            mockQuery
                .mockResolvedValueOnce({ rows: dist, rowCount: 2 })
                .mockResolvedValueOnce({ rows: [stats], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/distribution')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.distribution).toHaveLength(2);
            expect(res.body.data.expected_distribution).toBeDefined();
            expect(res.body.data.statistics.avg_rating).toBe('3.50');
        });
        it('should filter by review_cycle_id', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ total_reviews: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/distribution?review_cycle_id=00000000-0000-4000-a000-000000000001')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    describe('GET /trends', () => {
        it('should return performance trends', async () => {
            const trends = [
                { year: 2025, cycle_name: 'Annual 2025', review_count: '50', avg_rating: '3.60' },
                { year: 2024, cycle_name: 'Annual 2024', review_count: '45', avg_rating: '3.40' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: trends, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/trends')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.trends).toHaveLength(2);
            expect(res.body.data.trends[0].yoy_change).toBeDefined();
            expect(res.body.data.period).toBe('3 years');
        });
        it('should support custom year range', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/trends?years=5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.period).toBe('5 years');
        });
    });
    describe('GET /department-comparison', () => {
        it('should compare departments', async () => {
            const depts = [
                { org_unit_id: 'd1', department_name: 'IT', review_count: '30', avg_rating: '3.80' },
                { org_unit_id: 'd2', department_name: 'HR', review_count: '20', avg_rating: '3.50' },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: depts, rowCount: 2 })
                .mockResolvedValueOnce({ rows: [{ org_avg: '3.65' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/department-comparison')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.departments).toHaveLength(2);
            expect(res.body.data.org_average).toBe(3.65);
            expect(res.body.data.departments[0].deviation_from_org).toBeDefined();
        });
    });
    describe('GET /manager-consistency', () => {
        it('should return manager calibration consistency', async () => {
            const managers = [
                {
                    manager_id: 'm1',
                    manager_name: 'Mario Rossi',
                    review_count: '5',
                    avg_rating: '3.80',
                    rating_spread: '0.50',
                    avg_adjustment: '0.20',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: managers, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/manager-consistency')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].consistency_score).toBeDefined();
        });
    });
    describe('GET /executive-summary', () => {
        it('should return executive summary', async () => {
            const overall = {
                total_reviews: '100',
                completed_reviews: '85',
                avg_rating: '3.50',
                high_performers: '25',
            };
            const topPerformers = [{ employee_name: 'Mario Rossi', overall_rating: 5.0 }];
            const concerns = [{ department: 'Sales', low_performer_count: 3 }];
            const goalTrends = {
                goals_exceeded: '20',
                goals_met: '40',
                goals_partial: '25',
                goals_missed: '15',
            };
            const calibration = {
                total_adjustments: '10',
                upgrades: '4',
                downgrades: '6',
                avg_change: '0.30',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [overall], rowCount: 1 })
                .mockResolvedValueOnce({ rows: topPerformers, rowCount: 1 })
                .mockResolvedValueOnce({ rows: concerns, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [goalTrends], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [calibration], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/executive-summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.overall.total_reviews).toBe('100');
            expect(res.body.data.top_performers).toHaveLength(1);
            expect(res.body.data.areas_of_concern).toHaveLength(1);
            expect(res.body.data.goal_achievement).toBeDefined();
            expect(res.body.data.calibration_impact).toBeDefined();
            expect(res.body.data.generated_at).toBeDefined();
        });
    });
    describe('GET /heatmap', () => {
        it('should return heatmap data', async () => {
            const data = [
                { department: 'IT', rating: 3, count: '10' },
                { department: 'IT', rating: 4, count: '8' },
                { department: 'HR', rating: 3, count: '5' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: data, rowCount: 3 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/heatmap')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.heatmap).toHaveLength(2);
            expect(res.body.data.departments).toContain('IT');
            expect(res.body.data.ratings).toEqual([1, 2, 3, 4, 5]);
        });
    });
    describe('GET /completion-rates', () => {
        it('should return completion rates by department', async () => {
            const rates = [
                {
                    group_id: 'd1',
                    group_name: 'IT',
                    total_reviews: '20',
                    completed: '18',
                    completion_rate: '90.0',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: rates, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/completion-rates')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.grouped_by).toBe('department');
        });
        it('should group by manager', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/performance-analytics/completion-rates?group_by=manager')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.grouped_by).toBe('manager');
        });
    });
});
//# sourceMappingURL=performance-analytics.test.js.map