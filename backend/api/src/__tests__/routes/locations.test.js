/**
 * Locations Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for location CRUD endpoints.
 * All external dependencies (database, redis, sentry) are mocked.
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
const { default: locationsRoutes } = await import('../../routes/locations.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const VALID_UUID = DEFAULT_IDS.DEPARTMENT_ID;
const LOC_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/locations', authMiddleware);
    app.use('/api/v1/locations', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/locations', locationsRoutes);
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
const sampleLocation = {
    id: LOC_ID,
    code: 'MI-HQ',
    name: 'Sede Milano',
    location_type: 'headquarters',
    address: 'Via Roma 1',
    city: 'Milano',
    province: 'MI',
    postal_code: '20100',
    country: 'IT',
    latitude: 45.4642,
    longitude: 9.19,
    phone: '+39 02 1234567',
    email: 'milano@rtl-bank.com',
    is_active: true,
    capacity_headcount: 500,
    square_meters: 5000,
    opening_date: '2010-01-01',
    closing_date: null,
    employee_count: '120',
    org_unit_count: '8',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
};
describe('Locations Routes', () => {
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
        it('should return 401 when no auth token is provided', async () => {
            const res = await supertest(app).get('/api/v1/locations');
            expect(res.status).toBe(401);
        });
        it('should return 401 with invalid token', async () => {
            const res = await supertest(app)
                .get('/api/v1/locations')
                .set('Authorization', 'Bearer bad-token');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /locations
    // =========================================================================
    describe('GET /locations', () => {
        it('should return paginated list of locations', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleLocation], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Sede Milano');
            expect(res.body.data[0].employee_count).toBe('120');
            expect(res.body.meta.total).toBe(1);
            expect(res.body.meta.limit).toBe(100);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should filter by is_active', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleLocation], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations?is_active=true')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by location_type', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleLocation], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations?location_type=headquarters')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by city', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleLocation], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations?city=Milano')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should support search query', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [sampleLocation], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations?search=milano')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should respect custom limit and offset', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '32' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations?limit=5&offset=10')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.meta.limit).toBe(5);
            expect(res.body.meta.offset).toBe(10);
            expect(res.body.meta.total).toBe(32);
        });
        it('should return empty data when no locations exist', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.total).toBe(0);
        });
    });
    // =========================================================================
    // GET /locations/types
    // =========================================================================
    describe('GET /locations/types', () => {
        it('should return distinct location types', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { location_type: 'headquarters' },
                    { location_type: 'branch' },
                    { location_type: 'satellite' },
                ],
                rowCount: 3,
            });
            const res = await supertest(app)
                .get('/api/v1/locations/types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(['headquarters', 'branch', 'satellite']);
        });
        it('should return empty array when no types exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/locations/types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /locations/:id
    // =========================================================================
    describe('GET /locations/:id', () => {
        it('should return a single location with counts', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [sampleLocation], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/locations/${LOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(LOC_ID);
            expect(res.body.data.name).toBe('Sede Milano');
            expect(res.body.data.employee_count).toBe('120');
        });
        it('should return 404 when location is not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/locations/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB timeout'));
            const res = await supertest(app)
                .get(`/api/v1/locations/${LOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /locations
    // =========================================================================
    describe('POST /locations', () => {
        const validPayload = {
            code: 'RM-BR',
            name: 'Filiale Roma',
            location_type: 'branch',
            city: 'Roma',
            country: 'IT',
        };
        it('should create a new location with 201', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dup check
            const created = { id: LOC_ID, ...validPayload, is_active: true };
            mockQuery.mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // insert
            const res = await supertest(app)
                .post('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.code).toBe('RM-BR');
            expect(res.body.message).toBe('Location created');
        });
        it('should return 409 when location code already exists', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
        it('should return 400 when code is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'No Code' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when name is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`)
                .send({ code: 'NO-NAME' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 500 on database insert failure', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // dup check
            mockQuery.mockRejectedValueOnce(new Error('Insert failed'));
            const res = await supertest(app)
                .post('/api/v1/locations')
                .set('Authorization', `Bearer ${token}`)
                .send(validPayload);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // PATCH /locations/:id
    // =========================================================================
    describe('PATCH /locations/:id', () => {
        it('should update an existing location', async () => {
            const updated = { ...sampleLocation, name: 'Sede Milano Centrale' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: LOC_ID }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/locations/${LOC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Sede Milano Centrale' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Sede Milano Centrale');
            expect(res.body.message).toBe('Location updated');
        });
        it('should return 404 when location to update does not exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/locations/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Name' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when no recognized fields are sent', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: LOC_ID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/locations/${LOC_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ random_field: 'nope' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // DELETE /locations/:id
    // =========================================================================
    describe('DELETE /locations/:id', () => {
        it('should soft-delete (deactivate) a location by default', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: LOC_ID, name: 'Sede Milano' }], rowCount: 1 }) // existence
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // employee count
                .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // update
            const res = await supertest(app)
                .delete(`/api/v1/locations/${LOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('deactivated');
        });
        it('should hard-delete when hard=true query parameter is set', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: LOC_ID, name: 'Sede Milano' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/locations/${LOC_ID}?hard=true`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('deleted');
        });
        it('should return 404 when location does not exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/locations/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when location has assigned employees', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: LOC_ID, name: 'Sede Milano' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/locations/${LOC_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBeDefined();
        });
    });
    // =========================================================================
    // GET /locations/:id/employees
    // =========================================================================
    describe('GET /locations/:id/employees', () => {
        it('should return employees at the given location', async () => {
            const employees = [
                {
                    id: 'emp-1',
                    first_name: 'Mario',
                    last_name: 'Rossi',
                    email: 'mario@rtl.com',
                    job_title: 'Developer',
                    department: 'IT',
                    hire_date: '2020-01-01',
                    is_active: true,
                },
                {
                    id: 'emp-2',
                    first_name: 'Lucia',
                    last_name: 'Bianchi',
                    email: 'lucia@rtl.com',
                    job_title: 'Analyst',
                    department: 'Finance',
                    hire_date: '2021-06-15',
                    is_active: true,
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: employees, rowCount: 2 });
            const res = await supertest(app)
                .get(`/api/v1/locations/${LOC_ID}/employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].first_name).toBe('Mario');
        });
        it('should return empty array when no employees at location', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/locations/${LOC_ID}/employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=locations.test.js.map