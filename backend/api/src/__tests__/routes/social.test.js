/**
 * social Routes - Comprehensive Behavioral Tests
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, resetFactories, DEFAULT_IDS } from '../factories/index.js';
const resolve = (rel) => new URL(rel, import.meta.url).pathname.replace(/\.js$/, '.ts');
const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
});
jest.unstable_mockModule(resolve('../../config/database.js'), () => ({
    pool: { query: mockQuery, connect: mockConnect },
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
// Mock withTransaction to execute the callback with a mock client
const mockTxClient = { query: mockClientQuery, release: mockClientRelease };
jest.unstable_mockModule(resolve('../../utils/transaction.js'), () => ({
    withTransaction: jest
        .fn()
        .mockImplementation(async (cb) => {
        return cb(mockTxClient);
    }),
}));
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/social.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const EMPLOYEE_ID = DEFAULT_IDS.EMPLOYEE_ID;
const POST_ID = '55555555-6666-7777-a888-999999999999';
const CLUB_ID = '66666666-7777-8888-a999-aaaaaaaaaaaa';
const COMMENT_ID = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/social', authMiddleware);
    app.use('/api/v1/social', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/social', routes);
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
describe('social Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });
    // =========================================================================
    // AUTH
    // =========================================================================
    describe('Authentication', () => {
        it('should return 401 without auth token', async () => {
            const res = await supertest(app).get('/api/v1/social/feed');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /feed
    // =========================================================================
    describe('GET /feed', () => {
        it('should return social feed with pagination', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    { id: POST_ID, content: 'Hello world', author_name: 'Mario Rossi', likes_count: 5 },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/social/feed')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].content).toBe('Hello world');
            expect(res.body.meta.total).toBe(10);
        });
        it('should apply filters', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 })
                .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/social/feed')
                .query({ post_type: 'announcement', visibility: 'all' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });
    // =========================================================================
    // GET /posts/:id
    // =========================================================================
    describe('GET /posts/:id', () => {
        it('should return 404 when post not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/social/posts/${POST_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return post with comments', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: POST_ID, content: 'Hello', author_name: 'Mario Rossi' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ id: COMMENT_ID, content: 'Nice!', author_name: 'Lucia Bianchi' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/social/posts/${POST_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.id).toBe(POST_ID);
            expect(res.body.data.comments).toHaveLength(1);
            expect(res.body.data.comments[0].content).toBe('Nice!');
        });
    });
    // =========================================================================
    // POST /posts
    // =========================================================================
    describe('POST /posts', () => {
        it('should return 400 when author_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/social/posts')
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'Hello' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when content missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/social/posts')
                .set('Authorization', `Bearer ${token}`)
                .send({ author_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create post with valid data', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: POST_ID, content: 'Hello world', author_id: EMPLOYEE_ID, post_type: 'update' },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/social/posts')
                .set('Authorization', `Bearer ${token}`)
                .send({ author_id: EMPLOYEE_ID, content: 'Hello world' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.content).toBe('Hello world');
        });
    });
    // =========================================================================
    // PATCH /posts/:id
    // =========================================================================
    describe('PATCH /posts/:id', () => {
        it('should return 404 when post not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/social/posts/${POST_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'Updated' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should update post content', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: POST_ID }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{ id: POST_ID, content: 'Updated content' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .patch(`/api/v1/social/posts/${POST_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'Updated content' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toMatch(/updated/i);
        });
    });
    // =========================================================================
    // DELETE /posts/:id
    // =========================================================================
    describe('DELETE /posts/:id', () => {
        it('should return 404 when post not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/social/posts/${POST_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should delete post successfully', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: POST_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/social/posts/${POST_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
    });
    // =========================================================================
    // POST /posts/:id/like
    // =========================================================================
    describe('POST /posts/:id/like', () => {
        it('should return 400 when employee_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 404 when post not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 409 when already liked', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: POST_ID }], rowCount: 1 }) // post exists
                .mockResolvedValueOnce({ rows: [{ id: 'like-1' }], rowCount: 1 }); // already liked
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/already liked/i);
        });
        it('should like a post successfully', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: POST_ID }], rowCount: 1 }) // post exists
                .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // not yet liked
            // withTransaction will use mockClientQuery
            mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/liked/i);
        });
    });
    // =========================================================================
    // DELETE /posts/:id/like
    // =========================================================================
    describe('DELETE /posts/:id/like', () => {
        it('should return 400 when employee_id missing', async () => {
            const res = await supertest(app)
                .delete(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/employee_id/i);
        });
        it('should return 404 when like not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should remove like successfully', async () => {
            mockClientQuery
                .mockResolvedValueOnce({ rows: [{ id: 'like-1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/social/posts/${POST_ID}/like`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/removed/i);
        });
    });
    // =========================================================================
    // POST /posts/:id/comments
    // =========================================================================
    describe('POST /posts/:id/comments', () => {
        it('should return 400 when author_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/comments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'Nice post!' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 404 when post not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/comments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ author_id: EMPLOYEE_ID, content: 'Nice!' });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should create comment successfully', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: POST_ID }], rowCount: 1 });
            mockClientQuery
                .mockResolvedValueOnce({ rows: [{ id: COMMENT_ID, content: 'Nice!' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/posts/${POST_ID}/comments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ author_id: EMPLOYEE_ID, content: 'Nice!' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(COMMENT_ID);
        });
    });
    // =========================================================================
    // GET /clubs
    // =========================================================================
    describe('GET /clubs', () => {
        it('should return clubs list', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: CLUB_ID, name: 'Running Club', members_count: 15, owner_name: 'Mario Rossi' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/social/clubs')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].name).toBe('Running Club');
            expect(res.body.count).toBe(1);
        });
    });
    // =========================================================================
    // GET /clubs/:id
    // =========================================================================
    describe('GET /clubs/:id', () => {
        it('should return 404 when club not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/social/clubs/${CLUB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return club with members', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: CLUB_ID, name: 'Running Club', owner_name: 'Mario' }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [{ employee_id: EMPLOYEE_ID, member_name: 'Lucia Bianchi', job_title: 'Analyst' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/social/clubs/${CLUB_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Running Club');
            expect(res.body.data.members).toHaveLength(1);
        });
    });
    // =========================================================================
    // POST /clubs
    // =========================================================================
    describe('POST /clubs', () => {
        it('should return 400 when name missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/social/clubs')
                .set('Authorization', `Bearer ${token}`)
                .send({ owner_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 400 when owner_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post('/api/v1/social/clubs')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Running Club' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should create club successfully', async () => {
            mockClientQuery
                .mockResolvedValueOnce({ rows: [{ id: CLUB_ID, name: 'Running Club' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/social/clubs')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Running Club', owner_id: EMPLOYEE_ID, category: 'sports' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.name).toBe('Running Club');
        });
    });
    // =========================================================================
    // POST /clubs/:id/join
    // =========================================================================
    describe('POST /clubs/:id/join', () => {
        it('should return 400 when employee_id missing (Zod)', async () => {
            const res = await supertest(app)
                .post(`/api/v1/social/clubs/${CLUB_ID}/join`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        });
        it('should return 404 when club not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/clubs/${CLUB_ID}/join`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 400 when club at max capacity', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: CLUB_ID, requires_approval: false, max_members: 10, members_count: 10 }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/social/clubs/${CLUB_ID}/join`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/maximum capacity/i);
        });
        it('should return 409 when already a member', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: CLUB_ID, requires_approval: false, max_members: null, members_count: 5 }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [{ id: 'membership-1' }], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/social/clubs/${CLUB_ID}/join`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/already a member/i);
        });
        it('should join club successfully', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: CLUB_ID, requires_approval: false, max_members: null, members_count: 5 }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/clubs/${CLUB_ID}/join`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/joined/i);
        });
        it('should submit join request when approval required', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ id: CLUB_ID, requires_approval: true, max_members: null, members_count: 5 }],
                rowCount: 1,
            })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/social/clubs/${CLUB_ID}/join`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/request submitted/i);
        });
    });
    // =========================================================================
    // DELETE /clubs/:id/leave
    // =========================================================================
    describe('DELETE /clubs/:id/leave', () => {
        it('should return 400 when employee_id missing', async () => {
            const res = await supertest(app)
                .delete(`/api/v1/social/clubs/${CLUB_ID}/leave`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/employee_id/i);
        });
        it('should return 404 when membership not found', async () => {
            mockClientQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/social/clubs/${CLUB_ID}/leave`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found|non trovato|cannot leave/i);
        });
        it('should leave club successfully', async () => {
            mockClientQuery
                .mockResolvedValueOnce({ rows: [{ id: 'membership-1' }], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/social/clubs/${CLUB_ID}/leave`)
                .set('Authorization', `Bearer ${token}`)
                .send({ employee_id: EMPLOYEE_ID });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/left club/i);
        });
    });
    // =========================================================================
    // GET /stats
    // =========================================================================
    describe('GET /stats', () => {
        it('should return social engagement statistics', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [
                    {
                        total_posts: '50',
                        posts_this_week: '5',
                        total_likes: '200',
                        total_comments: '80',
                        unique_authors: '20',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [
                    {
                        total_clubs: '8',
                        active_clubs: '6',
                        total_memberships: '120',
                        avg_members_per_club: '15.0',
                    },
                ],
                rowCount: 1,
            })
                .mockResolvedValueOnce({
                rows: [
                    {
                        id: POST_ID,
                        content: 'Top post',
                        likes_count: 15,
                        comments_count: 10,
                        author_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/social/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.posts.total_posts).toBe('50');
            expect(res.body.data.clubs.total_clubs).toBe('8');
            expect(res.body.data.top_posts).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=social.test.js.map