/**
 * Calibration Sessions Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for calibration session CRUD,
 * participant management, adjustments, distribution analysis, outlier detection,
 * and session workflow endpoints.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest
    .fn()
    .mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockQuery },
    appPool: { connect: mockConnect },
    testConnection: jest.fn().mockResolvedValue(true),
    testAppConnection: jest.fn().mockResolvedValue(true),
    closePool: jest.fn().mockResolvedValue(undefined),
    getAppClient: jest.fn(),
    withTenantClient: jest.fn(),
}));
jest.unstable_mockModule(resolve('../../config/redis.js'), () => ({
    getRedis: jest.fn(),
    isRedisReady: jest.fn().mockReturnValue(false),
    blacklistToken: jest.fn().mockResolvedValue(true),
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
    closeRedis: jest.fn().mockResolvedValue(undefined),
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
const mockPerfService = {
    getCalibrationSessionDetails: jest.fn(),
    createCalibrationSession: jest.fn(),
    addCalibrationParticipants: jest.fn(),
    completeCalibrationSession: jest.fn(),
    recordCalibrationAdjustment: jest.fn(),
};
jest.unstable_mockModule(resolve('../../services/performance-management.js'), () => ({
    performanceManagementService: mockPerfService,
}));
const { default: express } = await import('express');
const { default: calibrationRoutes } = await import('../../routes/calibration-sessions.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/calibration-sessions', authMiddleware);
    app.use('/api/v1/calibration-sessions', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = 'rtl-bank';
        req.tenant = { id: TENANT_ID, code: 'rtl-bank', name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/calibration-sessions', calibrationRoutes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res
            .status(status)
            .json({ success: false, error: err.message || 'Internal Server Error', code: err.code });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('Calibration Sessions Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.resetAllMocks();
        resetFactories();
        mockConnect.mockResolvedValue({ query: mockClientQuery, release: mockClientRelease });
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Authentication', () => {
        it('should return 401 when no token is provided', async () => {
            const res = await supertest(app).get('/api/v1/calibration-sessions');
            expect(res.status).toBe(401);
        });
        it('should return 401 with an invalid token', async () => {
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions')
                .set('Authorization', 'Bearer invalid-token');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /calibration-sessions/stats
    // =========================================================================
    describe('GET /calibration-sessions/stats', () => {
        it('should return session statistics', async () => {
            const statsRow = {
                total_sessions: '10',
                scheduled: '3',
                in_progress: '2',
                completed: '4',
                cancelled: '1',
                total_adjustments: '45',
                avg_rating_change: '0.35',
            };
            mockQuery.mockResolvedValueOnce({ rows: [statsRow], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total_sessions).toBe('10');
            expect(res.body.data.completed).toBe('4');
            expect(res.body.data.total_adjustments).toBe('45');
        });
    });
    // =========================================================================
    // GET /calibration-sessions
    // =========================================================================
    describe('GET /calibration-sessions', () => {
        it('should return paginated list of sessions', async () => {
            const sessions = [
                {
                    id: '22222222-2222-2222-2222-222222222222',
                    name: 'Q1 Calibration',
                    status: 'scheduled',
                    participant_count: '5',
                },
            ];
            mockQuery
                .mockResolvedValueOnce({ rows: sessions, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Q1 Calibration');
            expect(res.body.meta.total).toBe(1);
            expect(res.body.meta.limit).toBe(100);
        });
        it('should filter by status', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions?status=in_progress')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const call = mockQuery.mock.calls[0];
            expect(call[1]).toContain('in_progress');
        });
        it('should filter by review_cycle_id', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions?review_cycle_id=cycle-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            const call = mockQuery.mock.calls[0];
            expect(call[1]).toContain('cycle-1');
        });
    });
    // =========================================================================
    // GET /calibration-sessions/upcoming
    // =========================================================================
    describe('GET /calibration-sessions/upcoming', () => {
        it('should return upcoming scheduled sessions', async () => {
            const upcoming = [
                {
                    id: '22222222-2222-2222-2222-222222222222',
                    name: 'Next Week Calibration',
                    status: 'scheduled',
                    participant_count: '3',
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: upcoming, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/upcoming')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Next Week Calibration');
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id
    // =========================================================================
    describe('GET /calibration-sessions/:id', () => {
        it('should return a single session', async () => {
            const session = {
                id: '22222222-2222-2222-2222-222222222222',
                name: 'Q1 Calibration',
                status: 'scheduled',
                review_cycle_name: 'Annual Review 2026',
            };
            mockQuery.mockResolvedValueOnce({ rows: [session], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Q1 Calibration');
            expect(res.body.data.review_cycle_name).toBe('Annual Review 2026');
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/details
    // =========================================================================
    describe('GET /calibration-sessions/:id/details', () => {
        it('should return full session details via service', async () => {
            const details = {
                session: { id: '22222222-2222-2222-2222-222222222222', name: 'Q1 Cal' },
                participants: [],
                adjustments: [],
            };
            mockPerfService.getCalibrationSessionDetails.mockResolvedValueOnce(details);
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/details')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.session.name).toBe('Q1 Cal');
        });
        it('should return 404 when service returns no session', async () => {
            mockPerfService.getCalibrationSessionDetails.mockResolvedValueOnce({ session: null });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000/details')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /calibration-sessions
    // =========================================================================
    describe('POST /calibration-sessions', () => {
        it('should create a session and return 201', async () => {
            const created = { id: 'sess-new', name: 'New Session', status: 'scheduled' };
            mockPerfService.createCalibrationSession.mockResolvedValueOnce(created);
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Session' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('New Session');
            expect(res.body.message).toBe('Calibration session created');
        });
        it('should return 400 when name is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
    });
    // =========================================================================
    // PATCH /calibration-sessions/:id
    // =========================================================================
    describe('PATCH /calibration-sessions/:id', () => {
        it('should update a session', async () => {
            const existing = { id: '22222222-2222-2222-2222-222222222222', status: 'scheduled' };
            const updated = {
                id: '22222222-2222-2222-2222-222222222222',
                name: 'Updated',
                status: 'scheduled',
            };
            mockQuery
                .mockResolvedValueOnce({ rows: [existing], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Updated');
            expect(res.body.message).toBe('Calibration session updated');
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when no updatable fields', async () => {
            const existing = { id: '22222222-2222-2222-2222-222222222222', status: 'scheduled' };
            mockQuery.mockResolvedValueOnce({ rows: [existing], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No fields to update');
        });
    });
    // =========================================================================
    // DELETE /calibration-sessions/:id
    // =========================================================================
    describe('DELETE /calibration-sessions/:id', () => {
        it('should delete a non-completed session', async () => {
            // Status check uses req.dbClient (mockQuery)
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'scheduled' }], rowCount: 1 });
            // withTransaction uses appPool.connect() -> mockClientQuery for: BEGIN, set_config, delete participants, delete session, COMMIT
            mockClientQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // set_config tenant
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // delete participants
                .mockResolvedValueOnce({
                rows: [{ id: '22222222-2222-2222-2222-222222222222' }],
                rowCount: 1,
            }) // delete session
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Calibration session deleted');
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when session is completed', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completed' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Cannot delete a completed session');
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/participants
    // =========================================================================
    describe('GET /calibration-sessions/:id/participants', () => {
        it('should return participants grouped by role', async () => {
            const participants = [
                { id: 'p-1', role: 'facilitator', employee_name: 'Mario Rossi' },
                { id: 'p-2', role: 'calibrator', employee_name: 'Lucia Bianchi' },
            ];
            mockQuery.mockResolvedValueOnce({ rows: participants, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/participants')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.grouped).toBeDefined();
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/participants
    // =========================================================================
    describe('POST /calibration-sessions/:id/participants', () => {
        it('should add participants and return 201', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'scheduled' }], rowCount: 1 });
            mockPerfService.addCalibrationParticipants.mockResolvedValueOnce(3);
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/participants')
                .set('Authorization', `Bearer ${token}`)
                .send({
                participants: [
                    { manager_id: '11111111-2222-4333-a444-555555555555', role: 'calibrator' },
                    { manager_id: '22222222-3333-4444-a555-666666666666', role: 'subject' },
                    { manager_id: '33333333-4444-5555-a666-777777777777', role: 'facilitator' },
                ],
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.added_count).toBe(3);
        });
        it('should return 400 when participants array is empty', async () => {
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/participants')
                .set('Authorization', `Bearer ${token}`)
                .send({ participants: [] });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000/participants')
                .set('Authorization', `Bearer ${token}`)
                .send({
                participants: [
                    { manager_id: '11111111-2222-4333-a444-555555555555', role: 'calibrator' },
                ],
            });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when session is completed', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completed' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/participants')
                .set('Authorization', `Bearer ${token}`)
                .send({
                participants: [
                    { manager_id: '11111111-2222-4333-a444-555555555555', role: 'calibrator' },
                ],
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Cannot add participants to a completed session');
        });
    });
    // =========================================================================
    // DELETE /calibration-sessions/:id/participants/:participantId
    // =========================================================================
    describe('DELETE /calibration-sessions/:id/participants/:participantId', () => {
        it('should remove a participant', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/participants/p-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Participant removed');
        });
        it('should return 404 when participant not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/participants/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/start
    // =========================================================================
    describe('POST /calibration-sessions/:id/start', () => {
        it('should start a scheduled session with subjects', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ status: 'scheduled' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ id: '22222222-2222-2222-2222-222222222222', status: 'in_progress' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/start')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('in_progress');
            expect(res.body.message).toBe('Calibration session started');
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000/start')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when session is not scheduled', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'in_progress' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/start')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Only scheduled sessions can be started');
        });
        it('should return 400 when session has no subjects', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ status: 'scheduled' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/start')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Cannot start a session with no subjects');
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/complete
    // =========================================================================
    describe('POST /calibration-sessions/:id/complete', () => {
        it('should complete a session via service', async () => {
            const completed = { id: '22222222-2222-2222-2222-222222222222', status: 'completed' };
            mockPerfService.completeCalibrationSession.mockResolvedValueOnce(completed);
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/complete')
                .set('Authorization', `Bearer ${token}`)
                .send({ notes: 'All adjustments agreed' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Calibration session completed');
        });
        it('should return 400 when service cannot complete', async () => {
            mockPerfService.completeCalibrationSession.mockResolvedValueOnce(null);
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/complete')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Could not complete session. Check status.');
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/cancel
    // =========================================================================
    describe('POST /calibration-sessions/:id/cancel', () => {
        it('should cancel a non-completed session', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ status: 'scheduled' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ id: '22222222-2222-2222-2222-222222222222', status: 'cancelled' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/cancel')
                .set('Authorization', `Bearer ${token}`)
                .send({ reason: 'Manager unavailable' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Calibration session cancelled');
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000/cancel')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when session is completed', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completed' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/cancel')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Cannot cancel a completed session');
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/outliers
    // =========================================================================
    describe('GET /calibration-sessions/:id/outliers', () => {
        it('should return outliers with summary', async () => {
            const outliers = [
                { employee_id: 'emp-1', outlier_reason: 'high_variance', deviation: 2.5 },
                { employee_id: 'emp-2', outlier_reason: 'extreme_rating', deviation: 3.0 },
            ];
            mockQuery.mockResolvedValueOnce({ rows: outliers, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/outliers')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.summary.total_outliers).toBe(2);
            expect(res.body.summary.by_reason.high_variance).toBe(1);
            expect(res.body.threshold_used).toBe(2.0);
        });
        it('should accept custom threshold', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/outliers?threshold=1.5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.threshold_used).toBe(1.5);
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/flag-outlier
    // =========================================================================
    describe('POST /calibration-sessions/:id/flag-outlier', () => {
        it('should flag an adjustment as outlier', async () => {
            const flagged = { id: 'adj-1', outlier_flag: true, outlier_reason: 'high_variance' };
            mockQuery
                .mockResolvedValueOnce({ rows: [flagged], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/flag-outlier')
                .set('Authorization', `Bearer ${token}`)
                .send({
                adjustment_id: '11111111-2222-4333-a444-555555555555',
                outlier_reason: 'high_variance',
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Adjustment flagged as outlier');
        });
        it('should return 404 when adjustment not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/flag-outlier')
                .set('Authorization', `Bearer ${token}`)
                .send({ adjustment_id: '11111111-2222-4333-a444-555555555555' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when adjustment_id is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/flag-outlier')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/9box
    // =========================================================================
    describe('GET /calibration-sessions/:id/9box', () => {
        it('should return 9-box grid data', async () => {
            const employees = [
                { employee_id: 'emp-1', box_position: 9, final_rating: 4.8 },
                { employee_id: 'emp-2', box_position: 5, final_rating: 3.0 },
            ];
            mockQuery.mockResolvedValueOnce({ rows: employees, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/9box')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.employees).toHaveLength(2);
            expect(res.body.data.box_labels).toBeDefined();
            expect(res.body.data.box_labels[9]).toBe('Star');
            expect(res.body.data.summary.total_employees).toBe(2);
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/bell-curve
    // =========================================================================
    describe('GET /calibration-sessions/:id/bell-curve', () => {
        it('should return bell curve distribution', async () => {
            const rows = [
                { rating: '1', count: '2', percentage: '5', expected_percentage: '10' },
                { rating: '3', count: '20', percentage: '50', expected_percentage: '40' },
                { rating: '5', count: '8', percentage: '20', expected_percentage: '10' },
            ];
            mockQuery.mockResolvedValueOnce({ rows, rowCount: 3 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/bell-curve')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.distribution).toHaveLength(3);
            expect(res.body.data.total_employees).toBe(30);
            expect(typeof res.body.data.is_bell_curve_compliant).toBe('boolean');
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/audit-log
    // =========================================================================
    describe('GET /calibration-sessions/:id/audit-log', () => {
        it('should return audit log entries', async () => {
            const logs = [{ id: 'log-1', action_type: 'rating_adjusted', action_by_name: 'Mario Rossi' }];
            const counts = [{ action_type: 'rating_adjusted', count: '5' }];
            mockQuery
                .mockResolvedValueOnce({ rows: logs, rowCount: 1 })
                .mockResolvedValueOnce({ rows: counts, rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/audit-log')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.action_counts).toHaveLength(1);
        });
    });
    // =========================================================================
    // PATCH /calibration-sessions/:id/adjustments/:adjustmentId/notes
    // =========================================================================
    describe('PATCH /calibration-sessions/:id/adjustments/:adjustmentId/notes', () => {
        it('should update discussion notes', async () => {
            const oldNotes = { discussion_notes: 'old notes' };
            const updated = { id: 'adj-1', discussion_notes: 'updated notes' };
            mockQuery
                .mockResolvedValueOnce({ rows: [oldNotes], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [updated], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // audit log
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/adj-1/notes')
                .set('Authorization', `Bearer ${token}`)
                .send({ discussion_notes: 'updated notes' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.discussion_notes).toBe('updated notes');
            expect(res.body.message).toBe('Discussion notes updated');
        });
        it('should return 404 when adjustment not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/nonexistent/notes')
                .set('Authorization', `Bearer ${token}`)
                .send({ discussion_notes: 'new notes' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when discussion_notes is missing', async () => {
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/adj-1/notes')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/adjustments
    // =========================================================================
    describe('GET /calibration-sessions/:id/adjustments', () => {
        it('should return adjustments with summary', async () => {
            const adjustments = [
                { id: 'adj-1', employee_name: 'Mario Rossi', original_rating: 3.0, adjusted_rating: 3.5 },
            ];
            const summary = { total_adjustments: '1', upgrades: '1', downgrades: '0', unchanged: '0' };
            mockQuery
                .mockResolvedValueOnce({ rows: adjustments, rowCount: 1 })
                .mockResolvedValueOnce({ rows: [summary], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.summary.total_adjustments).toBe('1');
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/adjustments
    // =========================================================================
    describe('POST /calibration-sessions/:id/adjustments', () => {
        it('should record an adjustment when session is in progress', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'in_progress' }], rowCount: 1 });
            const adj = {
                id: 'adj-new',
                employee_id: 'emp-1',
                original_rating: 3.0,
                adjusted_rating: 3.5,
            };
            mockPerfService.recordCalibrationAdjustment.mockResolvedValueOnce(adj);
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments')
                .set('Authorization', `Bearer ${token}`)
                .send({
                employee_id: '11111111-2222-4333-a444-555555555555',
                original_rating: 3.0,
                adjusted_rating: 3.5,
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Adjustment recorded');
        });
        it('should return 400 when employee_id is missing', async () => {
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments')
                .set('Authorization', `Bearer ${token}`)
                .send({ original_rating: 3.0 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000/adjustments')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: '11111111-2222-4333-a444-555555555555' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when session is not in progress', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'scheduled' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments')
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: '11111111-2222-4333-a444-555555555555' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Can only record adjustments for in-progress sessions');
        });
    });
    // =========================================================================
    // PATCH /calibration-sessions/:id/adjustments/:adjustmentId
    // =========================================================================
    describe('PATCH /calibration-sessions/:id/adjustments/:adjustmentId', () => {
        it('should update an adjustment', async () => {
            const updated = { id: 'adj-1', adjusted_rating: 4.0, adjustment_reason: 'Manager consensus' };
            mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/adj-1')
                .set('Authorization', `Bearer ${token}`)
                .send({ adjusted_rating: 4.0, adjustment_reason: 'Manager consensus' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Adjustment updated');
        });
        it('should return 404 when adjustment not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/nonexistent')
                .set('Authorization', `Bearer ${token}`)
                .send({ adjusted_rating: 4.0 });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when no fields to update', async () => {
            const res = await supertest(app)
                .patch('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/adj-1')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No fields to update');
        });
    });
    // =========================================================================
    // DELETE /calibration-sessions/:id/adjustments/:adjustmentId
    // =========================================================================
    describe('DELETE /calibration-sessions/:id/adjustments/:adjustmentId', () => {
        it('should delete an adjustment', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'adj-1' }], rowCount: 1 });
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/adj-1')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Adjustment deleted');
        });
        it('should return 404 when adjustment not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/adjustments/nonexistent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /calibration-sessions/:id/distribution
    // =========================================================================
    describe('GET /calibration-sessions/:id/distribution', () => {
        it('should return original and adjusted distributions', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ rating: 3, count: '5' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ rating: 3.5, count: '5' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ department_name: 'IT', total: '3', avg_original: '3.0', avg_adjusted: '3.5' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/distribution')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.original_distribution).toHaveLength(1);
            expect(res.body.data.adjusted_distribution).toHaveLength(1);
            expect(res.body.data.by_org_unit).toHaveLength(1);
        });
    });
    // =========================================================================
    // POST /calibration-sessions/:id/apply-adjustments
    // =========================================================================
    describe('POST /calibration-sessions/:id/apply-adjustments', () => {
        it('should apply adjustments from a completed session', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ status: 'completed' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ id: 'adj-1', performance_review_id: 'pr-1', adjusted_rating: 4.0 }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // update performance reviews
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // mark applied
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/apply-adjustments')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.applied_count).toBe(1);
        });
        it('should return 404 when session not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/00000000-0000-0000-0000-000000000000/apply-adjustments')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when session is not completed', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'in_progress' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/calibration-sessions/22222222-2222-2222-2222-222222222222/apply-adjustments')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Can only apply adjustments from completed sessions');
        });
    });
    // =========================================================================
    // Error handling
    // =========================================================================
    describe('Error Handling', () => {
        it('should return 500 when database fails on GET /stats', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/calibration-sessions/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=calibration-sessions.test.js.map