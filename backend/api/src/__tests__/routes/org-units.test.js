/**
 * org-units Routes - Unit Tests
 * Comprehensive behavioral tests for org-units CRUD endpoints.
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
const { default: routeHandler } = await import('../../routes/org-units.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const VALID_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const VALID_UUID_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/org-units', authMiddleware);
    app.use('/api/v1/org-units', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/org-units', routeHandler);
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
describe('org-units Routes', () => {
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
            const res = await supertest(app).get('/api/v1/org-units/');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /
    // =========================================================================
    describe('GET /', () => {
        it('should list org units with pagination', async () => {
            const units = [
                { id: VALID_UUID, code: 'IT', name: 'Information Technology', employee_count: 5 },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: units, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '47' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].code).toBe('IT');
            expect(res.body.meta.total).toBe(47);
        });
        it('should return empty list when no org units', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.total).toBe(0);
        });
        it('should filter by is_active', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-units/?is_active=true')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should filter by org_type', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-units/?org_type=department')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should filter by parent_id=null for root units', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-units/?parent_id=null')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should support search query', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/org-units/?search=Finance')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /tree
    // =========================================================================
    describe('GET /tree', () => {
        it('should return hierarchical tree structure', async () => {
            const rows = [
                {
                    id: '1',
                    code: 'ROOT',
                    name: 'Company',
                    parent_id: null,
                    org_level: 1,
                    org_type: 'company',
                    is_active: true,
                    employee_count: 0,
                },
                {
                    id: '2',
                    code: 'IT',
                    name: 'IT',
                    parent_id: '1',
                    org_level: 2,
                    org_type: 'department',
                    is_active: true,
                    employee_count: 10,
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/org-units/tree')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1); // only root nodes
            expect(res.body.data[0].children).toHaveLength(1);
        });
        it('should return empty tree when no units', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/org-units/tree')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /types
    // =========================================================================
    describe('GET /types', () => {
        it('should return distinct org types', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ org_type: 'department' }, { org_type: 'division' }, { org_type: 'team' }],
                rowCount: 3,
            });
            const res = await supertest(app)
                .get('/api/v1/org-units/types')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(['department', 'division', 'team']);
        });
    });
    // =========================================================================
    // GET /:id
    // =========================================================================
    describe('GET /:id', () => {
        it('should return org unit details', async () => {
            const unit = {
                id: VALID_UUID,
                code: 'IT',
                name: 'IT',
                department_name: 'Information Technology',
                employee_count: 15,
                children_count: 3,
            };
            mockQuery.mockResolvedValueOnce({ rows: [unit], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.code).toBe('IT');
            expect(res.body.data.employee_count).toBe(15);
        });
        it('should return 404 when unit not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /
    // =========================================================================
    describe('POST /', () => {
        it('should create org unit and return 201', async () => {
            const created = { id: VALID_UUID, code: 'MKT', name: 'Marketing', is_active: true };
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // uniqueness check
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 }); // INSERT
            const res = await supertest(app)
                .post('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`)
                .send({ code: 'MKT', name: 'Marketing' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.code).toBe('MKT');
            expect(res.body.message).toMatch(/created/i);
        });
        it('should return 409 when code already exists', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`)
                .send({ code: 'IT', name: 'IT OrgUnit' });
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/already exists/i);
        });
        it('should reject when code is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'No Code' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should reject when name is missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`)
                .send({ code: 'TST' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should accept optional fields', async () => {
            const created = {
                id: VALID_UUID,
                code: 'FIN',
                name: 'Finance',
                org_level: 2,
                org_type: 'department',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [created], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/org-units/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                code: 'FIN',
                name: 'Finance',
                org_level: 2,
                org_type: 'department',
                parent_id: VALID_UUID,
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // PATCH /:id
    // =========================================================================
    describe('PATCH /:id', () => {
        it('should update org unit', async () => {
            const updated = { id: VALID_UUID, name: 'Updated IT', code: 'IT' };
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 }) // exists check
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 }); // UPDATE
            const res = await supertest(app)
                .patch(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated IT' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Updated IT');
            expect(res.body.message).toMatch(/updated/i);
        });
        it('should return 404 when unit not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when no fields to update', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: VALID_UUID }], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/[Nn]o fields/i);
        });
    });
    // =========================================================================
    // DELETE /:id
    // =========================================================================
    describe('DELETE /:id', () => {
        it('should deactivate org unit', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, name: 'Old Unit' }], rowCount: 1 }) // exists
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // child count
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // employee count
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE deactivate
            const res = await supertest(app)
                .delete(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/deactivated/i);
        });
        it('should return 404 when unit not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when unit has children', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, name: 'Parent' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/children/i);
        });
        it('should return 400 when unit has assigned employees', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, name: 'Unit' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // no children
                .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 }); // employees
            const res = await supertest(app)
                .delete(`/api/v1/org-units/${VALID_UUID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/employees/i);
        });
    });
    // =========================================================================
    // GET /:id/children
    // =========================================================================
    describe('GET /:id/children', () => {
        it('should return child org units', async () => {
            const children = [
                { id: 'c1', code: 'IT-DEV', name: 'Development', org_level: 3, employee_count: 8 },
                { id: 'c2', code: 'IT-OPS', name: 'Operations', org_level: 3, employee_count: 4 },
            ];
            mockQuery.mockResolvedValueOnce({ rows: children, rowCount: 2 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}/children`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].code).toBe('IT-DEV');
        });
        it('should return empty array when no children', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}/children`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // GET /:id/employees
    // =========================================================================
    describe('GET /:id/employees', () => {
        it('should return employees in org unit', async () => {
            const employees = [
                { id: 'e1', first_name: 'Mario', last_name: 'Rossi', job_title: 'Developer' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: employees, rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}/employees`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.meta.count).toBe(1);
        });
        it('should include children when includeChildren=true', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}/employees?includeChildren=true`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /:id/path
    // =========================================================================
    describe('GET /:id/path', () => {
        it('should return path from root to unit', async () => {
            const path = [
                { id: '1', code: 'ROOT', name: 'Company', org_level: 1 },
                { id: '2', code: 'IT', name: 'IT Division', org_level: 2 },
                { id: '3', code: 'IT-DEV', name: 'Development', org_level: 3 },
            ];
            mockQuery.mockResolvedValueOnce({ rows: path, rowCount: 3 });
            const res = await supertest(app)
                .get(`/api/v1/org-units/${VALID_UUID}/path`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(3);
            expect(res.body.meta.depth).toBe(3);
        });
    });
    // =========================================================================
    // POST /:id/move
    // =========================================================================
    describe('POST /:id/move', () => {
        it('should move org unit to new parent', async () => {
            const moved = { id: VALID_UUID, name: 'IT', parent_id: VALID_UUID_2 };
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: VALID_UUID, name: 'IT', parent_id: null }],
                rowCount: 1,
            }) // exists
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID_2 }], rowCount: 1 }) // parent exists
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no circular ref
                .mockResolvedValueOnce({ rows: [moved], rowCount: 1 }); // UPDATE
            const res = await supertest(app)
                .post(`/api/v1/org-units/${VALID_UUID}/move`)
                .set('Authorization', `Bearer ${token}`)
                .send({ newParentId: VALID_UUID_2 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/moved/i);
        });
        it('should return 404 when unit not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/org-units/${VALID_UUID}/move`)
                .set('Authorization', `Bearer ${token}`)
                .send({ newParentId: VALID_UUID_2 });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when new parent not found', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, name: 'IT' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // parent not found
            const res = await supertest(app)
                .post(`/api/v1/org-units/${VALID_UUID}/move`)
                .set('Authorization', `Bearer ${token}`)
                .send({ newParentId: VALID_UUID_2 });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/parent/i);
        });
        it('should return 400 for circular reference', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, name: 'IT' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: VALID_UUID_2 }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 }); // circular detected
            const res = await supertest(app)
                .post(`/api/v1/org-units/${VALID_UUID}/move`)
                .set('Authorization', `Bearer ${token}`)
                .send({ newParentId: VALID_UUID_2 });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/descendant/i);
        });
        it('should move to root (null parent)', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: VALID_UUID, name: 'IT', parent_id: VALID_UUID_2 }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ id: VALID_UUID, name: 'IT', parent_id: null }],
                rowCount: 1,
            }); // UPDATE
            const res = await supertest(app)
                .post(`/api/v1/org-units/${VALID_UUID}/move`)
                .set('Authorization', `Bearer ${token}`)
                .send({ newParentId: null });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /meta/statistics
    // =========================================================================
    describe('GET /meta/statistics', () => {
        it('should return org structure statistics', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: '47' }], rowCount: 1 }) // total
                .mockResolvedValueOnce({
                rows: [
                    { org_type: 'department', count: '20' },
                    { org_type: 'division', count: '10' },
                ],
                rowCount: 2,
            }) // by type
                .mockResolvedValueOnce({
                rows: [
                    { org_level: 1, count: '1' },
                    { org_level: 2, count: '5' },
                ],
                rowCount: 2,
            }) // by level
                .mockResolvedValueOnce({ rows: [{ max_depth: 5 }], rowCount: 1 }); // max depth
            const res = await supertest(app)
                .get('/api/v1/org-units/meta/statistics')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalUnits).toBe(47);
            expect(res.body.data.maxDepth).toBe(5);
            expect(res.body.data.byType.department).toBe(20);
            expect(res.body.data.byLevel).toHaveLength(2);
        });
    });
});
//# sourceMappingURL=org-units.test.js.map