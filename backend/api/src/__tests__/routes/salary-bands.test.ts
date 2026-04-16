/**
 * Salary Bands Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for salary band CRUD endpoints.
 *
 * Endpoints tested:
 *  GET    /salary-bands/stats   - Salary band statistics
 *  GET    /salary-bands         - List salary bands with filters
 *  GET    /salary-bands/:id     - Single salary band detail
 *  POST   /salary-bands         - Create a salary band
 *  PATCH  /salary-bands/:id     - Update a salary band
 *  DELETE /salary-bands/:id     - Soft-delete (deactivate) a salary band
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockClientRelease,
} as never);

jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
  pool: { query: mockQuery },
  appPool: { connect: mockConnect },
  testConnection: jest.fn().mockResolvedValue(true as never),
  testAppConnection: jest.fn().mockResolvedValue(true as never),
  closePool: jest.fn().mockResolvedValue(undefined as never),
  getAppClient: jest.fn(),
  withTenantClient: jest.fn(),
}));

jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
  getRedis: jest.fn(),
  isRedisReady: jest.fn().mockReturnValue(false),
  blacklistToken: jest.fn().mockResolvedValue(true as never),
  isTokenBlacklisted: jest.fn().mockResolvedValue(false as never),
  closeRedis: jest.fn().mockResolvedValue(undefined as never),
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
const { default: routeUnderTest } = await import('../../routes/salary-bands.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/salary-bands', authMiddleware);
  app.use('/api/v1/salary-bands', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/salary-bands', routeUnderTest);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const BAND_ROW = {
  id: '11111111-aaaa-bbbb-cccc-dddddddddddd',
  tenant_id: TENANT_ID,
  band_code: 'SB-01',
  band_name: 'Fascia Senior Developer',
  description: 'Fascia retributiva per sviluppatori senior',
  job_level: 'Senior',
  job_family: 'IT',
  currency: 'EUR',
  min_salary: 45000,
  mid_salary: 55000,
  max_salary: 65000,
  range_spread_percent: 44.4,
  geo_region: 'Nord Italia',
  is_active: true,
  assignment_count: '3',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

const STATS_ROW = {
  total: '12',
  active: '10',
  job_levels: '4',
  job_families: '6',
  avg_min_salary: '38000',
  avg_max_salary: '62000',
  avg_range_spread: '35.5',
};

describe('Salary Bands Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
  });

  // =========================================================================
  // AUTH
  // =========================================================================
  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      const res = await supertest(app).get('/api/v1/salary-bands');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await supertest(app)
        .get('/api/v1/salary-bands')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /salary-bands/stats
  // =========================================================================
  describe('GET /salary-bands/stats', () => {
    it('should return salary band statistics', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [STATS_ROW], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('active');
      expect(res.body.data).toHaveProperty('job_levels');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await supertest(app)
        .get('/api/v1/salary-bands/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // GET /salary-bands
  // =========================================================================
  describe('GET /salary-bands', () => {
    it('should list salary bands with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [BAND_ROW], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('offset');
    });

    it('should accept filter by job_level', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [BAND_ROW], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands?job_level=Senior')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept filter by job_family', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands?job_family=IT')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should accept filter by is_active', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [BAND_ROW], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands?is_active=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should accept filter by geo_region', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands?geo_region=Nord%20Italia')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // GET /salary-bands/:id
  // =========================================================================
  describe('GET /salary-bands/:id', () => {
    it('should return a single salary band', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [BAND_ROW], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/salary-bands/${BAND_ROW.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.band_name).toBe('Fascia Senior Developer');
    });

    it('should return 404 when band not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/salary-bands/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // POST /salary-bands
  // =========================================================================
  describe('POST /salary-bands', () => {
    const validPayload = {
      band_name: 'Fascia Manager IT',
      band_code: 'SB-MGR-01',
      min_salary: 50000,
      mid_salary: 60000,
      max_salary: 70000,
      job_level: 'Manager',
      job_family: 'IT',
      currency: 'EUR',
    };

    it('should create a salary band with 201', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...BAND_ROW, ...validPayload }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .post('/api/v1/salary-bands')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Salary band created');
    });

    it('should return 400 when band_name is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/salary-bands')
        .set('Authorization', `Bearer ${token}`)
        .send({ min_salary: 50000, max_salary: 70000 });

      // Zod validation or manual check - either 400
      expect(res.status).toBe(400);
    });

    it('should return 400 when min_salary is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/salary-bands')
        .set('Authorization', `Bearer ${token}`)
        .send({ band_name: 'Test', max_salary: 70000 });

      expect(res.status).toBe(400);
    });

    it('should return 500 on database error during create', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await supertest(app)
        .post('/api/v1/salary-bands')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // PATCH /salary-bands/:id
  // =========================================================================
  describe('PATCH /salary-bands/:id', () => {
    it('should update a salary band', async () => {
      // exists check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: BAND_ROW.id }], rowCount: 1 });
      // update
      mockQuery.mockResolvedValueOnce({
        rows: [{ ...BAND_ROW, band_name: 'Fascia Aggiornata' }],
        rowCount: 1,
      });

      const res = await supertest(app)
        .patch(`/api/v1/salary-bands/${BAND_ROW.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ band_name: 'Fascia Aggiornata' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Salary band updated');
    });

    it('should return 404 when band not found for update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch('/api/v1/salary-bands/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ band_name: 'Non esiste' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 when no fields provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: BAND_ROW.id }], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/salary-bands/${BAND_ROW.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // DELETE /salary-bands/:id
  // =========================================================================
  describe('DELETE /salary-bands/:id', () => {
    it('should soft-delete (deactivate) a salary band', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: BAND_ROW.id }], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/salary-bands/${BAND_ROW.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Salary band deactivated');
    });

    it('should return 404 when band not found for delete', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete('/api/v1/salary-bands/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
