/**
 * Time Analytics Routes - Behavioral Tests
 * Note: Uses req.dbClient for queries, getTenantIdOrThrow for tenant context.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest
  .fn()
  .mockResolvedValue({ query: mockClientQuery, release: mockClientRelease } as never);

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
const { default: timeAnalyticsRoutes } = await import('../../routes/time-analytics.js');
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
  app.use('/api/v1/time-analytics', authMiddleware);
  app.use('/api/v1/time-analytics', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    (req as any).dbClient = { query: mockQuery, release: jest.fn() };
    next();
  });
  app.use('/api/v1/time-analytics', timeAnalyticsRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res
        .status(err.statusCode || err.httpStatus || 500)
        .json({ success: false, error: err.message || 'Internal Server Error' });
    }
  );
  return app;
}

function tok(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('Time Analytics Routes', () => {
  let app: Express;
  let token: string;
  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = tok();
  });

  describe('Auth', () => {
    it('should return 401 without token', async () => {
      expect((await supertest(app).get('/api/v1/time-analytics/dashboard')).status).toBe(401);
    });
  });

  describe('GET /time-analytics/dashboard', () => {
    it('should return dashboard metrics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              active_employees: '50',
              total_records: '1000',
              avg_hours_per_day: '7.50',
              total_regular_hours: '6000',
              total_overtime_hours: '500',
              total_night_hours: '100',
              total_holiday_hours: '50',
              present_count: '800',
              absent_count: '100',
              late_count: '50',
              remote_count: '50',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              department: 'IT',
              employees: '20',
              total_days: '400',
              present_days: '380',
              attendance_rate: '95.0',
              avg_hours: '8.10',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              week_start: '2026-02-02',
              employees: '50',
              avg_hours: '7.80',
              overtime_hours: '60',
              late_count: '5',
            },
          ],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.by_org_unit).toHaveLength(1);
      expect(res.body.data.weekly_trends).toHaveLength(1);
    });

    it('should return 500 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app)
        .get('/api/v1/time-analytics/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });

  describe('GET /time-analytics/attendance-patterns', () => {
    it('should return attendance patterns', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              day_of_week: '1',
              day_name: 'Monday',
              total_records: '200',
              late_count: '10',
              late_percentage: '5.0',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ status: 'present', count: '800', percentage: '80.0' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              employee_name: 'Mario Rossi',
              department: 'IT',
              late_count: '5',
              total_days: '20',
              late_percentage: '25.0',
            },
          ],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/attendance-patterns')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.by_day_of_week).toHaveLength(1);
      expect(res.body.data.status_distribution).toHaveLength(1);
      expect(res.body.data.frequent_late).toHaveLength(1);
    });

    it('should support period filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/attendance-patterns?period=60')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.period_days).toBe(60);
    });
  });

  describe('GET /time-analytics/overtime', () => {
    it('should return overtime analytics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              total_overtime: '500',
              avg_overtime_per_record: '2.50',
              employees_with_overtime: '30',
              total_employees: '50',
              total_night_hours: '100',
              total_holiday_hours: '50',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              department: 'IT',
              overtime_hours: '200',
              night_hours: '40',
              holiday_hours: '20',
              employees: '15',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { month: '2026-01-01', overtime_hours: '250', night_hours: '50', employees: '30' },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              employee_name: 'Mario Rossi',
              department: 'IT',
              overtime_hours: '40',
              night_hours: '10',
              holiday_hours: '5',
            },
          ],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/overtime')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary.total_overtime).toBe('500');
      expect(res.body.data.by_org_unit).toHaveLength(1);
      expect(res.body.data.monthly_trend).toHaveLength(1);
      expect(res.body.data.top_employees).toHaveLength(1);
    });
  });

  describe('GET /time-analytics/hours-distribution', () => {
    it('should return hours distribution', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ hours_bucket: '8-9h (Standard)', count: '500', avg_hours: '8.30' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              department: 'IT',
              avg_hours: '8.20',
              min_hours: '4.00',
              max_hours: '10.50',
              records: '400',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ source: 'terminal', records: '800', avg_hours: '8.10' }],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/hours-distribution')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.distribution).toHaveLength(1);
      expect(res.body.data.by_org_unit).toHaveLength(1);
      expect(res.body.data.by_source).toHaveLength(1);
    });
  });

  describe('GET /time-analytics/remote-work', () => {
    it('should return remote work analytics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              remote_days: '200',
              onsite_days: '600',
              total_days: '800',
              remote_percentage: '25.0',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { department: 'IT', remote_days: '100', total_days: '200', remote_percentage: '50.0' },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              week_start: '2026-02-02',
              remote_days: '50',
              total_days: '200',
              remote_percentage: '25.0',
            },
          ],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/remote-work')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.overall.remote_percentage).toBe('25.0');
      expect(res.body.data.by_org_unit).toHaveLength(1);
      expect(res.body.data.weekly_trend).toHaveLength(1);
    });
  });

  describe('GET /time-analytics/validation-status', () => {
    it('should return validation status', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ validated: '800', pending: '200', total: '1000', validated_percentage: '80.0' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ department: 'IT', pending_count: '50', oldest_pending: '2026-02-01' }],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/validation-status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary.validated_percentage).toBe('80.0');
      expect(res.body.data.pending_by_org_unit).toHaveLength(1);
    });
  });

  describe('GET /time-analytics/absenteeism', () => {
    it('should return absenteeism analytics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              month: '2026-01-01',
              total_employees: '50',
              total_records: '1000',
              absent_count: '50',
              absence_rate: '5.00',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { department: 'IT', total_records: '200', absent_count: '10', absence_rate: '5.00' },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              employee_name: 'Mario Rossi',
              department: 'IT',
              absent_days: '5',
              total_days: '20',
              absence_rate: '25.0',
            },
          ],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/time-analytics/absenteeism')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.monthly_trend).toHaveLength(1);
      expect(res.body.data.by_org_unit).toHaveLength(1);
      expect(res.body.data.high_absentees).toHaveLength(1);
    });

    it('should return 500 on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app)
        .get('/api/v1/time-analytics/absenteeism')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });
});
