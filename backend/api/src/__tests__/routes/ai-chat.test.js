/**
 * AI Chat Routes - Behavioral Tests
 * Tests actual HTTP request/response behavior for AI chat session, message,
 * escalation, and analytics endpoints.
 * All external dependencies (database, redis, AI orchestrator) are mocked.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { buildSysadminTokenPayload, buildEmployeeTokenPayload, resetFactories, DEFAULT_IDS, } from '../factories/index.js';
// ---------------------------------------------------------------------------
// Mock external modules BEFORE any application imports
// ---------------------------------------------------------------------------
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
// Mock AI orchestrator service
const mockChatCompletion = jest.fn();
const mockRetrieveContext = jest.fn();
const mockCreateEscalation = jest.fn();
jest.unstable_mockModule(resolve('../../services/ai-orchestrator.js'), () => ({
    createAIOrchestrator: jest.fn().mockReturnValue({
        chatCompletion: mockChatCompletion,
        retrieveContext: mockRetrieveContext,
        createEscalation: mockCreateEscalation,
    }),
    ChatMessage: {},
}));
// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks are registered
// ---------------------------------------------------------------------------
const { default: express } = await import('express');
const { default: aiChatRoutes } = await import('../../routes/ai-chat.js');
const { generateToken, authMiddleware } = await import('../../middleware/auth.js');
const supertest = (await import('supertest')).default;
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TENANT_ID = DEFAULT_IDS.TENANT_ID;
const TENANT_CODE = 'rtl-bank';
const SESSION_ID = '55555555-6666-7777-a888-999999999999';
const MESSAGE_ID = '66666666-7777-8888-a999-aaaaaaaaaaaa';
const ESCALATION_ID = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.requestId = 'test-request-id';
        next();
    });
    // Set tenant context BEFORE routes (requireTenant is inside the router)
    app.use('/api/v1/ai-chat', (req, _res, next) => {
        req.tenantId = TENANT_ID;
        req.tenantCode = TENANT_CODE;
        req.tenant = { id: TENANT_ID, code: TENANT_CODE, name: 'RTL Bank', status: 'active' };
        req.dbClient = { query: mockQuery };
        next();
    });
    app.use('/api/v1/ai-chat', aiChatRoutes);
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
// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
function createSysadminToken() {
    return generateToken(buildSysadminTokenPayload({ tenantId: TENANT_ID }));
}
function createEmployeeToken() {
    return generateToken(buildEmployeeTokenPayload({ tenantId: TENANT_ID }));
}
// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('AI Chat Routes - Behavioral Tests', () => {
    let app;
    beforeEach(() => {
        jest.clearAllMocks();
        resetFactories();
        app = createTestApp();
    });
    // =========================================================================
    // Authentication Enforcement
    // =========================================================================
    describe('Authentication Enforcement', () => {
        it('should return 401 for GET /sessions/:id without auth token', async () => {
            const res = await supertest(app).get(`/api/v1/ai-chat/sessions/${SESSION_ID}`);
            expect(res.status).toBe(401);
        });
        it('should return 401 for POST /sessions without auth token', async () => {
            const res = await supertest(app).post('/api/v1/ai-chat/sessions').send({ title: 'Test' });
            expect(res.status).toBe(401);
        });
        it('should return 401 for GET /my-sessions without auth token', async () => {
            const res = await supertest(app).get('/api/v1/ai-chat/my-sessions');
            expect(res.status).toBe(401);
        });
        it('should return 401 for GET /escalations without auth token', async () => {
            const res = await supertest(app).get('/api/v1/ai-chat/escalations');
            expect(res.status).toBe(401);
        });
    });
    // =========================================================================
    // POST /ai-chat/sessions - Create new chat session
    // =========================================================================
    describe('POST /ai-chat/sessions', () => {
        it('should create a new session with defaults', async () => {
            const token = createSysadminToken();
            // 1st query: find employee by user_id
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'emp-1' }], rowCount: 1 });
            // 2nd query: insert session
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: SESSION_ID,
                        tenant_id: TENANT_ID,
                        title: 'Nuova conversazione',
                        provider: 'openai',
                        model: 'gpt-4o-mini',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/ai-chat/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(SESSION_ID);
            expect(res.body.message).toBe('Session created');
        });
        it('should create a session with custom title and provider', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'emp-1' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: SESSION_ID,
                        title: 'HR Policy Discussion',
                        provider: 'gemini',
                        model: 'gemini-pro',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post('/api/v1/ai-chat/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'HR Policy Discussion', provider: 'gemini', model: 'gemini-pro' });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('HR Policy Discussion');
        });
        it('should return 400 for invalid provider (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post('/api/v1/ai-chat/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({ provider: 'invalid-provider' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 500 when DB insert fails', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockRejectedValueOnce(new Error('DB write error'));
            const res = await supertest(app)
                .post('/api/v1/ai-chat/sessions')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /ai-chat/sessions/:sessionId - Get session with messages
    // =========================================================================
    describe('GET /ai-chat/sessions/:sessionId', () => {
        it('should return session with messages', async () => {
            const token = createSysadminToken();
            // 1st query: session lookup
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: SESSION_ID,
                        tenant_id: TENANT_ID,
                        title: 'Test Session',
                        provider: 'openai',
                        user_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            // 2nd query: messages for session
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 'msg-1', role: 'user', content: 'Hello', created_at: '2025-01-01' },
                    {
                        id: 'msg-2',
                        role: 'assistant',
                        content: 'Hi! How can I help?',
                        created_at: '2025-01-01',
                    },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get(`/api/v1/ai-chat/sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(SESSION_ID);
            expect(res.body.data.messages).toHaveLength(2);
            expect(res.body.data.messages[0].role).toBe('user');
            expect(res.body.data.messages[1].role).toBe('assistant');
        });
        it('should return 404 when session not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get(`/api/v1/ai-chat/sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
        it('should return 500 on DB error', async () => {
            const token = createSysadminToken();
            mockQuery.mockRejectedValueOnce(new Error('Connection lost'));
            const res = await supertest(app)
                .get(`/api/v1/ai-chat/sessions/${SESSION_ID}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /ai-chat/sessions/:sessionId/messages - Send message
    // =========================================================================
    describe('POST /ai-chat/sessions/:sessionId/messages', () => {
        it('should send message and return AI response', async () => {
            const token = createSysadminToken();
            // 1st query: verify session exists
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: SESSION_ID,
                        provider: 'openai',
                        model: 'gpt-4o-mini',
                        user_id_employee_id: 'emp-1',
                    },
                ],
                rowCount: 1,
            });
            // 2nd query: get conversation history
            mockQuery.mockResolvedValueOnce({
                rows: [{ role: 'user', content: 'Previous message' }],
                rowCount: 1,
            });
            // 3rd query: save user message
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'msg-user-1', role: 'user', content: 'What is our leave policy?' }],
                rowCount: 1,
            });
            // Mock AI orchestrator
            mockRetrieveContext.mockResolvedValueOnce({ chunks: [], sources: [] });
            mockChatCompletion.mockResolvedValueOnce({
                content: 'Our leave policy allows 25 days per year.',
                sources: [{ type: 'document', id: 'doc-1', title: 'Leave Policy' }],
                tokensInput: 150,
                tokensOutput: 30,
                confidenceScore: 0.85,
                confidenceFactors: { sourceRelevance: 0.9 },
                requiresEscalation: false,
                escalationReason: null,
            });
            // 4th query: save assistant message
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: 'msg-assistant-1',
                        role: 'assistant',
                        content: 'Our leave policy allows 25 days per year.',
                        confidence_score: 0.85,
                    },
                ],
                rowCount: 1,
            });
            // 5th query: update session timestamp
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/sessions/${SESSION_ID}/messages`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'What is our leave policy?' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.userMessage.id).toBe('msg-user-1');
            expect(res.body.data.assistantMessage.confidenceScore).toBe(0.85);
            expect(res.body.data.assistantMessage.requiresEscalation).toBe(false);
        });
        it('should return 400 when content is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/sessions/${SESSION_ID}/messages`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 404 when session does not exist', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/sessions/${SESSION_ID}/messages`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'Hello' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /ai-chat/my-sessions - User's sessions
    // =========================================================================
    describe('GET /ai-chat/my-sessions', () => {
        it('should return user sessions', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 'sess-1', title: 'First Chat', message_count: '5', last_message: 'Latest reply' },
                    { id: 'sess-2', title: 'Second Chat', message_count: '3', last_message: 'Another reply' },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/my-sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].title).toBe('First Chat');
        });
        it('should accept limit and offset query params', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/my-sessions')
                .query({ limit: '5', offset: '10' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return empty array when no sessions exist', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/my-sessions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
        });
    });
    // =========================================================================
    // POST /ai-chat/messages/:messageId/feedback - Message feedback
    // =========================================================================
    describe('POST /ai-chat/messages/:messageId/feedback', () => {
        it('should record feedback for a message', async () => {
            const token = createSysadminToken();
            // Verify message exists
            mockQuery.mockResolvedValueOnce({ rows: [{ id: MESSAGE_ID }], rowCount: 1 });
            // Update feedback
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/messages/${MESSAGE_ID}/feedback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ rating: 4, comment: 'Very helpful' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Feedback recorded');
        });
        it('should return 400 when rating is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/messages/${MESSAGE_ID}/feedback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ comment: 'No rating' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when rating is below 1 (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/messages/${MESSAGE_ID}/feedback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ rating: 0 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 400 when rating is above 5 (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/messages/${MESSAGE_ID}/feedback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ rating: 6 });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when message not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/messages/${MESSAGE_ID}/feedback`)
                .set('Authorization', `Bearer ${token}`)
                .send({ rating: 3 });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /ai-chat/escalations - Escalation queue
    // =========================================================================
    describe('GET /ai-chat/escalations', () => {
        it('should return escalation queue with pagination', async () => {
            const token = createSysadminToken();
            // Main query
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ESCALATION_ID,
                        status: 'pending',
                        priority: 'high',
                        original_query: 'Complex question',
                        employee_name: 'Mario Rossi',
                    },
                ],
                rowCount: 1,
            });
            // Count query
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/escalations')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].status).toBe('pending');
            expect(res.body.meta.total).toBe(1);
        });
        it('should accept filter params for status and priority', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/escalations')
                .query({ status: 'resolved', priority: 'high' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.total).toBe(0);
        });
        it('should return 500 on DB error', async () => {
            const token = createSysadminToken();
            mockQuery.mockRejectedValueOnce(new Error('DB error'));
            const res = await supertest(app)
                .get('/api/v1/ai-chat/escalations')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // POST /ai-chat/escalations/:id/respond - Respond to escalation
    // =========================================================================
    describe('POST /ai-chat/escalations/:id/respond', () => {
        it('should resolve an escalation', async () => {
            const token = createSysadminToken();
            // Get resolver employee ID
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'emp-resolver' }], rowCount: 1 });
            // Update escalation
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ESCALATION_ID,
                        status: 'resolved',
                        human_response: 'Here is the answer',
                        message_id: MESSAGE_ID,
                    },
                ],
                rowCount: 1,
            });
            // Update original message
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/respond`)
                .set('Authorization', `Bearer ${token}`)
                .send({ response: 'Here is the answer', resolutionNotes: 'Checked policy' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('resolved');
            expect(res.body.message).toBe('Escalation resolved');
        });
        it('should return 400 when response is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/respond`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 404 when escalation not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'emp-resolver' }], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/respond`)
                .set('Authorization', `Bearer ${token}`)
                .send({ response: 'Answer' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // POST /ai-chat/escalations/:id/assign - Assign escalation
    // =========================================================================
    describe('POST /ai-chat/escalations/:id/assign', () => {
        it('should assign an escalation', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        id: ESCALATION_ID,
                        status: 'in_progress',
                        assigned_to: 'emp-hr-1',
                    },
                ],
                rowCount: 1,
            });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/assign`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assignToEmployeeId: '11111111-2222-4333-a444-555555555555' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('in_progress');
            expect(res.body.message).toBe('Escalation assigned');
        });
        it('should return 400 when assignToEmployeeId is missing (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/assign`)
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Validation failed');
        });
        it('should return 400 when assignToEmployeeId is not a UUID (Zod validation)', async () => {
            const token = createSysadminToken();
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/assign`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assignToEmployeeId: 'not-a-uuid' });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
        it('should return 404 when escalation not found', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .post(`/api/v1/ai-chat/escalations/${ESCALATION_ID}/assign`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assignToEmployeeId: '11111111-2222-4333-a444-555555555555' });
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toMatch(/not found|non trovato/i);
        });
    });
    // =========================================================================
    // GET /ai-chat/analytics/summary - Analytics
    // =========================================================================
    describe('GET /ai-chat/analytics/summary', () => {
        it('should return analytics summary', async () => {
            const token = createSysadminToken();
            // stats query
            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        total_queries: '150',
                        total_sessions: '30',
                        unique_users: '15',
                        avg_response_time_ms: 200,
                        total_tokens_input: '50000',
                        total_tokens_output: '20000',
                        avg_confidence: '0.8500',
                        escalated_count: '5',
                        error_count: '2',
                    },
                ],
                rowCount: 1,
            });
            // provider breakdown
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { provider: 'openai', count: '100', total_tokens: '45000' },
                    { provider: 'gemini', count: '50', total_tokens: '25000' },
                ],
                rowCount: 2,
            });
            // query type breakdown
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { query_type: 'general', count: '80' },
                    { query_type: 'policy', count: '70' },
                ],
                rowCount: 2,
            });
            // daily trend
            mockQuery.mockResolvedValueOnce({
                rows: [{ date: '2025-01-01', queries: '10', avg_confidence: '0.8200' }],
                rowCount: 1,
            });
            // feedback stats
            mockQuery.mockResolvedValueOnce({
                rows: [{ feedback_count: '25', avg_rating: '4.20' }],
                rowCount: 1,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/analytics/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.summary.total_queries).toBe('150');
            expect(res.body.data.byProvider).toHaveLength(2);
            expect(res.body.data.byQueryType).toHaveLength(2);
            expect(res.body.data.dailyTrend).toHaveLength(1);
            expect(res.body.data.feedback.avg_rating).toBe('4.20');
        });
        it('should accept days query parameter', async () => {
            const token = createSysadminToken();
            // All 5 queries returning empty/defaults
            for (let i = 0; i < 5; i++) {
                mockQuery.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
            }
            const res = await supertest(app)
                .get('/api/v1/ai-chat/analytics/summary')
                .query({ days: '7' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
        it('should return 500 on DB error', async () => {
            const token = createSysadminToken();
            mockQuery.mockRejectedValueOnce(new Error('Analytics DB error'));
            const res = await supertest(app)
                .get('/api/v1/ai-chat/analytics/summary')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
    // =========================================================================
    // GET /ai-chat/knowledge-bases - Available knowledge bases
    // =========================================================================
    describe('GET /ai-chat/knowledge-bases', () => {
        it('should return knowledge bases', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 'kb-1', name: 'HR Policies', document_count: '15' },
                    { id: 'kb-2', name: 'Company Handbook', document_count: '8' },
                ],
                rowCount: 2,
            });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/knowledge-bases')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].name).toBe('HR Policies');
            expect(res.body.data[1].document_count).toBe('8');
        });
        it('should return empty array when no knowledge bases exist', async () => {
            const token = createSysadminToken();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await supertest(app)
                .get('/api/v1/ai-chat/knowledge-bases')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=ai-chat.test.js.map