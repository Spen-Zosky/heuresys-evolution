/**
 * Review Cycles Routes - Unit Tests
 * Tests review cycle CRUD, participant management, phase management,
 * template management, launch/close lifecycle, and progress tracking.
 *
 * Endpoints tested:
 *  GET    /review-cycles                              - List cycles
 *  GET    /review-cycles/active                       - Active cycles
 *  GET    /review-cycles/stats                        - Statistics
 *  GET    /review-cycles/:id                          - Get cycle
 *  POST   /review-cycles                              - Create cycle
 *  PATCH  /review-cycles/:id                          - Update cycle
 *  DELETE /review-cycles/:id                          - Delete cycle
 *  GET    /review-cycles/:id/details                  - Detailed cycle view
 *  GET    /review-cycles/:id/participants             - List participants
 *  POST   /review-cycles/:id/participants             - Add participants
 *  GET    /review-cycles/:id/participants/:pid        - Get participant
 *  PATCH  /review-cycles/:id/participants/:pid        - Update participant
 *  DELETE /review-cycles/:id/participants/:pid        - Remove participant
 *  POST   /review-cycles/:id/launch                   - Launch cycle
 *  POST   /review-cycles/:id/close                    - Close cycle
 *  GET    /review-cycles/:id/progress                 - Progress summary
 *  GET    /review-cycles/:id/phases                   - List phases
 *  POST   /review-cycles/:id/phases                   - Add phases
 *  PATCH  /review-cycles/:id/phases/:phaseId          - Update phase
 *  GET    /review-cycles/config/templates             - List templates
 *  POST   /review-cycles/config/templates             - Create template
 *  GET    /review-cycles/config/templates/:tid        - Get template
 *  PATCH  /review-cycles/config/templates/:tid        - Update template
 *  POST   /review-cycles/:id/auto-assign              - Auto-assign participants
 *  GET    /review-cycles/config/rating-scales         - Rating scales
 *  GET    /review-cycles/:id/summary                  - Cycle summary
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

// Mock performance management service
const mockGetParticipants = jest.fn();
const mockAddParticipants = jest.fn();
const mockUpdateParticipantStatus = jest.fn();

jest.unstable_mockModule(resolve('../../services/performance-management.js'), () => ({
  performanceManagementService: {
    getReviewCycleParticipants: mockGetParticipants,
    addReviewCycleParticipants: mockAddParticipants,
    updateParticipantStatus: mockUpdateParticipantStatus,
  },
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/review-cycles.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const CYCLE_ID = '11111111-2222-4333-a444-555555555555';
const PART_ID = '22222222-3333-4444-a555-666666666666';
const PHASE_ID = '33333333-4444-4555-a666-777777777777';
const TMPL_ID = '44444444-5555-4666-a777-888888888888';
const EMP_ID = DEFAULT_IDS.EMPLOYEE_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/review-cycles', authMiddleware);
  app.use('/api/v1/review-cycles', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockClientQuery } as never;
    next();
  });
  app.use('/api/v1/review-cycles', routes);
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

describe('Review Cycles Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
    mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('should return 401 without auth token', async () => {
    const res = await supertest(app).get('/api/v1/review-cycles');
    expect(res.status).toBe(401);
  });

  // ==================== GET / ====================

  describe('GET / (list)', () => {
    it('should return 200 with paginated list', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          { id: CYCLE_ID, name: 'Q1 2026', status: 'draft', review_count: 0, feedback_count: 0 },
        ],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
      const res = await supertest(app)
        .get('/api/v1/review-cycles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(5);
    });

    it('should return 500 on database error', async () => {
      mockClientQuery.mockRejectedValueOnce(new Error('DB error'));
      const res = await supertest(app)
        .get('/api/v1/review-cycles')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(500);
    });
  });

  // ==================== GET /active ====================

  describe('GET /active', () => {
    it('should return 200 with active cycles', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, name: 'Active Cycle', status: 'active' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/review-cycles/active')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ==================== GET /stats ====================

  describe('GET /stats', () => {
    it('should return 200 with statistics', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            total_cycles: '10',
            draft_cycles: '2',
            active_cycles: '3',
            completed_cycles: '5',
            total_participants_ever: '200',
            avg_completion_rate: '85.5',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/review-cycles/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total_cycles).toBe('10');
      expect(res.body.data.active_cycles).toBe('3');
    });
  });

  // ==================== GET /:id ====================

  describe('GET /:id', () => {
    it('should return 404 when not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 with cycle data', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: CYCLE_ID,
            name: 'Q1 2026',
            status: 'draft',
            review_count: '10',
            feedback_count: '5',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(CYCLE_ID);
    });
  });

  // ==================== POST / ====================

  describe('POST /', () => {
    it('should return 400 when name missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/review-cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({ start_date: '2026-01-01', end_date: '2026-03-31' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when start_date missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/review-cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Q1 2026', end_date: '2026-03-31' });
      expect(res.status).toBe(400);
    });

    it('should return 201 on successful creation', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, name: 'Q1 2026', status: 'draft' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post('/api/v1/review-cycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Q1 2026',
          start_date: '2026-01-01',
          end_date: '2026-03-31',
          cycle_type: 'quarterly',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Q1 2026');
    });
  });

  // ==================== PATCH /:id ====================

  describe('PATCH /:id', () => {
    it('should return 404 when not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .patch(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should return 400 when no fields to update', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: CYCLE_ID }], rowCount: 1 });
      const res = await supertest(app)
        .patch(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 200 on successful update', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: CYCLE_ID }], rowCount: 1 });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, name: 'Updated Name' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .patch(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /:id', () => {
    it('should return 400 when cycle has associated feedback', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
      const res = await supertest(app)
        .delete(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/feedback/i);
    });

    it('should return 404 when not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .delete(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 on successful delete', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: CYCLE_ID }], rowCount: 1 });
      const res = await supertest(app)
        .delete(`/api/v1/review-cycles/${CYCLE_ID}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  // ==================== GET /:id/details ====================

  describe('GET /:id/details', () => {
    it('should return 404 when not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/details`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 with completion percentage', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: CYCLE_ID,
            name: 'Q1',
            total_participants: '20',
            completed_participants: '10',
            in_progress_participants: '5',
          },
        ],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/details`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.completion_percentage).toBe(50);
    });
  });

  // ==================== POST /:id/launch ====================

  describe('POST /:id/launch', () => {
    it('should return 404 when cycle not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/launch`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when not in draft status', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'active' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/launch`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/draft/i);
    });

    it('should return 400 when no participants', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'draft', name: 'T' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/launch`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no participants/i);
    });

    it('should return 200 on successful launch', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'draft', name: 'T' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'active' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/launch`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/launched/i);
    });
  });

  // ==================== POST /:id/close ====================

  describe('POST /:id/close', () => {
    it('should return 404 when cycle not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/close`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(404);
    });

    it('should return 400 when not active', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'draft' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/close`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/active/i);
    });

    it('should return 400 when incomplete participants without force', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'active' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/close`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/incomplete/i);
    });

    it('should return 200 on successful close with force', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'active' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, status: 'completed' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post(`/api/v1/review-cycles/${CYCLE_ID}/close`)
        .set('Authorization', `Bearer ${token}`)
        .send({ force: true });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/closed/i);
    });
  });

  // ==================== GET /:id/progress ====================

  describe('GET /:id/progress', () => {
    it('should return 200 with progress data', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            total_participants: '20',
            draft_count: '0',
            pending_count: '5',
            in_progress_count: '5',
            completed_count: '10',
            completion_percentage: '50.00',
          },
        ],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ org_unit_id: 'd1', department_name: 'IT', total: '10', completed: '7' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/progress`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.by_org_unit.length).toBe(1);
    });
  });

  // ==================== GET /:id/phases ====================

  describe('GET /:id/phases', () => {
    it('should return 200 with phases', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: PHASE_ID, phase_name: 'Self Review', phase_order: 1 }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/phases`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ==================== GET /config/rating-scales ====================

  describe('GET /config/rating-scales', () => {
    it('should return 200 with rating scale options', async () => {
      const res = await supertest(app)
        .get('/api/v1/review-cycles/config/rating-scales')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].type).toBe('1-5');
    });
  });

  // ==================== GET /config/templates ====================

  describe('GET /config/templates', () => {
    it('should return 200 with templates', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: TMPL_ID, name: 'Standard Review', template_type: 'standard' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get('/api/v1/review-cycles/config/templates')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  // ==================== POST /config/templates ====================

  describe('POST /config/templates', () => {
    it('should return 400 when name missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/review-cycles/config/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ sections: [{ name: 'Goals' }] });
      expect(res.status).toBe(400);
    });

    it('should return 400 when sections missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/review-cycles/config/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Template' });
      expect(res.status).toBe(400);
    });

    it('should return 201 on successful creation', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: TMPL_ID, name: 'Custom Template', template_type: 'standard' }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .post('/api/v1/review-cycles/config/templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Custom Template', sections: [{ name: 'Goals', weight: 40 }] });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Custom Template');
    });
  });

  // ==================== GET /:id/summary ====================

  describe('GET /:id/summary', () => {
    it('should return 404 when not found', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/summary`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('should return 200 with summary and phases', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: CYCLE_ID, name: 'Q1 2026', status: 'active' }],
        rowCount: 1,
      });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: PHASE_ID, phase_name: 'Self Review', phase_order: 1 }],
        rowCount: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/summary`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.phases.length).toBe(1);
    });
  });

  // ==================== GET /:id/participants (service) ====================

  describe('GET /:id/participants', () => {
    it('should return 200 with participants from service', async () => {
      mockGetParticipants.mockResolvedValueOnce({
        participants: [{ id: PART_ID, employee_name: 'Mario Rossi', status: 'pending' }],
        status_summary: { pending: 1 },
        total: 1,
      });
      const res = await supertest(app)
        .get(`/api/v1/review-cycles/${CYCLE_ID}/participants`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  // ==================== PATCH /:id/participants/:participantId (service) ====================

  describe('PATCH /:id/participants/:participantId', () => {
    it('should return 404 when not found', async () => {
      mockUpdateParticipantStatus.mockResolvedValueOnce(null);
      const res = await supertest(app)
        .patch(`/api/v1/review-cycles/${CYCLE_ID}/participants/${PART_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(404);
    });

    it('should return 200 on successful update', async () => {
      mockUpdateParticipantStatus.mockResolvedValueOnce({ id: PART_ID, status: 'completed' });
      const res = await supertest(app)
        .patch(`/api/v1/review-cycles/${CYCLE_ID}/participants/${PART_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
    });
  });
});
