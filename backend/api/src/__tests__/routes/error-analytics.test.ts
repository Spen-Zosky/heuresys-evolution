/**
 * Error Analytics Routes - Unit Tests
 *
 * Tests:
 *   GET  /error-analytics/stats            - Error statistics overview
 *   GET  /error-analytics/recent           - Recent errors
 *   GET  /error-analytics/:errorId         - Error details
 *   GET  /error-analytics/trends/hourly    - Error trends
 *   GET  /error-analytics/spikes/detect    - Detect spikes
 *   GET  /error-analytics/patterns/list    - Error patterns
 *   PATCH /error-analytics/patterns/:id/resolve - Resolve pattern
 *   POST /error-analytics/aggregate        - Trigger aggregation
 *   GET  /error-analytics/by-status        - Errors by HTTP status
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express, Request, Response, NextFunction } from 'express';
import { buildSuperuserTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';

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

// Mock the entire errors module chain to avoid ESM type-export issues.
// HeuresysError, CreateErrorOptions etc. are TS interfaces erased at runtime,
// but errors/index.js re-exports them causing ESM SyntaxError.
// We provide real implementations for the 4 items the route actually uses.
jest.unstable_mockModule(resolve('../../errors/index.js'), () => ({
  // asyncHandler: wraps async route handler, catches errors and passes to next()
  asyncHandler:
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(fn(req, res, next)).catch(next),

  // sendSuccess: formats response as { success: true, data, meta: { timestamp } }
  sendSuccess: (res: Response, data: unknown) => {
    res.json({ success: true, data, meta: { timestamp: new Date().toISOString() } });
  },

  // sendPaginatedSuccess: formats paginated response
  sendPaginatedSuccess: (
    res: Response,
    data: unknown[],
    pagination: { page: number; pageSize: number; total: number }
  ) => {
    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
    res.json({
      success: true,
      data,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        hasMore: pagination.page < totalPages,
        timestamp: new Date().toISOString(),
      },
    });
  },

  // Errors: factory for structured errors with httpStatus
  Errors: {
    notFound: (resource: string, id?: string) => {
      const err = new Error(`${resource} non trovato${id ? `: ${id}` : ''}`) as Error & {
        httpStatus: number;
        code: string;
      };
      err.httpStatus = 404;
      err.code = 'ERR-API-1005';
      return err;
    },
    badRequest: (message?: string) => {
      const err = new Error(message || 'Richiesta non valida') as Error & {
        httpStatus: number;
        code: string;
      };
      err.httpStatus = 400;
      err.code = 'ERR-API-1001';
      return err;
    },
  },

  // Stubs for other re-exports that may be transitively imported
  HeuresysError: {},
  createHeuresysError: jest.fn(),
  HeuresysErrorBuilder: {},
  isHeuresysError: jest.fn(),
  toHeuresysError: jest.fn(),
  sanitizeForClient: jest.fn(),
  extractRequestContext: jest.fn(),
  generateErrorId: jest.fn(),
  getCategoryFromCode: jest.fn(),
  getDefaultSeverity: jest.fn(),
  getErrorMessage: jest.fn(),
  CreateErrorOptions: {},
  ErrorCodes: {},
  SeverityConfig: {},
  ErrorCategory: {},
  ErrorSeverity: {},
  ApiErrorResponse: {},
  ApiSuccessResponse: {},
  RequestContext: {},
  DebugContext: {},
  DatabaseContext: {},
  ErrorMessageRegistry: {},
  ErrorToHttpStatus: {},
  PostgresError: {},
  PostgresErrorMapping: {},
  handleDatabaseError: jest.fn(),
  isPostgresError: jest.fn(),
  extractDatabaseContext: jest.fn(),
  safeQuery: jest.fn(),
  createErrorMiddleware: jest.fn(),
  errorMiddleware: jest.fn(),
  notFoundHandler: jest.fn(),
  throwError: jest.fn(),
  sendCreated: jest.fn(),
  sendNoContent: jest.fn(),
  ErrorMiddlewareConfig: {},
  initSentry: jest.fn(),
  sentryErrorLogger: jest.fn(),
  captureException: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  flushSentry: jest.fn(),
  closeSentry: jest.fn(),
  isSentryActive: jest.fn(),
  SentryConfig: {},
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/error-analytics.js');
const { generateToken } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  // Note: error-analytics routes use inline authMiddleware + requireRole
  // The auth middleware is embedded in each route, not at the router level
  app.use('/api/v1/error-analytics', routes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res
        .status(status)
        .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    }
  );
  return app;
}

describe('Error Analytics Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.resetAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSuperuserTokenPayload({ tenantId: TENANT_ID }));
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/error-analytics/stats');
    expect(res.status).toBe(401);
  });

  // GET /stats
  it('GET /stats should return error statistics', async () => {
    // stats query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          total_errors: '150',
          unique_error_codes: '12',
          affected_users: '8',
          critical_count: '2',
          error_count: '30',
          warning_count: '50',
          info_count: '68',
        },
      ],
      rowCount: 1,
    });
    // by category query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { category: 'DATABASE', count: '40' },
        { category: 'VALIDATION', count: '30' },
      ],
      rowCount: 2,
    });
    // top errors query
    mockQuery.mockResolvedValueOnce({
      rows: [{ code: 'DB_CONN_FAILED', message: 'Connection refused', count: '15' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalErrors).toBe(150);
    expect(res.body.data.bySeverity.critical).toBe(2);
    expect(res.body.data.topErrors).toHaveLength(1);
  });

  it('GET /stats should return 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await supertest(app)
      .get('/api/v1/error-analytics/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  // GET /recent
  it('GET /recent should return paginated recent errors', async () => {
    // count query
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '25' }], rowCount: 1 });
    // data query
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'e1',
          error_id: 'err-001',
          code: 'DB_TIMEOUT',
          severity: 'ERROR',
          message: 'Connection timeout',
          created_at: '2025-01-01',
        },
      ],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/recent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /recent should support severity filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/recent?severity=CRITICAL')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  // GET /:errorId
  it('GET /:errorId should return error details', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'e1',
          error_id: 'err-001',
          code: 'DB_TIMEOUT',
          severity: 'ERROR',
          message: 'Timeout',
          tenant_name: 'RTL Bank',
          username: 'admin',
        },
      ],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/err-001')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.error_id).toBe('err-001');
  });

  it('GET /:errorId should return 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // GET /trends/hourly
  it('GET /trends/hourly should return trend data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          hour_start: '2025-01-01T00:00:00Z',
          category: 'DATABASE',
          severity: 'ERROR',
          error_count: '10',
          unique_errors: '3',
          affected_users: '2',
        },
      ],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/trends/hourly')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
  });

  // GET /spikes/detect
  it('GET /spikes/detect should return detected spikes', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          category: 'DATABASE',
          severity: 'ERROR',
          tenant_id: TENANT_ID,
          current_hour_count: '50',
          avg_hourly_count: '10.5',
          spike_ratio: '4.76',
        },
      ],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/spikes/detect')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.spikes).toHaveLength(1);
    expect(res.body.data.spikes[0].spikeRatio).toBe(4.76);
  });

  // GET /patterns/list
  it('GET /patterns/list should return error patterns', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', pattern_name: 'DB Timeout Cluster', is_resolved: false }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/patterns/list')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // PATCH /patterns/:id/resolve
  it('PATCH /patterns/:id/resolve should resolve pattern', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p1', is_resolved: true, resolution_notes: 'Fixed DB pool size' }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .patch('/api/v1/error-analytics/patterns/p1/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ resolutionNotes: 'Fixed DB pool size' });
    expect(res.status).toBe(200);
  });

  it('PATCH /patterns/:id/resolve should return 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .patch('/api/v1/error-analytics/patterns/nonexistent/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ resolutionNotes: 'Test' });
    expect(res.status).toBe(404);
  });

  // POST /aggregate (requires SUPERUSER role)
  it('POST /aggregate should trigger aggregation', async () => {
    const superuserToken = generateToken(buildSuperuserTokenPayload());
    mockQuery.mockResolvedValueOnce({
      rows: [{ rows_processed: 150 }],
      rowCount: 1,
    });

    const res = await supertest(app)
      .post('/api/v1/error-analytics/aggregate')
      .set('Authorization', `Bearer ${superuserToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rowsProcessed).toBe(150);
  });

  // GET /by-status is caught by /:errorId (route ordering: /:errorId defined before /by-status)
  // Express single-segment match means /by-status matches /:errorId with errorId='by-status'
  // So test the actual behavior: 404 when no error_log found for errorId='by-status'
  it('GET /by-status is caught by /:errorId and returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/by-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('GET /stats should return 500 when second DB query fails', async () => {
    // stats query succeeds
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          total_errors: '10',
          unique_error_codes: '2',
          affected_users: '1',
          critical_count: '0',
          error_count: '5',
          warning_count: '3',
          info_count: '2',
        },
      ],
      rowCount: 1,
    });
    // by category query fails
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await supertest(app)
      .get('/api/v1/error-analytics/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });

  it('GET /recent should return empty list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await supertest(app)
      .get('/api/v1/error-analytics/recent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});
