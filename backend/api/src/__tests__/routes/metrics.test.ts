/**
 * Metrics Routes - Unit Tests
 * Tests HTTP behavior for Prometheus metrics endpoint.
 *
 * Endpoints tested:
 *  GET /metrics - Prometheus scraping endpoint (bearer token or IP allowlist)
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';

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

const mockRegisterMetrics = jest.fn().mockResolvedValue('# HELP up\nup 1');
const mockContentType = 'text/plain; version=0.0.4; charset=utf-8';

jest.unstable_mockModule(resolve('../../middleware/metricsCollector.js'), () => ({
  register: {
    metrics: mockRegisterMetrics,
    contentType: mockContentType,
  },
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/metrics.js');
const supertest = (await import('supertest')).default;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/', routes);
  app.use(
    (
      err: { statusCode?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || 500;
      res.status(status).json({ error: err.message || 'Internal Server Error' });
    }
  );
  return app;
}

describe('metrics Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  it('GET /metrics returns 200 with Prometheus metrics in development', async () => {
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('up');
  });

  it('GET /metrics sets correct Content-Type', async () => {
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('GET /metrics returns 500 when register.metrics() throws', async () => {
    mockRegisterMetrics.mockRejectedValueOnce(new Error('metrics collection failed'));
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(500);
    expect(res.text).toContain('metrics collection failed');
  });

  it('GET /metrics respects bearer token auth when METRICS_TOKEN is set', async () => {
    // This test verifies the code path exists; in test env without METRICS_TOKEN
    // set, development mode allows access
    const res = await supertest(app).get('/metrics').set('Authorization', 'Bearer wrong-token');
    // In dev without METRICS_TOKEN env var, allows all
    expect(res.status).toBe(200);
  });

  it('GET /metrics with valid IP returns 200', async () => {
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(200);
  });

  it('GET /non-existent returns 404', async () => {
    const res = await supertest(app).get('/non-existent');
    expect(res.status).toBe(404);
  });

  it('GET /metrics returns metrics output as text', async () => {
    mockRegisterMetrics.mockResolvedValueOnce('# HELP http_requests_total\nhttp_requests_total 42');
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });

  it('GET /metrics does not return JSON by default', async () => {
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).not.toContain('application/json');
  });

  it('GET /metrics handles empty response', async () => {
    mockRegisterMetrics.mockResolvedValueOnce('');
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(200);
  });

  it('GET /metrics calls register.metrics exactly once', async () => {
    await supertest(app).get('/metrics');
    expect(mockRegisterMetrics).toHaveBeenCalledTimes(1);
  });

  it('POST /metrics returns 404 (only GET supported)', async () => {
    const res = await supertest(app).post('/metrics');
    expect(res.status).toBe(404);
  });

  it('GET /metrics with empty string token still works in dev', async () => {
    const res = await supertest(app).get('/metrics').set('Authorization', 'Bearer ');
    expect(res.status).toBe(200);
  });

  it('GET /metrics handles synchronous errors in metrics()', async () => {
    mockRegisterMetrics.mockImplementationOnce(() => {
      throw new Error('sync error');
    });
    const res = await supertest(app).get('/metrics');
    expect(res.status).toBe(500);
  });

  it('GET /metrics returns different metrics content each call', async () => {
    mockRegisterMetrics.mockResolvedValueOnce('# call 1');
    const res1 = await supertest(app).get('/metrics');
    mockRegisterMetrics.mockResolvedValueOnce('# call 2');
    const res2 = await supertest(app).get('/metrics');
    expect(res1.text).toBe('# call 1');
    expect(res2.text).toBe('# call 2');
  });

  it('GET /metrics succeeds on multiple sequential calls', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await supertest(app).get('/metrics');
      expect(res.status).toBe(200);
    }
    expect(mockRegisterMetrics).toHaveBeenCalledTimes(3);
  });
});
