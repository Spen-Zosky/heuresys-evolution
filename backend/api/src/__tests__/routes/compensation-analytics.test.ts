/**
 * Compensation Analytics Routes - Unit Tests
 *
 * Tests:
 *   GET /pay-equity          - Gender & department pay equity analysis
 *   GET /salary-bands        - Salary band compliance & distribution
 *   GET /compa-ratio         - Compa-ratio distribution (with optional dept filter)
 *   GET /bonus-distribution  - Bonus allocation analysis by year
 *   GET /total-rewards       - Total rewards breakdown
 *   GET /year-over-year      - YoY compensation comparison
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
const { default: routes } = await import('../../routes/compensation-analytics.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/compensation-analytics', authMiddleware);
  app.use('/api/v1/compensation-analytics', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    (req as any).dbClient = { query: mockQuery, release: jest.fn() };
    next();
  });
  app.use('/api/v1/compensation-analytics', routes);
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

describe('compensation-analytics Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // =========================================================================
  // AUTH
  // =========================================================================

  it('should return 401 without auth token for /pay-equity', async () => {
    const res = await supertest(app).get('/api/v1/compensation-analytics/pay-equity');
    expect(res.status).toBe(401);
  });

  it('should return 401 without auth token for /salary-bands', async () => {
    const res = await supertest(app).get('/api/v1/compensation-analytics/salary-bands');
    expect(res.status).toBe(401);
  });

  // =========================================================================
  // GET /pay-equity
  // =========================================================================

  it('GET /pay-equity should return 200 with pay equity data', async () => {
    // genderEquity query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          gender: 'Male',
          employee_count: '50',
          avg_salary: '60000',
          median_salary: '58000',
          min_salary: '40000',
          max_salary: '90000',
        },
        {
          gender: 'Female',
          employee_count: '45',
          avg_salary: '57000',
          median_salary: '55000',
          min_salary: '38000',
          max_salary: '85000',
        },
      ],
      rowCount: 2,
    });
    // overallMedian query
    mockQuery.mockResolvedValueOnce({
      rows: [{ median_salary: '57000' }],
      rowCount: 1,
    });
    // departmentEquity query
    mockQuery.mockResolvedValueOnce({
      rows: [{ department_name: 'IT', gender: 'Male', employee_count: '10', avg_salary: '65000' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/pay-equity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toHaveProperty('pay_gap_percent');
    expect(res.body.data.summary).toHaveProperty('overall_median');
    expect(res.body.data.by_gender).toHaveLength(2);
    expect(res.body.data.by_org_unit_gender).toHaveLength(1);
  });

  it('GET /pay-equity should return 200 with empty data when no employees have salary', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [{ median_salary: null }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/pay-equity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.pay_gap_percent).toBe(0);
    expect(res.body.data.by_gender).toHaveLength(0);
  });

  it('GET /pay-equity should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/pay-equity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // GET /salary-bands
  // =========================================================================

  it('GET /salary-bands should return 200 with band data', async () => {
    // bands query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'band-1',
          band_code: 'B1',
          band_name: 'Junior',
          job_level: 'L1',
          job_family: 'IT',
          min_salary: '30000',
          mid_salary: '40000',
          max_salary: '50000',
          currency: 'EUR',
          range_spread_percent: '66.7',
        },
      ],
      rowCount: 1,
    });
    // bandAssignments query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          band_id: 'band-1',
          band_code: 'B1',
          band_name: 'Junior',
          employee_count: '15',
          avg_salary: '42000',
          below_min: '1',
          above_max: '2',
          in_range: '12',
        },
      ],
      rowCount: 1,
    });
    // totalCompliance query
    mockQuery.mockResolvedValueOnce({
      rows: [{ total: '15', compliant: '12' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/salary-bands')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.total_bands).toBe(1);
    expect(res.body.data.summary.compliance_rate).toBe(80);
    expect(res.body.data.bands).toHaveLength(1);
    expect(res.body.data.band_distribution).toHaveLength(1);
  });

  it('GET /salary-bands should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/salary-bands')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });

  // =========================================================================
  // GET /compa-ratio
  // =========================================================================

  it('GET /compa-ratio should return 200 with distribution data', async () => {
    // compaRatios query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'e1',
          employee_name: 'Mario Rossi',
          job_title: 'Dev',
          department_name: 'IT',
          salary: '50000',
          mid_salary: '45000',
          compa_ratio: '111.11',
        },
        {
          id: 'e2',
          employee_name: 'Lucia Bianchi',
          job_title: 'Analyst',
          department_name: 'IT',
          salary: '40000',
          mid_salary: '45000',
          compa_ratio: '88.89',
        },
      ],
      rowCount: 2,
    });
    // byDepartment query
    mockQuery.mockResolvedValueOnce({
      rows: [{ department_name: 'IT', employee_count: '2', avg_compa_ratio: '100.00' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/compa-ratio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_employees).toBe(2);
    expect(res.body.data.distribution).toBeDefined();
    expect(res.body.data.by_org_unit).toHaveLength(1);
  });

  it('GET /compa-ratio should accept org_unit_id filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get(`/api/v1/compensation-analytics/compa-ratio?org_unit_id=${DEFAULT_IDS.DEPARTMENT_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Verify the department filter was applied (params include org_unit_id)
    const firstCallArgs = mockQuery.mock.calls[0];
    expect(firstCallArgs![1]).toContain(DEFAULT_IDS.DEPARTMENT_ID);
  });

  it('GET /compa-ratio should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/compa-ratio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });

  // =========================================================================
  // GET /bonus-distribution
  // =========================================================================

  it('GET /bonus-distribution should return 200 with bonus data', async () => {
    // overallStats
    mockQuery.mockResolvedValueOnce({
      rows: [
        { employees_received: '30', total_paid: '150000', avg_bonus: '5000', median_bonus: '4500' },
      ],
      rowCount: 1,
    });
    // byDepartment
    mockQuery.mockResolvedValueOnce({
      rows: [
        { department_name: 'IT', employees_received: '10', total_paid: '60000', avg_bonus: '6000' },
      ],
      rowCount: 1,
    });
    // byPerformance
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          performance_category: 'Exceeds (1.0-1.2x)',
          employee_count: '10',
          avg_multiplier: '1.1',
          total_paid: '60000',
          avg_bonus: '6000',
        },
      ],
      rowCount: 1,
    });
    // plansSummary
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          plan_name: 'Annual Bonus',
          plan_type: 'annual',
          participants: '30',
          total_target: '200000',
          total_actual: '150000',
          avg_multiplier: '0.95',
        },
      ],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/bonus-distribution')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.employees_received).toBe(30);
    expect(res.body.data.by_org_unit).toHaveLength(1);
    expect(res.body.data.by_performance).toHaveLength(1);
    expect(res.body.data.plans).toHaveLength(1);
  });

  it('GET /bonus-distribution should accept year query param', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ employees_received: '0', total_paid: '0', avg_bonus: '0', median_bonus: '0' }],
      rowCount: 1,
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/bonus-distribution?year=2024')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(2024);
  });

  it('GET /bonus-distribution should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/bonus-distribution')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });

  // =========================================================================
  // GET /total-rewards
  // =========================================================================

  it('GET /total-rewards should return 200 with rewards breakdown', async () => {
    // salaryStats
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          total_employees: '100',
          total_salary: '5000000',
          avg_salary: '50000',
          min_salary: '30000',
          max_salary: '90000',
        },
      ],
      rowCount: 1,
    });
    // benefitsStats
    mockQuery.mockResolvedValueOnce({
      rows: [{ employees_with_benefits: '80', total_benefits_cost: '800000' }],
      rowCount: 1,
    });
    // bonusStats
    mockQuery.mockResolvedValueOnce({
      rows: [{ employees_with_bonus: '50', total_bonus: '250000' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/total-rewards')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total_employees).toBe(100);
    expect(res.body.data.breakdown.salary.total).toBe(5000000);
    expect(res.body.data.breakdown.benefits.total).toBe(800000);
    expect(res.body.data.breakdown.bonus.total).toBe(250000);
  });

  it('GET /total-rewards should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/total-rewards')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });

  // =========================================================================
  // GET /year-over-year
  // =========================================================================

  it('GET /year-over-year should return 200 with yearly data', async () => {
    // 3 years of queries (current - 2, current - 1, current)
    const statsRow = { headcount: '100', avg_salary: '50000', total_payroll: '5000000' };
    mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/year-over-year')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.yearly_data).toHaveLength(3);
    expect(res.body.data.year_over_year_changes).toHaveLength(2);
  });

  it('GET /year-over-year should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await supertest(app)
      .get('/api/v1/compensation-analytics/year-over-year')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
  });
});
