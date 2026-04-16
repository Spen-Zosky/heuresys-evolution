/**
 * Inference Review Routes - Behavioral Tests
 * Tests HTTP request/response behavior for AI-inferred skill relation review endpoints.
 * Covers: pending relations listing, approve/reject single, bulk operations, metrics, activity.
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
const { default: routeHandler } = await import('../../routes/inference-review.js');
const supertest = (await import('supertest')).default;

const RELATION_ID = DEFAULT_IDS.EMPLOYEE_ID;
const REVIEWER_ID = DEFAULT_IDS.USER_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/inference', (req, _res, next) => {
    req.dbClient = { query: mockQuery, release: jest.fn() } as never;
    next();
  });
  app.use('/api/v1/inference', routeHandler);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.statusCode || err.httpStatus || 500;
    res
      .status(status)
      .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
  });
  return app;
}

describe('Inference Review Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ===========================================================================
  // GET /inference/pending
  // ===========================================================================

  describe('GET /pending', () => {
    it('should return 200 with pending relations and pagination', async () => {
      const rows = [
        {
          id: RELATION_ID,
          source_skill_id: 's1',
          source_skill_label: 'Python',
          target_skill_id: 's2',
          target_skill_label: 'Django',
          relation_type: 'related',
          strength: '0.8',
          confidence: '0.9',
          context: null,
          model_version: 'v1',
          inference_date: new Date('2025-01-01'),
          created_at: new Date('2025-01-01'),
        },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows, rowCount: 1 }) // main query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // count query

      const res = await supertest(app).get('/api/v1/inference/pending');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.relations).toHaveLength(1);
      expect(res.body.data.relations[0].sourceSkillLabel).toBe('Python');
      expect(res.body.data.relations[0].targetSkillLabel).toBe('Django');
      expect(res.body.data.relations[0].strength).toBe(0.8);
      expect(res.body.data.relations[0].confidence).toBe(0.9);
      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.meta.limit).toBe(20);
      expect(res.body.data.meta.offset).toBe(0);
    });

    it('should apply custom limit, offset, relationType, and minConfidence', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const res = await supertest(app).get(
        '/api/v1/inference/pending?limit=5&offset=10&relationType=related&minConfidence=0.7&sortBy=date_desc'
      );
      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(5);
      expect(res.body.data.meta.offset).toBe(10);
    });

    it('should cap limit at 100', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const res = await supertest(app).get('/api/v1/inference/pending?limit=999');
      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(100);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await supertest(app).get('/api/v1/inference/pending');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /inference/:id/approve
  // ===========================================================================

  describe('POST /:id/approve', () => {
    it('should return 200 when approving a pending relation', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: RELATION_ID, approval_status: 'pending' }],
          rowCount: 1,
        }) // check
        .mockResolvedValueOnce({
          rows: [{ id: RELATION_ID, approved_at: '2025-06-01' }],
          rowCount: 1,
        }) // update
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log

      const res = await supertest(app)
        .post(`/api/v1/inference/${RELATION_ID}/approve`)
        .send({ reviewerId: REVIEWER_ID, notes: 'Looks correct' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(RELATION_ID);
      expect(res.body.data.status).toBe('approved');
    });

    it('should return 404 when relation does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app).post('/api/v1/inference/nonexistent-id/approve').send({});
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when relation is already approved', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RELATION_ID, approval_status: 'approved' }],
        rowCount: 1,
      });

      const res = await supertest(app).post(`/api/v1/inference/${RELATION_ID}/approve`).send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Relation is already approved');
    });

    it('should return 400 when reviewerId is not a valid UUID', async () => {
      const res = await supertest(app)
        .post(`/api/v1/inference/${RELATION_ID}/approve`)
        .send({ reviewerId: 'not-a-uuid' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /inference/:id/reject
  // ===========================================================================

  describe('POST /:id/reject', () => {
    it('should return 200 when rejecting a pending relation', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: RELATION_ID, approval_status: 'pending' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ id: RELATION_ID, approved_at: '2025-06-01' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log

      const res = await supertest(app)
        .post(`/api/v1/inference/${RELATION_ID}/reject`)
        .send({ reviewerId: REVIEWER_ID, reason: 'Incorrect relation' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(RELATION_ID);
      expect(res.body.data.status).toBe('rejected');
    });

    it('should return 404 when relation does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app).post('/api/v1/inference/nonexistent/reject').send({});
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not found|non trovato/i);
    });

    it('should return 400 when relation is already rejected', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: RELATION_ID, approval_status: 'rejected' }],
        rowCount: 1,
      });

      const res = await supertest(app).post(`/api/v1/inference/${RELATION_ID}/reject`).send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Relation is already rejected');
    });
  });

  // ===========================================================================
  // POST /inference/bulk
  // ===========================================================================

  describe('POST /bulk', () => {
    it('should return 200 when bulk approving relations', async () => {
      const ids = [RELATION_ID, DEFAULT_IDS.DEPARTMENT_ID];
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: ids[0] }, { id: ids[1] }], rowCount: 2 }) // update
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // audit log 1
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log 2

      const res = await supertest(app)
        .post('/api/v1/inference/bulk')
        .send({ action: 'approve', relationIds: ids, reviewerId: REVIEWER_ID, notes: 'All good' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.action).toBe('approve');
      expect(res.body.data.requested).toBe(2);
      expect(res.body.data.updated).toBe(2);
      expect(res.body.data.skipped).toBe(0);
    });

    it('should return 200 when bulk rejecting with some skipped', async () => {
      const ids = [RELATION_ID, DEFAULT_IDS.DEPARTMENT_ID];
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: ids[0] }], rowCount: 1 }) // only 1 updated
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log

      const res = await supertest(app)
        .post('/api/v1/inference/bulk')
        .send({ action: 'reject', relationIds: ids });
      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(1);
      expect(res.body.data.skipped).toBe(1);
    });

    it('should return 400 when action is invalid via Zod', async () => {
      const res = await supertest(app)
        .post('/api/v1/inference/bulk')
        .send({ action: 'invalid', relationIds: [RELATION_ID] });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when relationIds is empty via Zod', async () => {
      const res = await supertest(app)
        .post('/api/v1/inference/bulk')
        .send({ action: 'approve', relationIds: [] });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when relationIds contains invalid UUIDs', async () => {
      const res = await supertest(app)
        .post('/api/v1/inference/bulk')
        .send({ action: 'approve', relationIds: ['not-uuid'] });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // POST /inference/bulk-by-filter
  // ===========================================================================

  describe('POST /bulk-by-filter', () => {
    it('should return 200 when bulk approving by filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'r1' }, { id: 'r2' }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/inference/bulk-by-filter')
        .send({
          action: 'approve',
          filter: { relationType: 'related', minConfidence: 0.8 },
          reviewerId: REVIEWER_ID,
          notes: 'High confidence batch',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.action).toBe('approve');
      expect(res.body.data.updated).toBe(2);
    });

    it('should apply maxAge filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/inference/bulk-by-filter')
        .send({
          action: 'reject',
          filter: { maxAge: 30 },
          limit: 10,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(0);
    });

    it('should return 400 when action is invalid', async () => {
      const res = await supertest(app)
        .post('/api/v1/inference/bulk-by-filter')
        .send({ action: 'invalid', filter: {} });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /inference/metrics
  // ===========================================================================

  describe('GET /metrics', () => {
    it('should return 200 with review metrics', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { approval_status: 'pending', count: '10', avg_confidence: '0.85' },
            { approval_status: 'approved', count: '50', avg_confidence: '0.92' },
            { approval_status: 'rejected', count: '5', avg_confidence: '0.45' },
          ],
          rowCount: 3,
        })
        .mockResolvedValueOnce({
          rows: [
            { relation_type: 'related', approval_status: 'pending', count: '5' },
            { relation_type: 'related', approval_status: 'approved', count: '30' },
          ],
          rowCount: 2,
        })
        .mockResolvedValueOnce({
          rows: [
            { date: new Date('2025-06-01'), approval_status: 'approved', count: '3' },
            { date: new Date('2025-06-01'), approval_status: 'rejected', count: '1' },
          ],
          rowCount: 2,
        });

      const res = await supertest(app).get('/api/v1/inference/metrics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalPending).toBe(10);
      expect(res.body.data.totalApproved).toBe(50);
      expect(res.body.data.totalRejected).toBe(5);
      expect(res.body.data.approvalRate).toBeCloseTo(0.91, 1);
      expect(res.body.data.avgConfidence).toBe(0.85);
      expect(res.body.data.byRelationType).toBeDefined();
      expect(res.body.data.recentActivity).toBeInstanceOf(Array);
    });

    it('should handle empty metrics gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app).get('/api/v1/inference/metrics');
      expect(res.status).toBe(200);
      expect(res.body.data.totalPending).toBe(0);
      expect(res.body.data.totalApproved).toBe(0);
      expect(res.body.data.totalRejected).toBe(0);
      expect(res.body.data.approvalRate).toBe(0);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB fail'));

      const res = await supertest(app).get('/api/v1/inference/metrics');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /inference/activity
  // ===========================================================================

  describe('GET /activity', () => {
    it('should return 200 with activity log', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: RELATION_ID,
            source_skill: 'Python',
            target_skill: 'Django',
            relation_type: 'related',
            approval_status: 'approved',
            confidence: '0.9',
            approved_at: '2025-06-01',
            approved_by: REVIEWER_ID,
          },
        ],
        rowCount: 1,
      });

      const res = await supertest(app).get('/api/v1/inference/activity');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activity).toHaveLength(1);
      expect(res.body.data.activity[0].sourceSkill).toBe('Python');
      expect(res.body.data.activity[0].targetSkill).toBe('Django');
      expect(res.body.data.activity[0].status).toBe('approved');
      expect(res.body.data.activity[0].confidence).toBe(0.9);
      expect(res.body.data.meta.limit).toBe(20);
      expect(res.body.data.meta.offset).toBe(0);
    });

    it('should apply custom limit and offset', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app).get('/api/v1/inference/activity?limit=5&offset=10');
      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(5);
      expect(res.body.data.meta.offset).toBe(10);
    });

    it('should cap limit at 100', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app).get('/api/v1/inference/activity?limit=500');
      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(100);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB fail'));

      const res = await supertest(app).get('/api/v1/inference/activity');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
