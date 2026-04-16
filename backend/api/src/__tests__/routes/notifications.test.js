/**
 * notifications Routes - Comprehensive Behavioral Tests
 * Tests for: GET /stats, GET /unread, GET /, GET /:id, POST /,
 *   PATCH /:id/read, POST /mark-all-read, DELETE /:id,
 *   GET /my/unread-count, POST /my/:id/read, POST /my/mark-all-read,
 *   DELETE /my/:id, GET /my/preferences, PUT /my/preferences,
 *   GET /preferences/:userId, PUT /preferences/:userId
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
const { default: express } = await import('express');
const { default: routes } = await import('../../routes/notifications.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const USER_ID = DEFAULT_IDS.USER_ID;
const NOTIF_ID = '11111111-2222-3333-4444-555555555555';
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    app.use('/api/v1/notifications', authMiddleware);
    app.use('/api/v1/notifications', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        if (req.user) {
            req.user.id = req.user.userId || USER_ID;
        }
        next();
    });
    app.use('/api/v1/notifications', routes);
    app.use((err, _req, res, _next) => {
        const status = err.statusCode || err.httpStatus || 500;
        res.status(status).json({
            success: false,
            error: err.message || 'Internal Server Error',
            code: err.code,
        });
    });
    return app;
}
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
describe('notifications Routes', () => {
    let app;
    let token;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
        token = createSysadminToken();
    });
    // =========================================================================
    // AUTH ENFORCEMENT
    // =========================================================================
    describe('Auth enforcement', () => {
        it('should return 401 when no token is provided', async () => {
            const res = await supertest(app).get('/api/v1/notifications');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // GET /stats
    // =========================================================================
    describe('GET /stats', () => {
        it('should return notification statistics', async () => {
            const stats = {
                total: '50',
                unread: '12',
                read_count: '38',
                high_priority: '5',
                urgent: '2',
                notification_types: '4',
            };
            mockQuery.mockResolvedValueOnce({ rows: [stats], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/notifications/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.total).toBe('50');
            expect(res.body.data.unread).toBe('12');
            expect(res.body.data.urgent).toBe('2');
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/notifications/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /unread
    // =========================================================================
    describe('GET /unread', () => {
        it('should return unread notifications', async () => {
            const notifs = [
                {
                    id: 'n1',
                    type: 'reminder',
                    title: 'Check-in due',
                    message: 'Your check-in is pending',
                    read: false,
                },
                {
                    id: 'n2',
                    type: 'alert',
                    title: 'Flight risk detected',
                    message: 'Employee risk alert',
                    read: false,
                },
            ];
            mockQuery.mockResolvedValueOnce({ rows: notifs, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/notifications/unread')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.count).toBe(2);
        });
        it('should filter by user_id', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'n1', title: 'User notification' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get(`/api/v1/notifications/unread?user_id=${USER_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should accept custom limit', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/notifications/unread?limit=5')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /
    // =========================================================================
    describe('GET /', () => {
        it('should return all notifications with pagination meta', async () => {
            const notifs = [
                { id: 'n1', type: 'system', title: 'System update', read: true },
                { id: 'n2', type: 'reminder', title: 'Goal due', read: false },
            ];
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '15' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: notifs, rowCount: 2 });
            const res = await supertest(app)
                .get('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta.total).toBe(15);
            expect(res.body.meta.limit).toBe(50);
            expect(res.body.meta.offset).toBe(0);
        });
        it('should filter by type', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', type: 'alert' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/notifications?type=alert')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by priority', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '3' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', priority: 'urgent' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/notifications?priority=urgent')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should filter by read status', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '5' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', read: false }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/notifications?read=false')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /:id
    // =========================================================================
    describe('GET /:id', () => {
        it('should return notification by id', async () => {
            const notif = {
                id: NOTIF_ID,
                type: 'reminder',
                title: 'Check-in due',
                message: 'Pending',
                read: false,
            };
            mockQuery.mockResolvedValueOnce({ rows: [notif], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/notifications/${NOTIF_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(NOTIF_ID);
            expect(res.body.data.title).toBe('Check-in due');
        });
        it('should return 404 when notification not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/notifications/${NOTIF_ID}`)
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
        it('should create notification with valid data', async () => {
            const newNotif = {
                id: NOTIF_ID,
                type: 'reminder',
                title: 'New Reminder',
                message: 'Check your goals',
                priority: 'normal',
                read: false,
            };
            mockQuery.mockResolvedValueOnce({ rows: [newNotif], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ type: 'reminder', title: 'New Reminder', message: 'Check your goals' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('New Reminder');
            expect(res.body.message).toBe('Notification created');
        });
        it('should return 400 when type is missing (Zod validation)', async () => {
            const res = await supertest(app)
                .post('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'No type', message: 'Missing type field' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 400 when title is missing (Zod validation)', async () => {
            const res = await supertest(app)
                .post('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ type: 'alert', message: 'Missing title field' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when message is missing (Zod validation)', async () => {
            const res = await supertest(app)
                .post('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ type: 'alert', title: 'Alert Title' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should create notification with optional fields', async () => {
            const newNotif = {
                id: NOTIF_ID,
                type: 'alert',
                title: 'Full Alert',
                message: 'Details',
                priority: 'high',
                action_url: '/dashboard',
            };
            mockQuery.mockResolvedValueOnce({ rows: [newNotif], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`)
                .send({
                type: 'alert',
                title: 'Full Alert',
                message: 'Details',
                priority: 'high',
                action_url: '/dashboard',
                action_label: 'View Dashboard',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Insert failed'));
            const res = await supertest(app)
                .post('/api/v1/notifications')
                .set('Authorization', `Bearer ${token}`)
                .send({ type: 'reminder', title: 'Fail', message: 'This will fail' });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // PATCH /:id/read
    // =========================================================================
    describe('PATCH /:id/read', () => {
        it('should mark notification as read', async () => {
            const updated = { id: NOTIF_ID, read: true, read_at: '2025-01-15T10:00:00Z' };
            mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .patch(`/api/v1/notifications/${NOTIF_ID}/read`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.read).toBe(true);
            expect(res.body.message).toBe('Notification marked as read');
        });
        it('should return 404 when notification not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .patch(`/api/v1/notifications/${NOTIF_ID}/read`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /mark-all-read
    // =========================================================================
    describe('POST /mark-all-read', () => {
        it('should mark all notifications as read', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
                rowCount: 3,
            });
            const res = await supertest(app)
                .post('/api/v1/notifications/mark-all-read')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('3 notifications marked as read');
        });
        it('should mark only user notifications when user_id provided', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1' }], rowCount: 1 });
            const res = await supertest(app)
                .post('/api/v1/notifications/mark-all-read')
                .set('Authorization', `Bearer ${token}`)
                .send({ user_id: USER_ID });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('1 notifications marked as read');
        });
        it('should handle zero unread notifications', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post('/api/v1/notifications/mark-all-read')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('0 notifications marked as read');
        });
    });
    // =========================================================================
    // DELETE /:id
    // =========================================================================
    describe('DELETE /:id', () => {
        it('should delete notification', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: NOTIF_ID }], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/notifications/${NOTIF_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Notification deleted');
        });
        it('should return 404 when notification not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .delete(`/api/v1/notifications/${NOTIF_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /my/unread-count
    // =========================================================================
    describe('GET /my/unread-count', () => {
        it('should return unread count for current user', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/notifications/my/unread-count')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.count).toBe(5);
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/notifications/my/unread-count')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /my/:id/read
    // =========================================================================
    describe('POST /my/:id/read', () => {
        it('should mark own notification as read', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/notifications/my/${NOTIF_ID}/read`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.read).toBe(true);
        });
    });
    // =========================================================================
    // POST /my/mark-all-read
    // =========================================================================
    describe('POST /my/mark-all-read', () => {
        it('should mark all own notifications as read', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 7 });
            const res = await supertest(app)
                .post('/api/v1/notifications/my/mark-all-read')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.updated).toBe(7);
        });
    });
    // =========================================================================
    // DELETE /my/:id
    // =========================================================================
    describe('DELETE /my/:id', () => {
        it('should delete own notification', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .delete(`/api/v1/notifications/my/${NOTIF_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
    // =========================================================================
    // GET /my/preferences
    // =========================================================================
    describe('GET /my/preferences', () => {
        it('should return existing preferences', async () => {
            const prefs = {
                user_id: USER_ID,
                email_enabled: true,
                in_app_enabled: false,
                goal_reminders: true,
            };
            mockQuery.mockResolvedValueOnce({ rows: [prefs], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/notifications/my/preferences')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.email_enabled).toBe(true);
            expect(res.body.data.in_app_enabled).toBe(false);
        });
        it('should return defaults when no preferences exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/notifications/my/preferences')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.email_enabled).toBe(true);
            expect(res.body.data.in_app_enabled).toBe(true);
            expect(res.body.data.goal_reminders).toBe(true);
            expect(res.body.data.system_notifications).toBe(true);
        });
    });
    // =========================================================================
    // PUT /my/preferences
    // =========================================================================
    describe('PUT /my/preferences', () => {
        it('should update notification preferences', async () => {
            const updated = { user_id: USER_ID, email_enabled: false, in_app_enabled: true };
            mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .put('/api/v1/notifications/my/preferences')
                .set('Authorization', `Bearer ${token}`)
                .send({ email_enabled: false, in_app_enabled: true });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.email_enabled).toBe(false);
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Upsert failed'));
            const res = await supertest(app)
                .put('/api/v1/notifications/my/preferences')
                .set('Authorization', `Bearer ${token}`)
                .send({ email_enabled: true });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /preferences/:userId
    // =========================================================================
    describe('GET /preferences/:userId', () => {
        it('should return preferences for a user', async () => {
            const prefs = { user_id: USER_ID, email_enabled: true, in_app_enabled: true };
            mockQuery.mockResolvedValueOnce({ rows: [prefs], rowCount: 1 });
            const res = await supertest(app)
                .get(`/api/v1/notifications/preferences/${USER_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user_id).toBe(USER_ID);
        });
        it('should return defaults when no preferences exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/notifications/preferences/${USER_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user_id).toBe(USER_ID);
            expect(res.body.data.email_enabled).toBe(true);
        });
    });
    // =========================================================================
    // PUT /preferences/:userId
    // =========================================================================
    describe('PUT /preferences/:userId', () => {
        it('should upsert preferences for a user', async () => {
            const updated = { user_id: USER_ID, email_enabled: false, goal_reminders: false };
            mockQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
            const res = await supertest(app)
                .put(`/api/v1/notifications/preferences/${USER_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ email_enabled: false, goal_reminders: false });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.email_enabled).toBe(false);
            expect(res.body.message).toBe('Preferences updated');
        });
        it('should return 500 on database error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Upsert failed'));
            const res = await supertest(app)
                .put(`/api/v1/notifications/preferences/${USER_ID}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ email_enabled: true });
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
//# sourceMappingURL=notifications.test.js.map