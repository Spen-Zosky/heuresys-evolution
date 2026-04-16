/**
 * Wellbeing Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for wellbeing check-in endpoints.
 * All external dependencies (database, redis) are mocked.
 *
 * Endpoints tested:
 *  GET    /wellbeing/stats               - Aggregated wellbeing statistics
 *  GET    /wellbeing/trends              - Trends over time
 *  GET    /wellbeing/checkins            - List check-ins with filters
 *  GET    /wellbeing/checkins/:id        - Single check-in detail
 *  GET    /wellbeing/employee/:employeeId - Employee wellbeing history
 *  POST   /wellbeing/checkins            - Create a check-in
 *  PATCH  /wellbeing/checkins/:id        - Update a check-in
 *  DELETE /wellbeing/checkins/:id        - Delete a check-in
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: wellbeingRoutes } = await import('../../routes/wellbeing.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const CHECKIN_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/wellbeing', authMiddleware);
  app.use('/api/v1/wellbeing', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/wellbeing', wellbeingRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        code: err.code,
      });
    }
  );
  return app;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function buildCheckin(overrides: Record<string, unknown> = {}) {
  return {
    id: CHECKIN_ID,
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    checkin_date: '2026-02-25',
    mood_score: 7,
    energy_level: 6,
    stress_level: 4,
    work_life_balance: 8,
    sleep_quality: 7,
    notes: 'Feeling good today',
    is_anonymous: false,
    employee_name: 'Mario Rossi',
    created_at: '2026-02-25T09:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Wellbeing Routes - Behavioral Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
  });

  // =========================================================================
  // Auth enforcement
  // =========================================================================
  describe('Authentication Enforcement', () => {
    it('should return 401 for GET /wellbeing/stats without auth token', async () => {
      const res = await supertest(app).get('/api/v1/wellbeing/stats').set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });

    it('should return 401 for GET /wellbeing/checkins without auth token', async () => {
      const res = await supertest(app)
        .get('/api/v1/wellbeing/checkins')
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /wellbeing/checkins without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, mood_score: 7 });

      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /wellbeing/checkins/:id without auth token', async () => {
      const res = await supertest(app)
        .delete(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /wellbeing/stats
  // =========================================================================
  describe('GET /wellbeing/stats', () => {
    it('should return aggregated wellbeing statistics', async () => {
      const token = createSysadminToken();

      const statsRow = {
        total_checkins: '150',
        unique_employees: '42',
        avg_mood: '7.25',
        avg_energy: '6.80',
        avg_stress: '4.10',
        avg_work_life_balance: '7.00',
        avg_sleep_quality: '6.50',
      };
      const trendsRow = {
        last_7d: '25',
        last_30d: '80',
        mood_7d: '7.50',
        mood_30d: '7.10',
      };

      // Query 1: stats aggregation
      mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 } as never);
      // Query 2: trends aggregation
      mockQuery.mockResolvedValueOnce({ rows: [trendsRow], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/stats')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Stats fields
      expect(res.body.data).toHaveProperty('total_checkins', '150');
      expect(res.body.data).toHaveProperty('unique_employees', '42');
      expect(res.body.data).toHaveProperty('avg_mood', '7.25');
      expect(res.body.data).toHaveProperty('avg_energy', '6.80');
      expect(res.body.data).toHaveProperty('avg_stress', '4.10');
      expect(res.body.data).toHaveProperty('avg_work_life_balance', '7.00');
      expect(res.body.data).toHaveProperty('avg_sleep_quality', '6.50');
      // Trends fields merged into same data object
      expect(res.body.data).toHaveProperty('last_7d', '25');
      expect(res.body.data).toHaveProperty('last_30d', '80');
      expect(res.body.data).toHaveProperty('mood_7d', '7.50');
      expect(res.body.data).toHaveProperty('mood_30d', '7.10');
    });

    it('should return zeroed stats when no check-ins exist', async () => {
      const token = createSysadminToken();

      const emptyStats = {
        total_checkins: '0',
        unique_employees: '0',
        avg_mood: null,
        avg_energy: null,
        avg_stress: null,
        avg_work_life_balance: null,
        avg_sleep_quality: null,
      };
      const emptyTrends = {
        last_7d: '0',
        last_30d: '0',
        mood_7d: null,
        mood_30d: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [emptyStats], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [emptyTrends], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/stats')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_checkins).toBe('0');
      expect(res.body.data.avg_mood).toBeNull();
    });

    it('should return 500 when database query fails', async () => {
      const token = createSysadminToken();

      mockQuery.mockRejectedValueOnce(new Error('Connection lost') as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/stats')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // GET /wellbeing/trends
  // =========================================================================
  describe('GET /wellbeing/trends', () => {
    it('should return daily trends with default 30 days', async () => {
      const token = createSysadminToken();

      const trendRows = [
        {
          checkin_date: '2026-02-25',
          checkins: '5',
          avg_mood: '7.00',
          avg_energy: '6.50',
          avg_stress: '4.00',
        },
        {
          checkin_date: '2026-02-24',
          checkins: '8',
          avg_mood: '6.80',
          avg_energy: '6.20',
          avg_stress: '5.00',
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: trendRows, rowCount: 2 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/trends')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('checkin_date', '2026-02-25');
      expect(res.body.data[0]).toHaveProperty('checkins', '5');
      expect(res.body.data[0]).toHaveProperty('avg_mood', '7.00');
      expect(res.body.data[1]).toHaveProperty('checkin_date', '2026-02-24');
    });

    it('should accept custom days parameter', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/trends?days=7')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);

      // Verify that the days param was passed to the query
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall![1]).toContain(7); // parseInt('7') = 7
    });

    it('should return empty array when no trends data', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/trends')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // =========================================================================
  // GET /wellbeing/checkins - List with filters
  // =========================================================================
  describe('GET /wellbeing/checkins', () => {
    it('should return paginated list of check-ins', async () => {
      const token = createSysadminToken();

      const checkin1 = buildCheckin({ id: 'checkin-1', mood_score: 8 });
      const checkin2 = buildCheckin({
        id: 'checkin-2',
        mood_score: 5,
        employee_name: 'Lucia Bianchi',
      });

      // List query
      mockQuery.mockResolvedValueOnce({ rows: [checkin1, checkin2], rowCount: 2 } as never);
      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '12' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('id', 'checkin-1');
      expect(res.body.data[0]).toHaveProperty('mood_score', 8);
      expect(res.body.data[0]).toHaveProperty('employee_name', 'Mario Rossi');
      expect(res.body.data[1]).toHaveProperty('employee_name', 'Lucia Bianchi');
      // Meta with pagination
      expect(res.body.meta).toHaveProperty('total', 12);
      expect(res.body.meta).toHaveProperty('limit', 100);
      expect(res.body.meta).toHaveProperty('offset', 0);
    });

    it('should return empty list when no check-ins found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should filter by employee_id', async () => {
      const token = createSysadminToken();

      const checkin = buildCheckin();

      mockQuery.mockResolvedValueOnce({ rows: [checkin], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/checkins?employee_id=${EMPLOYEE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      // Verify employee_id filter was included in query params
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall![1]).toContain(EMPLOYEE_ID);
    });

    it('should filter by date range', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/checkins?from_date=2026-02-01&to_date=2026-02-28')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);

      // Verify date params were included in query
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall![1]).toContain('2026-02-01');
      expect(queryCall![1]).toContain('2026-02-28');
    });

    it('should filter by is_anonymous', async () => {
      const token = createSysadminToken();

      const anonCheckin = buildCheckin({ is_anonymous: true, employee_name: 'Anonymous' });

      mockQuery.mockResolvedValueOnce({ rows: [anonCheckin], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/checkins?is_anonymous=true')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toHaveProperty('employee_name', 'Anonymous');

      // Verify boolean conversion: is_anonymous === 'true' -> true
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall![1]).toContain(true);
    });

    it('should respect custom limit and offset', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [buildCheckin()], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '50' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/wellbeing/checkins?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('limit', 10);
      expect(res.body.meta).toHaveProperty('offset', 20);
      expect(res.body.meta).toHaveProperty('total', 50);
    });
  });

  // =========================================================================
  // GET /wellbeing/checkins/:id - Single check-in
  // =========================================================================
  describe('GET /wellbeing/checkins/:id', () => {
    it('should return check-in detail for valid ID', async () => {
      const token = createSysadminToken();

      const checkin = buildCheckin();

      mockQuery.mockResolvedValueOnce({ rows: [checkin], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', CHECKIN_ID);
      expect(res.body.data).toHaveProperty('employee_id', EMPLOYEE_ID);
      expect(res.body.data).toHaveProperty('mood_score', 7);
      expect(res.body.data).toHaveProperty('energy_level', 6);
      expect(res.body.data).toHaveProperty('stress_level', 4);
      expect(res.body.data).toHaveProperty('work_life_balance', 8);
      expect(res.body.data).toHaveProperty('sleep_quality', 7);
      expect(res.body.data).toHaveProperty('employee_name', 'Mario Rossi');
      expect(res.body.data).toHaveProperty('notes', 'Feeling good today');
    });

    it('should return 404 when check-in not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 500 when database query fails', async () => {
      const token = createSysadminToken();

      mockQuery.mockRejectedValueOnce(new Error('DB timeout') as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // GET /wellbeing/employee/:employeeId - Employee history
  // =========================================================================
  describe('GET /wellbeing/employee/:employeeId', () => {
    it('should return employee wellbeing history with averages', async () => {
      const token = createSysadminToken();

      const checkins = [
        buildCheckin({ checkin_date: '2026-02-25', mood_score: 8 }),
        buildCheckin({ checkin_date: '2026-02-24', mood_score: 6 }),
        buildCheckin({ checkin_date: '2026-02-23', mood_score: 7 }),
      ];
      const averagesRow = {
        avg_mood: '7.00',
        avg_energy: '6.50',
        avg_stress: '4.20',
        avg_work_life_balance: '7.50',
      };

      // Query 1: recent checkins
      mockQuery.mockResolvedValueOnce({ rows: checkins, rowCount: 3 } as never);
      // Query 2: averages
      mockQuery.mockResolvedValueOnce({ rows: [averagesRow], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/employee/${EMPLOYEE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('checkins');
      expect(res.body.data).toHaveProperty('averages');
      expect(res.body.data.checkins).toHaveLength(3);
      expect(res.body.data.checkins[0]).toHaveProperty('mood_score', 8);
      expect(res.body.data.averages).toHaveProperty('avg_mood', '7.00');
      expect(res.body.data.averages).toHaveProperty('avg_energy', '6.50');
      expect(res.body.data.averages).toHaveProperty('avg_stress', '4.20');
      expect(res.body.data.averages).toHaveProperty('avg_work_life_balance', '7.50');
    });

    it('should return empty history for employee with no check-ins', async () => {
      const token = createSysadminToken();

      const emptyAverages = {
        avg_mood: null,
        avg_energy: null,
        avg_stress: null,
        avg_work_life_balance: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [emptyAverages], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/employee/${EMPLOYEE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data.checkins).toHaveLength(0);
      expect(res.body.data.averages.avg_mood).toBeNull();
    });

    it('should respect custom limit parameter', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [buildCheckin()], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            avg_mood: '7.00',
            avg_energy: '6.00',
            avg_stress: '4.00',
            avg_work_life_balance: '7.00',
          },
        ],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .get(`/api/v1/wellbeing/employee/${EMPLOYEE_ID}?limit=5`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);

      // Verify limit 5 was passed to the query (parseInt('5') = 5)
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall![1]).toContain(5);
    });
  });

  // =========================================================================
  // POST /wellbeing/checkins - Create check-in
  // =========================================================================
  describe('POST /wellbeing/checkins', () => {
    it('should create check-in successfully with valid data', async () => {
      const token = createSysadminToken();

      const newCheckin = buildCheckin({ id: 'new-checkin-id' });

      // Duplicate check - no existing today
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // INSERT RETURNING *
      mockQuery.mockResolvedValueOnce({ rows: [newCheckin], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({
          employee_id: EMPLOYEE_ID,
          mood_score: 7,
          energy_level: 6,
          stress_level: 4,
          work_life_balance: 8,
          sleep_quality: 7,
          notes: 'Feeling good today',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', 'new-checkin-id');
      expect(res.body.data).toHaveProperty('mood_score', 7);
      expect(res.body.data).toHaveProperty('employee_id', EMPLOYEE_ID);
      expect(res.body.message).toBe('Check-in created');
    });

    it('should create check-in with only required fields', async () => {
      const token = createSysadminToken();

      const minimalCheckin = buildCheckin({
        mood_score: null,
        energy_level: null,
        stress_level: null,
        work_life_balance: null,
        sleep_quality: null,
        notes: null,
      });

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [minimalCheckin], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should create anonymous check-in', async () => {
      const token = createSysadminToken();

      const anonCheckin = buildCheckin({ is_anonymous: true });

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [anonCheckin], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({
          employee_id: EMPLOYEE_ID,
          mood_score: 5,
          is_anonymous: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('is_anonymous', true);
    });

    it('should return 409 when check-in already exists today', async () => {
      const token = createSysadminToken();

      // Duplicate check - existing found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-checkin-id' }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, mood_score: 7 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Check-in already exists for today');
    });

    it('should return 400 when employee_id is missing from body', async () => {
      const token = createSysadminToken();

      // Zod validation requires employee_id as uuid
      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ mood_score: 7 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when employee_id is not a valid UUID', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: 'not-a-uuid', mood_score: 7 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'employee_id', message: 'Invalid employee ID' }),
        ])
      );
    });

    it('should return 400 when mood_score is out of range (>10)', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, mood_score: 15 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when mood_score is out of range (<1)', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, mood_score: 0 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 500 when INSERT query fails', async () => {
      const token = createSysadminToken();

      // Duplicate check passes
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      // INSERT fails
      mockQuery.mockRejectedValueOnce(new Error('Insert failed') as never);

      const res = await supertest(app)
        .post('/api/v1/wellbeing/checkins')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, mood_score: 7 });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // PATCH /wellbeing/checkins/:id - Update check-in
  // =========================================================================
  describe('PATCH /wellbeing/checkins/:id', () => {
    it('should update check-in successfully', async () => {
      const token = createSysadminToken();

      const updatedCheckin = buildCheckin({ mood_score: 9, notes: 'Updated notes' });

      // Existence check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: CHECKIN_ID }], rowCount: 1 } as never);
      // UPDATE RETURNING *
      mockQuery.mockResolvedValueOnce({ rows: [updatedCheckin], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ mood_score: 9, notes: 'Updated notes' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('mood_score', 9);
      expect(res.body.data).toHaveProperty('notes', 'Updated notes');
      expect(res.body.message).toBe('Check-in updated');
    });

    it('should update a single field', async () => {
      const token = createSysadminToken();

      const updatedCheckin = buildCheckin({ stress_level: 2 });

      mockQuery.mockResolvedValueOnce({ rows: [{ id: CHECKIN_ID }], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [updatedCheckin], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ stress_level: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('stress_level', 2);
    });

    it('should return 404 when check-in not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ mood_score: 9 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when no updatable fields provided', async () => {
      const token = createSysadminToken();

      // Existence check passes
      mockQuery.mockResolvedValueOnce({ rows: [{ id: CHECKIN_ID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ unknown_field: 'value' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No fields to update');
    });

    it('should return 400 when sending empty body', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: CHECKIN_ID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No fields to update');
    });

    it('should return 400 when score is out of range', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ mood_score: 99 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 500 when UPDATE query fails', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [{ id: CHECKIN_ID }], rowCount: 1 } as never);
      mockQuery.mockRejectedValueOnce(new Error('Update failed') as never);

      const res = await supertest(app)
        .patch(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ mood_score: 8 });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // DELETE /wellbeing/checkins/:id
  // =========================================================================
  describe('DELETE /wellbeing/checkins/:id', () => {
    it('should delete check-in successfully', async () => {
      const token = createSysadminToken();

      // DELETE RETURNING id
      mockQuery.mockResolvedValueOnce({ rows: [{ id: CHECKIN_ID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Check-in deleted');
    });

    it('should return 404 when check-in not found for deletion', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 500 when DELETE query fails', async () => {
      const token = createSysadminToken();

      mockQuery.mockRejectedValueOnce(new Error('Delete failed') as never);

      const res = await supertest(app)
        .delete(`/api/v1/wellbeing/checkins/${CHECKIN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(500);
    });
  });
});
