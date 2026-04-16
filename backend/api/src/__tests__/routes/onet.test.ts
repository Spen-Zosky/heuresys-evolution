/**
 * O*NET Routes - Unit Tests
 * Tests HTTP behavior for O*NET occupational data endpoints.
 * Note: O*NET routes use req.dbClient and some use ONetImportService.
 *
 * Endpoints tested:
 *  GET    /stats                      - Database statistics
 *  POST   /import/jobs                - Create import job (Zod)
 *  GET    /import/jobs                - List import jobs
 *  GET    /import/jobs/:jobId         - Get job status
 *  POST   /import/jobs/:jobId/execute - Execute import (Zod)
 *  POST   /map-to-esco               - Map skills to ESCO (Zod)
 *  GET    /occupations                - List occupations
 *  GET    /occupations/search         - Search occupations
 *  GET    /occupations/:id            - Get occupation
 *  GET    /occupations/:id/skills     - Skills for occupation
 *  GET    /skills                     - List skills
 *  GET    /skills/:id/occupations     - Occupations for skill
 *  GET    /unified-skills             - Unified skills view
 *  GET    /abilities                  - List abilities
 *  GET    /knowledge                  - List knowledge
 *  GET    /work-activities            - List work activities
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Express } from 'express';

const resolve = (rel: string) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
  pool: { query: mockPoolQuery },
  appPool: { connect: jest.fn() },
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

const mockGetStats = jest.fn();
const mockCreateImportJob = jest.fn();
const mockListImportJobs = jest.fn();
const mockGetImportJobStatus = jest.fn();
const mockImportOccupations = jest.fn();
const mockMapSkillsToEsco = jest.fn();
const mockSearchOccupations = jest.fn();
const mockGetSkillsForOccupation = jest.fn();
const mockGetOccupationsBySkill = jest.fn();
const mockGetUnifiedSkills = jest.fn();

jest.unstable_mockModule(resolve('../../services/onet-import.js'), () => ({
  ONetImportService: jest.fn().mockImplementation(() => ({
    getStats: mockGetStats,
    createImportJob: mockCreateImportJob,
    listImportJobs: mockListImportJobs,
    getImportJobStatus: mockGetImportJobStatus,
    importOccupations: mockImportOccupations,
    mapSkillsToEsco: mockMapSkillsToEsco,
    searchOccupations: mockSearchOccupations,
    getSkillsForOccupation: mockGetSkillsForOccupation,
    getOccupationsBySkill: mockGetOccupationsBySkill,
    getUnifiedSkills: mockGetUnifiedSkills,
  })),
}));

const { default: express } = await import('express');
const { default: routes } = await import('../../routes/onet.js');
const supertest = (await import('supertest')).default;

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/onet', (req, _res, next) => {
    (req as any).dbClient = { query: mockPoolQuery, release: jest.fn() };
    next();
  });
  app.use('/api/v1/onet', routes);
  app.use(
    (
      err: { statusCode?: number; message?: string },
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

describe('onet Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ── GET /stats ────────────────────────────────────────────────────────

  it('GET /stats returns 200 with stats', async () => {
    mockGetStats.mockResolvedValueOnce({ occupations: 974, skills: 120 });
    const res = await supertest(app).get('/api/v1/onet/stats');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('occupations');
  });

  it('GET /stats returns 500 on service error', async () => {
    mockGetStats.mockRejectedValueOnce(new Error('Service error'));
    const res = await supertest(app).get('/api/v1/onet/stats');
    expect(res.status).toBe(500);
  });

  // ── POST /import/jobs ─────────────────────────────────────────────────

  it('POST /import/jobs returns 400 on Zod validation (missing import_type)', async () => {
    const res = await supertest(app).post('/api/v1/onet/import/jobs').send({});
    expect(res.status).toBe(400);
  });

  it('POST /import/jobs returns 400 on invalid import_type', async () => {
    const res = await supertest(app)
      .post('/api/v1/onet/import/jobs')
      .send({ import_type: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('POST /import/jobs returns 201 on success', async () => {
    mockCreateImportJob.mockResolvedValueOnce({
      id: 'job-1',
      import_type: 'occupations',
      status: 'pending',
    });
    const res = await supertest(app)
      .post('/api/v1/onet/import/jobs')
      .send({ import_type: 'occupations' });
    expect(res.status).toBe(201);
    expect(res.body.data.import_type).toBe('occupations');
  });

  // ── GET /import/jobs ──────────────────────────────────────────────────

  it('GET /import/jobs returns 200', async () => {
    mockListImportJobs.mockResolvedValueOnce({ jobs: [{ id: 'job-1' }], total: 1 });
    const res = await supertest(app).get('/api/v1/onet/import/jobs');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /import/jobs/:jobId ───────────────────────────────────────────

  it('GET /import/jobs/:jobId returns 200', async () => {
    mockGetImportJobStatus.mockResolvedValueOnce({ id: 'job-1', status: 'completed' });
    const res = await supertest(app).get('/api/v1/onet/import/jobs/job-1');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('GET /import/jobs/:jobId returns 404', async () => {
    mockGetImportJobStatus.mockResolvedValueOnce(null);
    const res = await supertest(app).get('/api/v1/onet/import/jobs/nonexistent');
    expect(res.status).toBe(404);
  });

  // ── GET /occupations ──────────────────────────────────────────────────

  it('GET /occupations returns 200 with list', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'occ-1', title: 'Software Engineer' }], rowCount: 1 });
    const res = await supertest(app).get('/api/v1/onet/occupations');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /occupations/search ───────────────────────────────────────────

  it('GET /occupations/search returns 400 when query too short', async () => {
    const res = await supertest(app).get('/api/v1/onet/occupations/search?q=a');
    expect(res.status).toBe(400);
  });

  it('GET /occupations/search returns 200 with results', async () => {
    mockSearchOccupations.mockResolvedValueOnce([{ id: 'occ-1', title: 'Software Engineer' }]);
    const res = await supertest(app).get('/api/v1/onet/occupations/search?q=software');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /occupations/:id ──────────────────────────────────────────────

  it('GET /occupations/:id returns 200', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: 'occ-1', title: 'Software Engineer' }],
      rowCount: 1,
    });
    const res = await supertest(app).get('/api/v1/onet/occupations/occ-1');
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Software Engineer');
  });

  it('GET /occupations/:id returns 404', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app).get('/api/v1/onet/occupations/nonexistent');
    expect(res.status).toBe(404);
  });

  // ── GET /occupations/:id/skills ───────────────────────────────────────

  it('GET /occupations/:id/skills returns 404 when occupation not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app).get('/api/v1/onet/occupations/nonexistent/skills');
    expect(res.status).toBe(404);
  });

  it('GET /occupations/:id/skills returns 200', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: 'occ-1' }], rowCount: 1 });
    mockGetSkillsForOccupation.mockResolvedValueOnce([{ id: 'sk-1', name: 'Programming' }]);
    const res = await supertest(app).get('/api/v1/onet/occupations/occ-1/skills');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /skills ───────────────────────────────────────────────────────

  it('GET /skills returns 200', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'sk-1', element_name: 'Programming' }], rowCount: 1 });
    const res = await supertest(app).get('/api/v1/onet/skills');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /skills/:id/occupations ───────────────────────────────────────

  it('GET /skills/:id/occupations returns 404 when skill not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await supertest(app).get('/api/v1/onet/skills/nonexistent/occupations');
    expect(res.status).toBe(404);
  });

  // ── GET /abilities ────────────────────────────────────────────────────

  it('GET /abilities returns 200', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 'ab-1', element_name: 'Manual Dexterity' }],
        rowCount: 1,
      });
    const res = await supertest(app).get('/api/v1/onet/abilities');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /knowledge ────────────────────────────────────────────────────

  it('GET /knowledge returns 200', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'kn-1', element_name: 'Mathematics' }], rowCount: 1 });
    const res = await supertest(app).get('/api/v1/onet/knowledge');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── GET /work-activities ──────────────────────────────────────────────

  it('GET /work-activities returns 200', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{ id: 'wa-1', element_name: 'Analyzing Data' }],
        rowCount: 1,
      });
    const res = await supertest(app).get('/api/v1/onet/work-activities');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  // ── POST /map-to-esco ─────────────────────────────────────────────────

  it('POST /map-to-esco returns 200', async () => {
    mockMapSkillsToEsco.mockResolvedValueOnce({ mapped: 50, total: 120 });
    const res = await supertest(app)
      .post('/api/v1/onet/map-to-esco')
      .send({ confidence_threshold: 0.7 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('mapped');
  });
});
