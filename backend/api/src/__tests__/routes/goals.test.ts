/**
 * Goals Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for goal CRUD endpoints.
 * All external dependencies (database, redis, services) are mocked.
 *
 * Core endpoints tested:
 *  GET    /goals/stats/summary    - Goal statistics
 *  GET    /goals/stats            - Goal statistics (alias)
 *  GET    /goals                  - List goals with filters
 *  GET    /goals/:id              - Single goal detail
 *  POST   /goals                  - Create a goal
 *  PUT    /goals/:id              - Update a goal
 *  DELETE /goals/:id              - Delete a goal
 *  PATCH  /goals/:id/progress     - Update progress
 *  GET    /goals/:id/children     - List child goals
 *  GET    /goals/templates        - List goal templates
 *  POST   /goals/templates        - Create goal template
 *  POST   /goals/from-template    - Create goal from template
 *  GET    /goals/team             - Team goals
 *  POST   /goals/:id/check-in     - Goal check-in
 *  POST   /goals/:id/validate-smart - SMART validation
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

// Mock performance-management service
const mockGetGoalHierarchy = jest.fn();
const mockGetGoalAlignments = jest.fn();
const mockCreateGoalAlignment = jest.fn();
const mockGetGoalUpdates = jest.fn();
const mockAddGoalUpdate = jest.fn();
const mockGetGoalMilestones = jest.fn();
const mockCreateGoalMilestone = jest.fn();
const mockCompleteMilestone = jest.fn();
const mockCalculateCascadedProgress = jest.fn();

jest.unstable_mockModule(resolve('../../services/performance-management.js'), () => ({
  performanceManagementService: {
    getGoalHierarchy: mockGetGoalHierarchy,
    getGoalAlignments: mockGetGoalAlignments,
    createGoalAlignment: mockCreateGoalAlignment,
    getGoalUpdates: mockGetGoalUpdates,
    addGoalUpdate: mockAddGoalUpdate,
    getGoalMilestones: mockGetGoalMilestones,
    createGoalMilestone: mockCreateGoalMilestone,
    completeMilestone: mockCompleteMilestone,
    calculateCascadedProgress: mockCalculateCascadedProgress,
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------

const { default: express } = await import('express');
const { default: goalsRoutes } = await import('../../routes/goals.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const GOAL_ID = DEFAULT_IDS.GOAL_ID;
const PARENT_GOAL_ID = '88888888-1111-2222-3333-444444444444';
const TEMPLATE_ID = '77777777-1111-2222-3333-444444444444';

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
  app.use('/api/v1/goals', authMiddleware);
  app.use('/api/v1/goals', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = TENANT_CODE;
    req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/goals', goalsRoutes);
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

function buildGoalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: GOAL_ID,
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    owner_id: null,
    title: 'Complete Q1 Sales Targets',
    description: 'Reach 120% of quarterly target',
    goal_type: 'individual',
    status: 'active',
    priority: 'high',
    progress_percent: 45,
    start_date: '2026-01-01',
    due_date: '2026-03-31',
    completed_at: null,
    category: 'performance',
    weight: 0.8,
    parent_goal_id: null,
    employee_name: 'Mario Rossi',
    employee_email: 'mario.rossi@rtl-bank.com',
    parent_title: null,
    child_count: '0',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-25T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Goals Routes - Behavioral Tests', () => {
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
    it('should return 401 for GET /goals without auth token', async () => {
      const res = await supertest(app).get('/api/v1/goals').set('X-Tenant-ID', TENANT_ID);
      expect(res.status).toBe(401);
    });

    it('should return 401 for POST /goals without auth token', async () => {
      const res = await supertest(app)
        .post('/api/v1/goals')
        .set('X-Tenant-ID', TENANT_ID)
        .send({ title: 'Test', employee_id: EMPLOYEE_ID });
      expect(res.status).toBe(401);
    });

    it('should return 401 for DELETE /goals/:id without auth token', async () => {
      const res = await supertest(app)
        .delete(`/api/v1/goals/${GOAL_ID}`)
        .set('X-Tenant-ID', TENANT_ID);
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /goals/stats/summary
  // =========================================================================
  describe('GET /goals/stats/summary', () => {
    it('should return goal statistics', async () => {
      const token = createSysadminToken();

      const statsRow = {
        total: '100',
        draft: '10',
        active: '50',
        completed: '30',
        cancelled: '5',
        on_hold: '5',
        avg_progress: '62.50',
        overdue: '8',
      };

      mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals/stats/summary')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total', 100);
      expect(res.body.data).toHaveProperty('active', 50);
      expect(res.body.data).toHaveProperty('completed', 30);
      expect(res.body.data).toHaveProperty('overdue', 8);
      expect(res.body.data).toHaveProperty('avg_progress', 62.5);
    });
  });

  // =========================================================================
  // GET /goals - List goals
  // =========================================================================
  describe('GET /goals', () => {
    it('should return paginated list of goals', async () => {
      const token = createSysadminToken();

      const goal1 = buildGoalRow({ id: 'goal-1', title: 'Sales Target', priority: 'high' });
      const goal2 = buildGoalRow({
        id: 'goal-2',
        title: 'Learn React',
        priority: 'medium',
        category: 'development',
      });

      // List query
      mockQuery.mockResolvedValueOnce({ rows: [goal1, goal2], rowCount: 2 } as never);
      // Count query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '15' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('title', 'Sales Target');
      expect(res.body.data[0]).toHaveProperty('employee_name', 'Mario Rossi');
      expect(res.body.meta).toHaveProperty('total', 15);
      expect(res.body.meta).toHaveProperty('limit', 100);
      expect(res.body.meta).toHaveProperty('offset', 0);
    });

    it('should filter by employee_id', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [buildGoalRow()], rowCount: 1 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/goals?employee_id=${EMPLOYEE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      const listQueryParams = mockQuery.mock.calls[0]![1] as string[];
      expect(listQueryParams).toContain(EMPLOYEE_ID);
    });

    it('should filter by status', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals?status=completed')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      const listQueryParams = mockQuery.mock.calls[0]![1] as string[];
      expect(listQueryParams).toContain('completed');
    });

    it('should filter by priority and category', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals?priority=high&category=performance')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      const listQueryParams = mockQuery.mock.calls[0]![1] as string[];
      expect(listQueryParams).toContain('high');
      expect(listQueryParams).toContain('performance');
    });

    it('should filter root goals with parent_goal_id=null', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals?parent_goal_id=null')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      // parent_goal_id=null triggers IS NULL in query, not a param
      const queryText = mockQuery.mock.calls[0]![0] as string;
      expect(queryText).toContain('IS NULL');
    });

    it('should return empty list with zero meta total', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  // =========================================================================
  // GET /goals/:id
  // =========================================================================
  describe('GET /goals/:id', () => {
    it('should return goal detail with related data', async () => {
      const token = createSysadminToken();

      const goal = buildGoalRow({ child_count: '3' });

      mockQuery.mockResolvedValueOnce({ rows: [goal], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', GOAL_ID);
      expect(res.body.data).toHaveProperty('title', 'Complete Q1 Sales Targets');
      expect(res.body.data).toHaveProperty('status', 'active');
      expect(res.body.data).toHaveProperty('priority', 'high');
      expect(res.body.data).toHaveProperty('progress_percent', 45);
      expect(res.body.data).toHaveProperty('employee_name', 'Mario Rossi');
      expect(res.body.data).toHaveProperty('employee_email', 'mario.rossi@rtl-bank.com');
      expect(res.body.data).toHaveProperty('child_count', '3');
    });

    it('should return 404 when goal not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // POST /goals - Create goal
  // =========================================================================
  describe('POST /goals', () => {
    it('should create goal successfully with valid data', async () => {
      const token = createSysadminToken();

      const newGoal = buildGoalRow({ id: 'new-goal-id', status: 'draft' });

      // Employee check - exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 } as never);
      // INSERT RETURNING *
      mockQuery.mockResolvedValueOnce({ rows: [newGoal], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({
          employee_id: EMPLOYEE_ID,
          title: 'Complete Q1 Sales Targets',
          description: 'Reach 120% of quarterly target',
          goal_type: 'individual',
          priority: 'high',
          start_date: '2026-01-01',
          due_date: '2026-03-31',
          category: 'performance',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', 'new-goal-id');
      expect(res.body.data).toHaveProperty('title', 'Complete Q1 Sales Targets');
    });

    it('should return 400 when title is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID });

      // Zod validation catches missing title
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when employee does not belong to tenant', async () => {
      const token = createSysadminToken();

      // Employee check - not found
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, title: 'Test Goal' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when invalid goal_type provided', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, title: 'Test', goal_type: 'invalid_type' });

      expect(res.status).toBe(400);
    });

    it('should return 500 when INSERT fails', async () => {
      const token = createSysadminToken();

      // Employee check passes
      mockQuery.mockResolvedValueOnce({ rows: [{ id: EMPLOYEE_ID }], rowCount: 1 } as never);
      // INSERT fails
      mockQuery.mockRejectedValueOnce(new Error('DB error') as never);

      const res = await supertest(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, title: 'Test Goal' });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // PUT /goals/:id - Update goal
  // =========================================================================
  describe('PUT /goals/:id', () => {
    it('should update goal successfully', async () => {
      const token = createSysadminToken();

      const updatedGoal = buildGoalRow({ title: 'Updated Title', priority: 'critical' });

      // Existence check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: GOAL_ID, status: 'active' }],
        rowCount: 1,
      } as never);
      // UPDATE RETURNING *
      mockQuery.mockResolvedValueOnce({ rows: [updatedGoal], rowCount: 1 } as never);

      const res = await supertest(app)
        .put(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ title: 'Updated Title', priority: 'critical' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('title', 'Updated Title');
      expect(res.body.data).toHaveProperty('priority', 'critical');
    });

    it('should return 404 when goal not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .put(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });

    // BUG DISCOVERED: Zod schema defines field as 'parent_id' but the route
    // handler destructures 'parent_goal_id'. After Zod validation replaces req.body,
    // parent_goal_id is always undefined in the handler. The circular reference check
    // (parent_goal_id === id) is therefore unreachable. This needs to be fixed in
    // either schemas/goals.ts or routes/goals.ts to align field names.
    it('should accept update even with parent_id set to self (circular reference check broken)', async () => {
      const token = createSysadminToken();

      // Existence check passes
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: GOAL_ID, status: 'active' }],
        rowCount: 1,
      } as never);
      // UPDATE query succeeds (circular reference check is bypassed due to field name mismatch)
      mockQuery.mockResolvedValueOnce({
        rows: [buildGoalRow({ parent_goal_id: GOAL_ID })],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .put(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ parent_id: GOAL_ID }); // Zod schema field name

      expect(res.status).toBe(200);
      // This SHOULD return 400 with CIRCULAR_REFERENCE once the bug is fixed
    });

    it('should auto-set completed_at when status changes to completed', async () => {
      const token = createSysadminToken();

      // Goal currently active
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: GOAL_ID, status: 'active' }],
        rowCount: 1,
      } as never);
      // UPDATE
      mockQuery.mockResolvedValueOnce({
        rows: [buildGoalRow({ status: 'completed', completed_at: '2026-02-25T12:00:00Z' })],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .put(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');

      // Verify completed_at timestamp was passed to the UPDATE query
      const updateParams = mockQuery.mock.calls[1]![1] as unknown[];
      // completedAtValue should be a non-null ISO string (param index 11, 0-based)
      expect(updateParams[11]).toBeTruthy();
    });
  });

  // =========================================================================
  // DELETE /goals/:id
  // =========================================================================
  describe('DELETE /goals/:id', () => {
    it('should delete goal successfully when no children', async () => {
      const token = createSysadminToken();

      // Child check - zero children
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);
      // DELETE RETURNING id
      mockQuery.mockResolvedValueOnce({ rows: [{ id: GOAL_ID }], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Goal deleted');
    });

    it('should return 400 when goal has child goals', async () => {
      const token = createSysadminToken();

      // Child check - has children
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 when goal not found for deletion', async () => {
      const token = createSysadminToken();

      // Child check - zero
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as never);
      // DELETE returns empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .delete(`/api/v1/goals/${GOAL_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // PATCH /goals/:id/progress
  // =========================================================================
  describe('PATCH /goals/:id/progress', () => {
    it('should update goal progress', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: GOAL_ID, progress_percent: 75 }],
        rowCount: 1,
      } as never);

      const res = await supertest(app)
        .patch(`/api/v1/goals/${GOAL_ID}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ progress_percent: 75 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('progress_percent', 75);
    });

    it('should return 400 when progress_percent is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .patch(`/api/v1/goals/${GOAL_ID}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 when goal not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .patch(`/api/v1/goals/${GOAL_ID}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ progress_percent: 50 });

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // GET /goals/:id/children
  // =========================================================================
  describe('GET /goals/:id/children', () => {
    it('should return child goals', async () => {
      const token = createSysadminToken();

      const children = [
        {
          id: 'child-1',
          title: 'Sub-task 1',
          status: 'active',
          priority: 'high',
          progress_percent: 30,
          due_date: '2026-03-15',
          employee_name: 'Mario Rossi',
        },
        {
          id: 'child-2',
          title: 'Sub-task 2',
          status: 'draft',
          priority: 'medium',
          progress_percent: 0,
          due_date: '2026-04-01',
          employee_name: 'Lucia Bianchi',
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: children, rowCount: 2 } as never);

      const res = await supertest(app)
        .get(`/api/v1/goals/${GOAL_ID}/children`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('title', 'Sub-task 1');
      expect(res.body.data[1]).toHaveProperty('employee_name', 'Lucia Bianchi');
    });

    it('should return empty list for goal with no children', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get(`/api/v1/goals/${GOAL_ID}/children`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // =========================================================================
  // GET /goals/templates
  // =========================================================================
  describe('GET /goals/templates', () => {
    it('should return list of goal templates', async () => {
      const token = createSysadminToken();

      const templates = [
        {
          id: 'tpl-1',
          name: 'Sales Target Template',
          category: 'performance',
          usage_count: 15,
          department_name: 'Sales',
        },
        {
          id: 'tpl-2',
          name: 'Learning Goal Template',
          category: 'development',
          usage_count: 8,
          department_name: null,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: templates, rowCount: 2 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals/templates')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('name', 'Sales Target Template');
      expect(res.body.meta).toHaveProperty('total', 2);
    });

    it('should filter by category', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .get('/api/v1/goals/templates?category=performance')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      const queryParams = mockQuery.mock.calls[0]![1] as string[];
      expect(queryParams).toContain('performance');
    });
  });

  // =========================================================================
  // POST /goals/templates
  // =========================================================================
  describe('POST /goals/templates', () => {
    it('should create goal template', async () => {
      const token = createSysadminToken();

      const newTemplate = {
        id: 'tpl-new',
        tenant_id: TENANT_ID,
        name: 'Quarterly Sales',
        category: 'performance',
        goal_type: 'objective',
        suggested_weight: 1.0,
      };

      mockQuery.mockResolvedValueOnce({ rows: [newTemplate], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/goals/templates')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ name: 'Quarterly Sales', category: 'performance' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name', 'Quarterly Sales');
      expect(res.body.message).toBe('Goal template created');
    });

    it('should return 400 when name is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/goals/templates')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ category: 'performance' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // POST /goals/from-template
  // =========================================================================
  describe('POST /goals/from-template', () => {
    it('should create goal from template', async () => {
      const token = createSysadminToken();

      const template = {
        id: TEMPLATE_ID,
        name: 'Sales Template',
        description: 'Template description',
        goal_type: 'individual',
        category: 'performance',
        suggested_weight: 0.8,
        suggested_duration_days: 90,
      };

      const newGoal = buildGoalRow({
        id: 'new-from-tpl',
        status: 'draft',
        template_id: TEMPLATE_ID,
      });

      // Get template
      mockQuery.mockResolvedValueOnce({ rows: [template], rowCount: 1 } as never);
      // INSERT goal
      mockQuery.mockResolvedValueOnce({ rows: [newGoal], rowCount: 1 } as never);
      // Update usage count
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      const res = await supertest(app)
        .post('/api/v1/goals/from-template')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ template_id: TEMPLATE_ID, employee_id: EMPLOYEE_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Goal created from template');
    });

    it('should return 400 when template_id or employee_id missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post('/api/v1/goals/from-template')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ template_id: TEMPLATE_ID });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 when template not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post('/api/v1/goals/from-template')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ template_id: TEMPLATE_ID, employee_id: EMPLOYEE_ID });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // GET /goals/team
  // =========================================================================
  describe('GET /goals/team', () => {
    it('should return team goals with summary', async () => {
      const token = createSysadminToken();
      const managerId = 'manager-uuid-1';

      const teamGoals = [
        {
          id: 'tg-1',
          title: 'Team Goal 1',
          employee_name: 'Mario Rossi',
          status: 'active',
          progress_percent: 50,
        },
      ];
      const summaryRow = {
        total_goals: '5',
        active: '3',
        completed: '1',
        overdue: '1',
        avg_progress: '45.00',
        employee_count: '3',
      };

      // Team goals query
      mockQuery.mockResolvedValueOnce({ rows: teamGoals, rowCount: 1 } as never);
      // Summary query
      mockQuery.mockResolvedValueOnce({ rows: [summaryRow], rowCount: 1 } as never);

      const res = await supertest(app)
        .get(`/api/v1/goals/team?manager_id=${managerId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('goals');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.goals).toHaveLength(1);
      expect(res.body.data.summary).toHaveProperty('total_goals', '5');
      expect(res.body.data.summary).toHaveProperty('overdue', '1');
    });

    it('should return 400 when manager_id is missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .get('/api/v1/goals/team')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // POST /goals/:id/check-in
  // =========================================================================
  describe('POST /goals/:id/check-in', () => {
    it('should record goal check-in and update progress', async () => {
      const token = createSysadminToken();

      const checkInResult = {
        id: 'checkin-1',
        goal_id: GOAL_ID,
        employee_id: EMPLOYEE_ID,
        previous_progress: 45,
        new_progress: 60,
        notes: 'Good progress this week',
      };

      // Get current progress
      mockQuery.mockResolvedValueOnce({
        rows: [{ progress_percent: 45, status: 'active' }],
        rowCount: 1,
      } as never);
      // INSERT check-in
      mockQuery.mockResolvedValueOnce({ rows: [checkInResult], rowCount: 1 } as never);
      // UPDATE goal progress
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      const res = await supertest(app)
        .post(`/api/v1/goals/${GOAL_ID}/check-in`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({
          employee_id: EMPLOYEE_ID,
          new_progress: 60,
          notes: 'Good progress this week',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('previous_progress', 45);
      expect(res.body.data).toHaveProperty('new_progress', 60);
      expect(res.body.message).toBe('Check-in recorded');
    });

    it('should return 400 when employee_id or new_progress missing', async () => {
      const token = createSysadminToken();

      const res = await supertest(app)
        .post(`/api/v1/goals/${GOAL_ID}/check-in`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ notes: 'No progress field' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 when goal not found', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post(`/api/v1/goals/${GOAL_ID}/check-in`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID)
        .send({ employee_id: EMPLOYEE_ID, new_progress: 50 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // POST /goals/:id/validate-smart
  // =========================================================================
  describe('POST /goals/:id/validate-smart', () => {
    it('should validate goal against SMART criteria', async () => {
      const token = createSysadminToken();

      const goal = {
        id: GOAL_ID,
        title: 'Complete Q1 Sales Targets with 120% achievement',
        description: 'Detailed description of the sales target',
        goal_type: 'individual',
        status: 'active',
        priority: 'high',
        start_date: '2026-01-01',
        due_date: '2026-03-31',
        weight: 0.8,
        category: 'performance',
        parent_goal_id: PARENT_GOAL_ID,
        progress_percent: 45,
        smart_criteria: null,
        is_smart_validated: false,
        smart_score: null,
      };

      // Get goal
      mockQuery.mockResolvedValueOnce({ rows: [goal], rowCount: 1 } as never);
      // Update SMART validation
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      const res = await supertest(app)
        .post(`/api/v1/goals/${GOAL_ID}/validate-smart`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('goal_id', GOAL_ID);
      expect(res.body.data).toHaveProperty('smart_criteria');
      expect(res.body.data).toHaveProperty('smart_score');
      expect(res.body.data).toHaveProperty('is_smart_validated');
      // With all fields present, score should be high
      expect(res.body.data.smart_score).toBeGreaterThanOrEqual(70);
      expect(res.body.data.is_smart_validated).toBe(true);
      // Check individual criteria
      expect(res.body.data.smart_criteria.specific).toHaveProperty('passed');
      expect(res.body.data.smart_criteria.measurable).toHaveProperty('passed');
      expect(res.body.data.smart_criteria.time_bound).toHaveProperty('passed');
    });

    it('should return 404 when goal not found for SMART validation', async () => {
      const token = createSysadminToken();

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const res = await supertest(app)
        .post(`/api/v1/goals/${GOAL_ID}/validate-smart`)
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // Database error handling
  // =========================================================================
  describe('Database Error Handling', () => {
    it('should return 500 when list query fails', async () => {
      const token = createSysadminToken();

      mockQuery.mockRejectedValueOnce(new Error('Connection timeout') as never);

      const res = await supertest(app)
        .get('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(500);
    });

    it('should return 500 when stats query fails', async () => {
      const token = createSysadminToken();

      mockQuery.mockRejectedValueOnce(new Error('Stats query failed') as never);

      const res = await supertest(app)
        .get('/api/v1/goals/stats')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', TENANT_ID);

      expect(res.status).toBe(500);
    });
  });
});
