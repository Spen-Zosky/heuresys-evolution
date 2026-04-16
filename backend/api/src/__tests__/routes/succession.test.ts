/**
 * Succession Planning Routes - Behavioral Tests
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
const { default: successionRoutes } = await import('../../routes/succession.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const ROLE_ID = '99999999-aaaa-bbbb-cccc-dddddddddddd';
const CANDIDATE_ID = '88888888-aaaa-bbbb-cccc-dddddddddddd';
const EMP_ID = DEFAULT_IDS.EMPLOYEE_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/succession', authMiddleware);
  app.use('/api/v1/succession', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/succession', successionRoutes);
  app.use(
    (
      err: { statusCode?: number; httpStatus?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode || err.httpStatus || 500;
      res.status(status).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  );
  return app;
}

function tok(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

function buildRole(o: Record<string, unknown> = {}) {
  return {
    id: ROLE_ID,
    tenant_id: TENANT_ID,
    role_name: 'CTO',
    department: 'IT',
    criticality_level: 'High',
    succession_status: 'at_risk',
    current_incumbent_name: 'Mario Rossi',
    candidate_count: 2,
    ...o,
  };
}

describe('Succession Routes', () => {
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
      const res = await supertest(app).get('/api/v1/succession/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /succession/stats', () => {
    it('should return stats', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total_critical_roles: '5', departments_covered: '3' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ total_candidates: '10', unique_candidates: '8', roles_with_candidates: '4' }],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get('/api/v1/succession/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total_critical_roles).toBe('5');
    });
  });

  describe('GET /succession/critical-roles', () => {
    it('should return paginated list', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [buildRole()], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      const res = await supertest(app)
        .get('/api/v1/succession/critical-roles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('GET /succession/critical-roles/:id', () => {
    it('should return role with candidates', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [buildRole()], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: CANDIDATE_ID, candidate_name: 'Luca Verdi' }],
          rowCount: 1,
        });
      const res = await supertest(app)
        .get(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.candidates).toHaveLength(1);
    });

    it('should return 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /succession/critical-roles', () => {
    it('should create role (201)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [buildRole()], rowCount: 1 });
      const res = await supertest(app)
        .post('/api/v1/succession/critical-roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ role_name: 'CTO', department: 'IT', criticality_level: 'High' });
      expect(res.status).toBe(201);
    });

    it('should return 400 when role_name missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/succession/critical-roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ department: 'IT' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /succession/critical-roles/:id', () => {
    it('should update role', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: ROLE_ID }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [buildRole({ succession_status: 'covered' })],
          rowCount: 1,
        });
      const res = await supertest(app)
        .patch(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ succession_status: 'covered' });
      expect(res.status).toBe(200);
    });

    it('should return 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .patch(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ succession_status: 'covered' });
      expect(res.status).toBe(404);
    });

    it('should return 400 with empty body', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: ROLE_ID }], rowCount: 1 });
      const res = await supertest(app)
        .patch(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /succession/critical-roles/:id', () => {
    it('should delete role', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: ROLE_ID }], rowCount: 1 });
      const res = await supertest(app)
        .delete(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should return 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .delete(`/api/v1/succession/critical-roles/${ROLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /succession/candidates', () => {
    it('should return candidates list', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: CANDIDATE_ID, candidate_name: 'Luca' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
      const res = await supertest(app)
        .get('/api/v1/succession/candidates')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /succession/candidates', () => {
    it('should add candidate (201)', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: ROLE_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: CANDIDATE_ID }], rowCount: 1 });
      const res = await supertest(app)
        .post('/api/v1/succession/candidates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          critical_role_id: ROLE_ID,
          candidate_employee_id: EMP_ID,
          readiness_level: 'ready_now',
        });
      expect(res.status).toBe(201);
    });

    it('should return 400 when IDs missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/succession/candidates')
        .set('Authorization', `Bearer ${token}`)
        .send({ readiness_level: 'ready_now' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when critical role invalid', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post('/api/v1/succession/candidates')
        .set('Authorization', `Bearer ${token}`)
        .send({ critical_role_id: ROLE_ID, candidate_employee_id: EMP_ID });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /succession/candidates/:id', () => {
    it('should update candidate', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: CANDIDATE_ID }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: CANDIDATE_ID, readiness_level: 'ready_now' }],
          rowCount: 1,
        });
      const res = await supertest(app)
        .patch(`/api/v1/succession/candidates/${CANDIDATE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readiness_level: 'ready_now' });
      expect(res.status).toBe(200);
    });

    it('should return 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .patch(`/api/v1/succession/candidates/${CANDIDATE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readiness_level: 'ready_now' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /succession/candidates/:id', () => {
    it('should remove candidate', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: CANDIDATE_ID }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .delete(`/api/v1/succession/candidates/${CANDIDATE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('should return 404 when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .delete(`/api/v1/succession/candidates/${CANDIDATE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
