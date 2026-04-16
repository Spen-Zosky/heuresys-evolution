/**
 * Career Coach Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for career coach profile,
 * skills, goals, milestones, paths, recommendations, and analytics endpoints.
 * This route uses pool directly (not req.dbClient).
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
const { default: careerCoachRoutes } = await import('../../routes/career-coach.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const { createErrorMiddleware } = await import('../../errors/middleware.js');
const supertest = (await import('supertest')).default;

const TENANT_ID = DEFAULT_IDS.TENANT_ID;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/career-coach', authMiddleware);
  app.use('/api/v1/career-coach', (req, _res, next) => {
    req.tenantId = TENANT_ID;
    req.tenantCode = 'rtl-bank';
    req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
    req.dbClient = { query: mockQuery } as never;
    next();
  });
  app.use('/api/v1/career-coach', careerCoachRoutes);
  app.use(createErrorMiddleware({ enableConsoleLogging: false }));
  return app;
}

function createSysadminToken() {
  return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}

describe('Career Coach Routes', () => {
  let app: Express;
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();
    resetFactories();
    app = createTestApp();
    token = createSysadminToken();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // =========================================================================
  // AUTH
  // =========================================================================
  describe('Authentication', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await supertest(app).get('/api/v1/career-coach/profile');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /career-coach/profile
  // =========================================================================
  describe('GET /career-coach/profile', () => {
    it('should return career profile with skills and goals', async () => {
      const employee = {
        id: 'emp-1',
        first_name: 'Mario',
        last_name: 'Rossi',
        job_title: 'Software Developer',
        org_unit_id: 'dept-1',
      };
      const profile = {
        id: 'prof-1',
        career_aspiration: 'Senior Dev',
        mobility_preference: 'local',
        last_assessment_date: '2026-01-15',
      };
      const skills = [
        { id: 's-1', skill_name: 'TypeScript', proficiency: 4, source: 'self', validated_at: null },
      ];
      const goals = [
        {
          id: 'g-1',
          target_role: 'Tech Lead',
          status: 'active',
          total_milestones: '3',
          completed_milestones: '1',
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [employee], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [profile], rowCount: 1 })
        .mockResolvedValueOnce({ rows: skills, rowCount: 1 })
        .mockResolvedValueOnce({ rows: goals, rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee.name).toBe('Mario Rossi');
      expect(res.body.data.profile.career_aspiration).toBe('Senior Dev');
      expect(res.body.data.skills).toHaveLength(1);
      expect(res.body.data.goals).toHaveLength(1);
    });

    it('should return admin mode when TENANT_OWNER has no employee record', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Route checks for SUPERUSER or TENANT_OWNER (SYSADMIN is legacy alias not matched)
      const ownerToken = generateToken(
        buildSysadminTokenPayload({ tenantId: TENANT_ID, role: 'TENANT_OWNER' })
      );

      const res = await supertest(app)
        .get('/api/v1/career-coach/profile')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_admin).toBe(true);
    });

    it('should create profile if it does not exist', async () => {
      const employee = {
        id: 'emp-1',
        first_name: 'Mario',
        last_name: 'Rossi',
        job_title: 'Dev',
        org_unit_id: null,
      };
      const newProfile = {
        id: 'prof-new',
        career_aspiration: null,
        mobility_preference: null,
        last_assessment_date: null,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [employee], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // no existing profile
        .mockResolvedValueOnce({ rows: [newProfile], rowCount: 1 }) // create profile
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // skills
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // goals

      const res = await supertest(app)
        .get('/api/v1/career-coach/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profile.id).toBe('prof-new');
    });
  });

  // =========================================================================
  // PUT /career-coach/profile
  // =========================================================================
  describe('PUT /career-coach/profile', () => {
    it('should update career profile', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'emp-1' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .put('/api/v1/career-coach/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ career_aspiration: 'CTO', mobility_preference: 'international' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when employee not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .put('/api/v1/career-coach/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ career_aspiration: 'CTO' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // GET /career-coach/skills
  // =========================================================================
  describe('GET /career-coach/skills', () => {
    it('should return user skills', async () => {
      const skills = [
        { id: 's-1', skill_name: 'TypeScript', proficiency: 4 },
        { id: 's-2', skill_name: 'React', proficiency: 3 },
      ];
      mockQuery.mockResolvedValueOnce({ rows: skills, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/skills')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].skill_name).toBe('TypeScript');
    });
  });

  // =========================================================================
  // POST /career-coach/skills
  // =========================================================================
  describe('POST /career-coach/skills', () => {
    it('should add a skill and return 201', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prof-1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: 's-new', skill_name: 'Python', proficiency: 3 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // update assessment date

      const res = await supertest(app)
        .post('/api/v1/career-coach/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_name: 'Python', proficiency: 3 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.skill_name).toBe('Python');
    });

    it('should return 400 when skill_name is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/career-coach/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ proficiency: 3 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when career profile not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/career-coach/skills')
        .set('Authorization', `Bearer ${token}`)
        .send({ skill_name: 'Python', proficiency: 3 });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // DELETE /career-coach/skills/:id
  // =========================================================================
  describe('DELETE /career-coach/skills/:id', () => {
    it('should delete a skill', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .delete('/api/v1/career-coach/skills/s-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // GET /career-coach/paths
  // =========================================================================
  describe('GET /career-coach/paths', () => {
    it('should return available career paths with current role', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ job_title: 'Software Developer' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'path-1',
              name: 'Dev to Tech Lead',
              from_role: 'Developer',
              to_role: 'Tech Lead',
              estimated_months: 24,
              success_rate: 0.75,
            },
          ],
          rowCount: 1,
        });

      const res = await supertest(app)
        .get('/api/v1/career-coach/paths')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.current_role).toBe('Software Developer');
      expect(res.body.data.paths).toHaveLength(1);
      expect(res.body.data.paths[0].to_role).toBe('Tech Lead');
    });
  });

  // =========================================================================
  // GET /career-coach/goals
  // =========================================================================
  describe('GET /career-coach/goals', () => {
    it('should return career goals with milestones', async () => {
      const goals = [
        {
          id: 'g-1',
          target_role: 'Tech Lead',
          status: 'active',
          milestones: [{ id: 'm-1', title: 'Pass cert' }],
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: goals, rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/goals')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].target_role).toBe('Tech Lead');
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/goals?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const call = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(call[1]).toContain('active');
    });
  });

  // =========================================================================
  // POST /career-coach/goals
  // =========================================================================
  describe('POST /career-coach/goals', () => {
    it('should create a career goal and return 201', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'prof-1' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: 'g-new', target_role: 'Tech Lead', status: 'active' }],
          rowCount: 1,
        });

      const res = await supertest(app)
        .post('/api/v1/career-coach/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ target_role: 'Tech Lead', target_date: '2027-01-01', motivation: 'Career growth' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.target_role).toBe('Tech Lead');
    });

    it('should return 400 when target_role is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/career-coach/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ motivation: 'Growth' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when profile not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/career-coach/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ target_role: 'Tech Lead' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found|non trovato/i);
    });
  });

  // =========================================================================
  // PUT /career-coach/goals/:id
  // =========================================================================
  describe('PUT /career-coach/goals/:id', () => {
    it('should update a career goal', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .put('/api/v1/career-coach/goals/g-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // POST /career-coach/goals/:id/milestones
  // =========================================================================
  describe('POST /career-coach/goals/:id/milestones', () => {
    it('should add a milestone and return 201', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ next_seq: 0 }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ id: 'm-new', title: 'Pass AWS Cert', type: 'action' }],
          rowCount: 1,
        });

      const res = await supertest(app)
        .post('/api/v1/career-coach/goals/g-1/milestones')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Pass AWS Cert', type: 'action' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Pass AWS Cert');
    });

    it('should return 400 when title is missing', async () => {
      const res = await supertest(app)
        .post('/api/v1/career-coach/goals/g-1/milestones')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'action' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // PUT /career-coach/milestones/:id/complete
  // =========================================================================
  describe('PUT /career-coach/milestones/:id/complete', () => {
    it('should mark milestone as complete', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .put('/api/v1/career-coach/milestones/m-1/complete')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // GET /career-coach/recommendations
  // =========================================================================
  describe('GET /career-coach/recommendations', () => {
    it('should return grouped recommendations', async () => {
      const profile = { id: 'prof-1', job_title: 'Developer' };
      const recs = [
        {
          id: 'r-1',
          type: 'course',
          title: 'AWS Fundamentals',
          relevance_score: 0.9,
          is_dismissed: false,
        },
        { id: 'r-2', type: 'skill', title: 'Docker', relevance_score: 0.8, is_dismissed: false },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [profile], rowCount: 1 })
        .mockResolvedValueOnce({ rows: recs, rowCount: 2 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courses).toBeDefined();
      expect(res.body.data.skills).toBeDefined();
    });

    it('should return empty groups when no profile found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.courses).toEqual([]);
      expect(res.body.data.skills).toEqual([]);
    });
  });

  // =========================================================================
  // POST /career-coach/recommendations/:id/dismiss
  // =========================================================================
  describe('POST /career-coach/recommendations/:id/dismiss', () => {
    it('should dismiss a recommendation', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await supertest(app)
        .post('/api/v1/career-coach/recommendations/r-1/dismiss')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // GET /career-coach/analytics
  // =========================================================================
  describe('GET /career-coach/analytics', () => {
    it('should return analytics dashboard data', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total_profiles: '50', assessed_profiles: '30' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            {
              total_goals: '100',
              active_goals: '40',
              completed_goals: '35',
              paused_goals: '15',
              abandoned_goals: '10',
              avg_progress: '65',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [{ name: 'TypeScript', count: '25' }], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ month: 'Jan', goals: '10', completed: '5' }],
          rowCount: 1,
        });

      const res = await supertest(app)
        .get('/api/v1/career-coach/analytics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProfiles).toBe(50);
      expect(res.body.data.activeGoals).toBe(40);
      expect(res.body.data.goalsByStatus).toBeDefined();
      expect(res.body.data.topSkills).toBeDefined();
    });
  });

  // =========================================================================
  // GET /career-coach/stats
  // =========================================================================
  describe('GET /career-coach/stats', () => {
    it('should return personal career stats', async () => {
      const stats = {
        skills_count: '8',
        active_goals: '2',
        completed_goals: '3',
        avg_progress: '72',
      };
      const milestones = [
        { title: 'Complete cert', due_date: '2026-06-01', target_role: 'Tech Lead' },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [stats], rowCount: 1 })
        .mockResolvedValueOnce({ rows: milestones, rowCount: 1 });

      const res = await supertest(app)
        .get('/api/v1/career-coach/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.skills_count).toBe('8');
      expect(res.body.data.upcoming_milestones).toHaveLength(1);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe('Error Handling', () => {
    it('should return 500 when database fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      const res = await supertest(app)
        .get('/api/v1/career-coach/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
