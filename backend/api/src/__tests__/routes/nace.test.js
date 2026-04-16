/**
 * NACE Routes - Unit Tests
 * Tests HTTP behavior for NACE classification endpoints.
 * Note: NACE routes use req.dbClient for queries and
 * do NOT require tenant context or auth.
 *
 * Endpoints tested:
 *  GET /sections      - List NACE sections
 *  GET /divisions     - List divisions (optionally by section)
 *  GET /groups        - List groups (optionally by division)
 *  GET /size-classes  - List size classes
 *  GET /hierarchy     - Full hierarchy
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockPoolQuery = jest.fn();
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockPoolQuery },
    appPool: { connect: jest.fn() },
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
// Mock cache service to bypass caching
jest.unstable_mockModule(resolve('../../services/cache.js'), () => ({
    cached: jest.fn().mockImplementation(async (_key, fn) => fn()),
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/nace.js');
const supertest = (await import('supertest')).default;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/nace', (req, _res, next) => {
        req.dbClient = { query: mockPoolQuery, release: jest.fn() };
        next();
    });
    app.use('/api/v1/nace', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || 500;
        res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    });
    return app;
}
describe('nace Routes', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        app = createTestApp();
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // ── GET /sections ─────────────────────────────────────────────────────
    it('GET /sections returns 200 with section list', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ code: 'A', name_en: 'Agriculture', is_active: true }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/nace/sections');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].code).toBe('A');
    });
    it('GET /sections returns empty array when no data', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/nace/sections');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });
    it('GET /sections returns 500 on DB error', async () => {
        mockPoolQuery.mockRejectedValueOnce(new Error('DB down'));
        const res = await supertest(app).get('/api/v1/nace/sections');
        expect(res.status).toBe(500);
    });
    // ── GET /divisions ────────────────────────────────────────────────────
    it('GET /divisions returns 200 with division list', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ code: '01', section_code: 'A', name_en: 'Crop production' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/nace/divisions');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    it('GET /divisions with section filter returns filtered data', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [{ code: '01', section_code: 'A' }], rowCount: 1 });
        const res = await supertest(app).get('/api/v1/nace/divisions?section=A');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    // ── GET /groups ───────────────────────────────────────────────────────
    it('GET /groups returns 200 with group list', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ code: '01.1', division_code: '01', name_en: 'Growing' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/nace/groups');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    it('GET /groups with division filter returns filtered data', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [{ code: '01.1', division_code: '01' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/nace/groups?division=01');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
    });
    it('GET /groups returns 500 on DB error', async () => {
        mockPoolQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app).get('/api/v1/nace/groups');
        expect(res.status).toBe(500);
    });
    // ── GET /size-classes ─────────────────────────────────────────────────
    it('GET /size-classes returns 200 with size class list', async () => {
        mockPoolQuery.mockResolvedValueOnce({
            rows: [
                {
                    code: 'MICRO',
                    name_it: 'Micro impresa',
                    name_en: 'Micro enterprise',
                    min_employees: 1,
                    max_employees: 9,
                    sort_order: 1,
                },
                {
                    code: 'SMALL',
                    name_it: 'Piccola impresa',
                    name_en: 'Small enterprise',
                    min_employees: 10,
                    max_employees: 49,
                    sort_order: 2,
                },
            ],
            rowCount: 2,
        });
        const res = await supertest(app).get('/api/v1/nace/size-classes');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].name_en).toContain('Micro');
    });
    it('GET /size-classes returns empty when no prototypes', async () => {
        mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        const res = await supertest(app).get('/api/v1/nace/size-classes');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });
    // ── GET /hierarchy ────────────────────────────────────────────────────
    it('GET /hierarchy returns 200 with full hierarchy', async () => {
        mockPoolQuery
            .mockResolvedValueOnce({ rows: [{ code: 'A', name_en: 'Agriculture' }], rowCount: 1 })
            .mockResolvedValueOnce({
            rows: [{ code: '01', section_code: 'A', name_en: 'Crops' }],
            rowCount: 1,
        })
            .mockResolvedValueOnce({
            rows: [{ code: '01.1', division_code: '01', name_en: 'Growing' }],
            rowCount: 1,
        });
        const res = await supertest(app).get('/api/v1/nace/hierarchy');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('sections');
        expect(res.body.data).toHaveProperty('divisions');
        expect(res.body.data).toHaveProperty('groups');
        expect(res.body.data.sections).toHaveLength(1);
    });
    it('GET /hierarchy returns 500 on DB error', async () => {
        mockPoolQuery.mockRejectedValueOnce(new Error('DB error'));
        const res = await supertest(app).get('/api/v1/nace/hierarchy');
        expect(res.status).toBe(500);
    });
    // ── Edge cases ────────────────────────────────────────────────────────
    it('GET /nonexistent returns 404', async () => {
        const res = await supertest(app).get('/api/v1/nace/nonexistent');
        expect(res.status).toBe(404);
    });
    it('POST /sections returns 404 (GET only)', async () => {
        const res = await supertest(app).post('/api/v1/nace/sections');
        expect(res.status).toBe(404);
    });
});
//# sourceMappingURL=nace.test.js.map