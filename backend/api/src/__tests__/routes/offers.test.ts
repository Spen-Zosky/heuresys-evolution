/**
 * offers Routes - Comprehensive Behavioral Tests
 * Tests for: GET /stats, GET /pending, GET /, GET /:id, POST /,
 *   PATCH /:id, POST /:id/approve, POST /:id/send, POST /:id/accept,
 *   POST /:id/decline, DELETE /:id
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
  pool: { query: mockQuery, connect: mockConnect },
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
const { default: routes } = await import('../../routes/offers.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const USER_ID = DEFAULT_IDS.USER_ID;
const OFFER_ID = '11111111-2222-3333-4444-555555555555';
const CANDIDATE_ID = '22222222-3333-4444-5555-666666666666';
const REQUISITION_ID = '33333333-4444-5555-6666-777777777777';

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/offers', authMiddleware);
  app.use('/api/v1/offers', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/offers', routes);
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

function createSysadminToken(): string {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('offers Routes', () => {
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

  describe('Auth enforcement', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await supertest(app).get('/api/v1/offers');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /stats
  // =========================================================================

  describe('GET /stats', () => {
    it('should return offer statistics', async () => {
      const stats = {
        total: '10',
        draft: '2',
        pending_approval: '1',
        approved: '2',
        sent: '3',
        accepted: '1',
        declined: '1',
        avg_salary_offered: '55000',
      };
      mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/offers/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe('10');
      expect(res.body.data.accepted).toBe('1');
      expect(res.body.data.avg_salary_offered).toBe('55000');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/offers/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /pending
  // =========================================================================

  describe('GET /pending', () => {
    it('should return pending offers', async () => {
      const offers = [
        {
          id: OFFER_ID,
          status: 'pending_approval',
          candidate_name: 'Mario Rossi',
          candidate_email: 'mario@test.com',
          requisition_title: 'Senior Dev',
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: offers, rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/offers/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].candidate_name).toBe('Mario Rossi');
    });

    it('should return empty array when no pending offers', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/offers/pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // =========================================================================
  // GET /
  // =========================================================================

  describe('GET /', () => {
    it('should return all offers with meta', async () => {
      const offers = [
        { id: 'o1', status: 'draft', salary_offered: 50000, candidate_name: 'Mario Rossi' },
        { id: 'o2', status: 'sent', salary_offered: 60000, candidate_name: 'Lucia Bianchi' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: offers, rowCount: 2 });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.limit).toBe(100);
      expect(res.body.meta.offset).toBe(0);
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'o1', status: 'accepted' }], rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/offers?status=accepted')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by candidate_id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/offers?candidate_id=${CANDIDATE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /:id
  // =========================================================================

  describe('GET /:id', () => {
    it('should return offer by id', async () => {
      const offer = {
        id: OFFER_ID,
        status: 'draft',
        salary_offered: 55000,
        candidate_name: 'Mario Rossi',
        candidate_email: 'mario@test.com',
        requisition_title: 'Senior Dev',
      };
      mockQuery.mockResolvedValueOnce({ rows: [offer], rowCount: 1 });

      const res = await supertest(app)
        .get(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(OFFER_ID);
      expect(res.body.data.salary_offered).toBe(55000);
    });

    it('should return 404 when offer not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get(`/api/v1/offers/${OFFER_ID}`)
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
    it('should create offer with valid data', async () => {
      // Candidate check
      mockQuery.mockResolvedValueOnce({ rows: [{ id: CANDIDATE_ID }], rowCount: 1 });
      // INSERT
      const newOffer = {
        id: OFFER_ID,
        candidate_id: CANDIDATE_ID,
        salary_offered: 55000,
        status: 'draft',
      };
      mockQuery.mockResolvedValueOnce({ rows: [newOffer], rowCount: 1 });

      const res = await supertest(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({ candidate_id: CANDIDATE_ID, salary_offered: 55000 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salary_offered).toBe(55000);
      expect(res.body.message).toBe('Offer created');
    });

    it('should return 400 when candidate_id is missing (Zod validation)', async () => {
      const res = await supertest(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({ salary_offered: 55000 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when candidate not found in tenant', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({ candidate_id: CANDIDATE_ID, salary_offered: 55000 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid candidate');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Insert failed'));

      const res = await supertest(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({ candidate_id: CANDIDATE_ID, salary_offered: 55000 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // PATCH /:id
  // =========================================================================

  describe('PATCH /:id', () => {
    it('should update offer fields', async () => {
      // Check existing
      mockQuery.mockResolvedValueOnce({ rows: [{ id: OFFER_ID, status: 'draft' }], rowCount: 1 });
      // UPDATE
      const updated = { id: OFFER_ID, salary_offered: 60000, status: 'draft' };
      mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ salary_offered: 60000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salary_offered).toBe(60000);
      expect(res.body.message).toBe('Offer updated');
    });

    it('should return 404 when offer not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .patch(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ salary_offered: 60000 });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when offer is in sent status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: OFFER_ID, status: 'sent' }], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ salary_offered: 60000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot modify offer in current status');
    });

    it('should return 400 when no fields to update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: OFFER_ID, status: 'draft' }], rowCount: 1 });

      const res = await supertest(app)
        .patch(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No fields to update');
    });
  });

  // =========================================================================
  // POST /:id/approve
  // =========================================================================

  describe('POST /:id/approve', () => {
    it('should approve an offer', async () => {
      const approved = { id: OFFER_ID, status: 'approved', approved_by: USER_ID };
      mockQuery.mockResolvedValueOnce({ rows: [approved], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({ approved_by: USER_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.message).toBe('Offer approved');
    });

    it('should return 404 when offer not found or wrong status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /:id/send (uses withTransaction)
  // =========================================================================

  describe('POST /:id/send', () => {
    it('should send an approved offer', async () => {
      const sentOffer = { id: OFFER_ID, status: 'sent', candidate_id: CANDIDATE_ID };
      // withTransaction: BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // withTransaction: set_config tenant context
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // UPDATE offer
      mockClientQuery.mockResolvedValueOnce({ rows: [sentOffer], rowCount: 1 });
      // UPDATE candidate stage
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/send`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Offer sent');
    });

    it('should return 404 when offer not approved', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // set_config tenant context
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // UPDATE returns empty (wrong status)
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/send`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /:id/accept (uses withTransaction)
  // =========================================================================

  describe('POST /:id/accept', () => {
    it('should accept a sent offer', async () => {
      const acceptedOffer = {
        id: OFFER_ID,
        status: 'accepted',
        candidate_id: CANDIDATE_ID,
        requisition_id: REQUISITION_ID,
      };
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // set_config tenant context
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // UPDATE offer
      mockClientQuery.mockResolvedValueOnce({ rows: [acceptedOffer], rowCount: 1 });
      // UPDATE candidate stage
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // UPDATE requisition (filled)
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/accept`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Offer accepted');
    });

    it('should return 404 when offer not sent', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // set_config tenant context
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // UPDATE returns empty
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/accept`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // POST /:id/decline
  // =========================================================================

  describe('POST /:id/decline', () => {
    it('should decline a sent offer with reason', async () => {
      const declined = { id: OFFER_ID, status: 'declined' };
      mockQuery.mockResolvedValueOnce({ rows: [declined], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/decline`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Better offer elsewhere' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Offer declined');
    });

    it('should decline without reason', async () => {
      const declined = { id: OFFER_ID, status: 'declined' };
      mockQuery.mockResolvedValueOnce({ rows: [declined], rowCount: 1 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/decline`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when offer not sent', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post(`/api/v1/offers/${OFFER_ID}/decline`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // DELETE /:id
  // =========================================================================

  describe('DELETE /:id', () => {
    it('should delete draft offer', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: OFFER_ID }], rowCount: 1 });

      const res = await supertest(app)
        .delete(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Offer deleted');
    });

    it('should return 404 when offer not found or not draft', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await supertest(app)
        .delete(`/api/v1/offers/${OFFER_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
