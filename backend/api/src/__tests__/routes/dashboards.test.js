/**
 * Dashboards Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for dashboard widget framework endpoints.
 * All external dependencies (database, redis, services) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS, } from '../factories/index.js';
// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------
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
// Mock dashboard-widgets service
const mockGetDashboardStats = jest.fn();
const mockGetPopularWidgets = jest.fn();
const mockGetWidgetTemplates = jest.fn();
const mockCreateWidgetTemplate = jest.fn();
const mockListDashboards = jest.fn();
const mockGetDashboard = jest.fn();
const mockCreateDashboard = jest.fn();
const mockUpdateDashboard = jest.fn();
const mockDeleteDashboard = jest.fn();
const mockDuplicateDashboard = jest.fn();
const mockGetWidgets = jest.fn();
const mockAddWidget = jest.fn();
const mockUpdateWidget = jest.fn();
const mockDeleteWidget = jest.fn();
const mockUpdateWidgetPositions = jest.fn();
const mockFetchDashboardData = jest.fn();
const mockFetchWidgetData = jest.fn();
jest.unstable_mockModule(resolve('../../services/dashboard-widgets.js'), () => ({
    dashboardWidgetService: {
        getDashboardStats: mockGetDashboardStats,
        getPopularWidgets: mockGetPopularWidgets,
        getWidgetTemplates: mockGetWidgetTemplates,
        createWidgetTemplate: mockCreateWidgetTemplate,
        listDashboards: mockListDashboards,
        getDashboard: mockGetDashboard,
        createDashboard: mockCreateDashboard,
        updateDashboard: mockUpdateDashboard,
        deleteDashboard: mockDeleteDashboard,
        duplicateDashboard: mockDuplicateDashboard,
        getWidgets: mockGetWidgets,
        addWidget: mockAddWidget,
        updateWidget: mockUpdateWidget,
        deleteWidget: mockDeleteWidget,
        updateWidgetPositions: mockUpdateWidgetPositions,
        fetchDashboardData: mockFetchDashboardData,
        fetchWidgetData: mockFetchWidgetData,
    },
}));
// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------
const { default: express } = await import('express');
const { default: dashboardsRoutes } = await import('../../routes/dashboards.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
// ---------------------------------------------------------------------------
// Constants & Test app factory
// ---------------------------------------------------------------------------
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const USER_UUID = DEFAULT_IDS.USER_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/dashboards', authMiddleware);
    app.use('/api/v1/dashboards', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/dashboards', dashboardsRoutes);
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
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Dashboards Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
    });
    // =========================================================================
    // Auth enforcement
    // =========================================================================
    describe('Auth enforcement', () => {
        it('should return 401 for GET / without token', async () => {
            const res = await supertest(app).get('/api/v1/dashboards/');
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST / without token', async () => {
            const res = await supertest(app).post('/api/v1/dashboards/').send({ name: 'Test' });
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /dashboards/stats
    // =========================================================================
    describe('GET /stats', () => {
        it('should return 200 with dashboard stats', async () => {
            mockGetDashboardStats.mockResolvedValueOnce({
                total_dashboards: 5,
                total_widgets: 20,
                active_users: 10,
            });
            const res = await supertest(app)
                .get('/api/v1/dashboards/stats?user_id=' + USER_UUID)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total_dashboards).toBe(5);
            expect(mockGetDashboardStats).toHaveBeenCalledWith(TENANT_ID, USER_UUID);
        });
        it('should return 500 when service throws', async () => {
            mockGetDashboardStats.mockRejectedValueOnce(new Error('Service error'));
            const res = await supertest(app)
                .get('/api/v1/dashboards/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /dashboards/popular-widgets
    // =========================================================================
    describe('GET /popular-widgets', () => {
        it('should return 200 with popular widgets', async () => {
            const widgets = [
                { id: 'w1', name: 'KPI Widget', usage_count: 50 },
                { id: 'w2', name: 'Chart Widget', usage_count: 30 },
            ];
            mockGetPopularWidgets.mockResolvedValueOnce(widgets);
            const res = await supertest(app)
                .get('/api/v1/dashboards/popular-widgets')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].name).toBe('KPI Widget');
            expect(mockGetPopularWidgets).toHaveBeenCalledWith(TENANT_ID, 10);
        });
        it('should pass custom limit parameter', async () => {
            mockGetPopularWidgets.mockResolvedValueOnce([]);
            const res = await supertest(app)
                .get('/api/v1/dashboards/popular-widgets?limit=5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(mockGetPopularWidgets).toHaveBeenCalledWith(TENANT_ID, 5);
        });
    });
    // =========================================================================
    // GET /dashboards/templates
    // =========================================================================
    describe('GET /templates', () => {
        it('should return 200 with widget templates', async () => {
            const templates = [{ id: 't1', name: 'Employee KPI', category: 'hr' }];
            mockGetWidgetTemplates.mockResolvedValueOnce(templates);
            const res = await supertest(app)
                .get('/api/v1/dashboards/templates')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Employee KPI');
        });
        it('should pass filter parameters to service', async () => {
            mockGetWidgetTemplates.mockResolvedValueOnce([]);
            await supertest(app)
                .get('/api/v1/dashboards/templates?category=hr&type=kpi&include_system=false')
                .set('Authorization', `Bearer ${token}`);
            expect(mockGetWidgetTemplates).toHaveBeenCalledWith(TENANT_ID, {
                category: 'hr',
                type: 'kpi',
                include_system: false,
            });
        });
    });
    // =========================================================================
    // POST /dashboards/templates
    // =========================================================================
    describe('POST /templates', () => {
        const validTemplate = {
            name: 'Custom KPI Widget',
            category: 'performance',
            default_config: { type: 'kpi', title: 'Performance' },
        };
        it('should return 201 when creating a widget template', async () => {
            const created = { id: 'new-t1', ...validTemplate };
            mockCreateWidgetTemplate.mockResolvedValueOnce(created);
            const res = await supertest(app)
                .post('/api/v1/dashboards/templates')
                .set('Authorization', `Bearer ${token}`)
                .send(validTemplate);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe('new-t1');
            expect(res.body.message).toBe('Widget template created successfully');
        });
        it('should return 400 when name is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/dashboards/templates')
                .set('Authorization', `Bearer ${token}`)
                .send({ category: 'hr', default_config: {} });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when category is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/dashboards/templates')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Test', default_config: {} });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /dashboards (list)
    // =========================================================================
    describe('GET / (list)', () => {
        it('should return 200 with paginated dashboards list', async () => {
            mockListDashboards.mockResolvedValueOnce({
                dashboards: [{ id: 'd1', name: 'My Dashboard', created_by: USER_UUID }],
                total: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/dashboards/?user_id=${USER_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.total).toBe(1);
            expect(res.body.meta.page).toBe(1);
            expect(res.body.meta.page_size).toBe(20);
        });
        it('should return 400 when user_id is missing', async () => {
            const res = await supertest(app)
                .get('/api/v1/dashboards/')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
        it('should pass pagination and search parameters', async () => {
            mockListDashboards.mockResolvedValueOnce({ dashboards: [], total: 0 });
            await supertest(app)
                .get(`/api/v1/dashboards/?user_id=${USER_UUID}&page=2&page_size=10&search=test&include_public=false`)
                .set('Authorization', `Bearer ${token}`);
            expect(mockListDashboards).toHaveBeenCalledWith(TENANT_ID, USER_UUID, {
                include_public: false,
                search: 'test',
                page: 2,
                page_size: 10,
            });
        });
    });
    // =========================================================================
    // GET /dashboards/:id
    // =========================================================================
    describe('GET /:id', () => {
        it('should return 200 with dashboard data', async () => {
            const dashboard = { id: VALID_UUID, name: 'My Dashboard', widgets: [] };
            mockGetDashboard.mockResolvedValueOnce(dashboard);
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(VALID_UUID);
        });
        it('should return 404 when dashboard not found', async () => {
            mockGetDashboard.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // POST /dashboards
    // =========================================================================
    describe('POST /', () => {
        const validDashboard = {
            name: 'New Dashboard',
            created_by: USER_UUID,
        };
        it('should return 201 when creating a dashboard', async () => {
            const created = { id: 'new-d1', ...validDashboard, tenant_id: TENANT_ID };
            mockCreateDashboard.mockResolvedValueOnce(created);
            const res = await supertest(app)
                .post('/api/v1/dashboards/')
                .set('Authorization', `Bearer ${token}`)
                .send(validDashboard);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe('new-d1');
            expect(res.body.message).toBe('Dashboard created successfully');
        });
        it('should return 400 when name is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/dashboards/')
                .set('Authorization', `Bearer ${token}`)
                .send({ created_by: USER_UUID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when created_by is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/dashboards/')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Test' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 when service throws', async () => {
            mockCreateDashboard.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .post('/api/v1/dashboards/')
                .set('Authorization', `Bearer ${token}`)
                .send(validDashboard);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // PATCH /dashboards/:id
    // =========================================================================
    describe('PATCH /:id', () => {
        it('should return 200 when updating dashboard', async () => {
            const updated = { id: VALID_UUID, name: 'Updated Dashboard' };
            mockUpdateDashboard.mockResolvedValueOnce(updated);
            const res = await supertest(app)
                .patch(`/api/v1/dashboards/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ user_id: USER_UUID, name: 'Updated Dashboard' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Updated Dashboard');
            expect(res.body.message).toBe('Dashboard updated successfully');
        });
        it('should return 400 when user_id is missing (Zod validation)', async () => {
            const res = await supertest(app)
                .patch(`/api/v1/dashboards/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when dashboard not found', async () => {
            mockUpdateDashboard.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .patch(`/api/v1/dashboards/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ user_id: USER_UUID, name: 'Updated' });
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // DELETE /dashboards/:id
    // =========================================================================
    describe('DELETE /:id', () => {
        it('should return 200 when deleting dashboard', async () => {
            mockDeleteDashboard.mockResolvedValueOnce(true);
            const res = await supertest(app)
                .delete(`/api/v1/dashboards/${VALID_UUID}?user_id=${USER_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Dashboard deleted successfully');
        });
        it('should return 400 when user_id is missing', async () => {
            const res = await supertest(app)
                .delete(`/api/v1/dashboards/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
        it('should return 404 when dashboard not found', async () => {
            mockDeleteDashboard.mockResolvedValueOnce(false);
            const res = await supertest(app)
                .delete(`/api/v1/dashboards/${VALID_UUID}?user_id=${USER_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // POST /dashboards/:id/duplicate
    // =========================================================================
    describe('POST /:id/duplicate', () => {
        it('should return 201 when duplicating dashboard', async () => {
            const duplicated = { id: 'dup-d1', name: 'Copy of Dashboard' };
            mockDuplicateDashboard.mockResolvedValueOnce(duplicated);
            const res = await supertest(app)
                .post(`/api/v1/dashboards/${VALID_UUID}/duplicate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Copy of Dashboard', user_id: USER_UUID });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Copy of Dashboard');
            expect(res.body.message).toBe('Dashboard duplicated successfully');
        });
        it('should return 400 when name is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/dashboards/${VALID_UUID}/duplicate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ user_id: USER_UUID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when user_id is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/dashboards/${VALID_UUID}/duplicate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Copy' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /dashboards/:id/widgets
    // =========================================================================
    describe('GET /:id/widgets', () => {
        it('should return 200 with widgets list', async () => {
            const widgets = [
                { id: 'w1', config: { title: 'KPI' }, position: { x: 0, y: 0 } },
                { id: 'w2', config: { title: 'Chart' }, position: { x: 1, y: 0 } },
            ];
            mockGetWidgets.mockResolvedValueOnce(widgets);
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}/widgets`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
        });
        it('should return 200 with empty array when no widgets', async () => {
            mockGetWidgets.mockResolvedValueOnce([]);
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}/widgets`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
    // =========================================================================
    // POST /dashboards/:id/widgets
    // =========================================================================
    describe('POST /:id/widgets', () => {
        const validWidget = {
            config: { title: 'New Widget', type: 'kpi' },
            position: { x: 0, y: 0, width: 4, height: 2 },
            created_by: USER_UUID,
        };
        it('should return 201 when adding widget', async () => {
            const created = { id: 'new-w1', ...validWidget };
            mockAddWidget.mockResolvedValueOnce(created);
            const res = await supertest(app)
                .post(`/api/v1/dashboards/${VALID_UUID}/widgets`)
                .set('Authorization', `Bearer ${token}`)
                .send(validWidget);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe('new-w1');
            expect(res.body.message).toBe('Widget added successfully');
        });
        it('should return 400 when config is missing', async () => {
            const res = await supertest(app)
                .post(`/api/v1/dashboards/${VALID_UUID}/widgets`)
                .set('Authorization', `Bearer ${token}`)
                .send({ position: { x: 0, y: 0 }, created_by: USER_UUID });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // PATCH /dashboards/:id/widgets/:widgetId
    // =========================================================================
    describe('PATCH /:id/widgets/:widgetId', () => {
        it('should return 200 when updating widget', async () => {
            const updated = { id: 'w1', config: { title: 'Updated' } };
            mockUpdateWidget.mockResolvedValueOnce(updated);
            const res = await supertest(app)
                .patch(`/api/v1/dashboards/${VALID_UUID}/widgets/w1`)
                .set('Authorization', `Bearer ${token}`)
                .send({ config: { title: 'Updated' } });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Widget updated successfully');
        });
        it('should return 404 when widget not found', async () => {
            mockUpdateWidget.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .patch(`/api/v1/dashboards/${VALID_UUID}/widgets/w-nonexistent`)
                .set('Authorization', `Bearer ${token}`)
                .send({ config: { title: 'Updated' } });
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // DELETE /dashboards/:id/widgets/:widgetId
    // =========================================================================
    describe('DELETE /:id/widgets/:widgetId', () => {
        it('should return 200 when deleting widget', async () => {
            mockDeleteWidget.mockResolvedValueOnce(true);
            const res = await supertest(app)
                .delete(`/api/v1/dashboards/${VALID_UUID}/widgets/w1`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Widget deleted successfully');
        });
        it('should return 404 when widget not found', async () => {
            mockDeleteWidget.mockResolvedValueOnce(false);
            const res = await supertest(app)
                .delete(`/api/v1/dashboards/${VALID_UUID}/widgets/w-nonexistent`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // PUT /dashboards/:id/widgets/positions
    // =========================================================================
    describe('PUT /:id/widgets/positions', () => {
        it('should return 200 when updating widget positions', async () => {
            mockUpdateWidgetPositions.mockResolvedValueOnce(undefined);
            const w1Uuid = 'aaaaaaaa-bbbb-cccc-dddd-111111111111';
            const w2Uuid = 'aaaaaaaa-bbbb-cccc-dddd-222222222222';
            const res = await supertest(app)
                .put(`/api/v1/dashboards/${VALID_UUID}/widgets/positions`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                positions: [
                    { widget_id: w1Uuid, position: { x: 0, y: 0, width: 4, height: 2 } },
                    { widget_id: w2Uuid, position: { x: 4, y: 0, width: 4, height: 2 } },
                ],
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Widget positions updated successfully');
        });
        it('should return 400 when positions is not an array', async () => {
            const res = await supertest(app)
                .put(`/api/v1/dashboards/${VALID_UUID}/widgets/positions`)
                .set('Authorization', `Bearer ${token}`)
                .send({ positions: 'not-an-array' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /dashboards/:id/data
    // =========================================================================
    describe('GET /:id/data', () => {
        it('should return 200 with dashboard data map', async () => {
            const dataMap = new Map();
            dataMap.set('w1', { value: 42 });
            dataMap.set('w2', { items: [1, 2, 3] });
            mockFetchDashboardData.mockResolvedValueOnce(dataMap);
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}/data`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.w1.value).toBe(42);
            expect(res.body.data.w2.items).toEqual([1, 2, 3]);
        });
        it('should return 500 when service throws', async () => {
            mockFetchDashboardData.mockRejectedValueOnce(new Error('fetch error'));
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}/data`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /dashboards/:id/widgets/:widgetId/data
    // =========================================================================
    describe('GET /:id/widgets/:widgetId/data', () => {
        it('should return 200 with widget data', async () => {
            const widget = { id: 'w1', config: { title: 'KPI' } };
            mockGetWidgets.mockResolvedValueOnce([widget]);
            mockFetchWidgetData.mockResolvedValueOnce({ value: 99 });
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}/widgets/w1/data`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.value).toBe(99);
        });
        it('should return 404 when widget not found in dashboard', async () => {
            mockGetWidgets.mockResolvedValueOnce([{ id: 'w-other', config: {} }]);
            const res = await supertest(app)
                .get(`/api/v1/dashboards/${VALID_UUID}/widgets/w-nonexistent/data`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
});
//# sourceMappingURL=dashboards.test.js.map