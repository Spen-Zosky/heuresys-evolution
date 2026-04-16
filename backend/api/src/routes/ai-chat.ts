/**
 * AI Chat Routes
 * HR Assistant chat interface with RAG support
 * Epic 5: AI HR Assistant - Stories 5.1, 5.4, 5.5
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow, TenantRequest } from '../middleware/tenantContext.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { createAIOrchestrator, ChatMessage } from '../services/ai-orchestrator.js';
import { validate } from '../middleware/validate.js';
import {
  createSessionSchema,
  sendMessageSchema,
  messageFeedbackSchema,
  respondEscalationSchema,
  assignEscalationSchema,
} from '../schemas/ai-chat.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

router.use(requireTenant);
router.use(authMiddleware);

// =============================================================================
// CHAT ENDPOINTS
// =============================================================================

/**
 * GET /ai-chat/sessions
 * List chat sessions for the current tenant
 */
router.get(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest & TenantRequest;
    const userRole = authReq.user?.role;
    const userId = authReq.user?.userId;

    const {
      limit = '20',
      offset = '0',
      includeArchived = 'false',
    } = req.query as Record<string, string>;

    let query = `
      SELECT rs.*,
        (SELECT COUNT(*) FROM rag_messages rm WHERE rm.session_id = rs.id) AS message_count,
        (SELECT content FROM rag_messages rm WHERE rm.session_id = rs.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        e.first_name || ' ' || e.last_name AS user_name
      FROM rag_sessions rs
      LEFT JOIN employees e ON rs.user_id_employee_id = e.id
      WHERE rs.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    // Non-admin users only see their own sessions
    if (
      userRole !== 'SUPERUSER' &&
      userRole !== 'TENANT_OWNER' &&
      userRole !== 'ADMIN' &&
      userRole !== 'HR'
    ) {
      query += ` AND rs.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (includeArchived !== 'true') {
      query += ' AND rs.is_archived = false';
    }

    query += ` ORDER BY rs.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
  })
);

/**
 * POST /ai-chat/sessions
 * Create a new chat session
 */
router.post(
  '/sessions',
  validate(createSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest & TenantRequest;
    const userId = authReq.user?.userId;

    const { title, provider = 'openai', model, systemPrompt } = req.body;

    // Get employee ID for the user
    let employeeId: string | null = null;
    if (userId) {
      const empResult = await req.dbClient!.query(
        'SELECT id FROM employees WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );
      employeeId = empResult.rows[0]?.id || null;
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO rag_sessions (
        tenant_id, user_id, user_id_employee_id, provider, model,
        title, system_prompt, sources_enabled, is_archived, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
      RETURNING *
    `,
      [
        tenantId,
        userId,
        employeeId,
        provider,
        model || 'gpt-4o-mini',
        title || 'Nuova conversazione',
        systemPrompt || null,
        ['db', 'documents'],
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Session created',
    });
  })
);

/**
 * POST /ai-chat/sessions/:sessionId/messages
 * Send a message and get AI response
 */
router.post(
  '/sessions/:sessionId/messages',
  validate(sendMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['sessionId'] as string;

    const { content, includeRag = true, knowledgeBaseIds } = req.body;

    if (!content || typeof content !== 'string') {
      throw Errors.badRequest('Message content is required');
    }

    // Verify session exists and belongs to tenant
    const sessionResult = await req.dbClient!.query(
      `SELECT id, user_id, tenant_id, provider, model, title, system_prompt,
              sources_enabled, created_at, updated_at, is_archived
       FROM rag_sessions WHERE id = $1 AND tenant_id = $2`,
      [sessionId, tenantId]
    );

    if (sessionResult.rows.length === 0) {
      throw Errors.notFound('Session', sessionId);
    }

    const session = sessionResult.rows[0];

    // Get conversation history (last 10 messages for context)
    const historyResult = await req.dbClient!.query(
      `
      SELECT role, content FROM rag_messages
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [sessionId]
    );

    const history: ChatMessage[] = historyResult.rows.reverse().map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }));

    // Save user message
    const userMessageResult = await req.dbClient!.query(
      `
      INSERT INTO rag_messages (session_id, role, content, created_at)
      VALUES ($1, 'user', $2, NOW())
      RETURNING *
    `,
      [sessionId, content]
    );

    const userMessage = userMessageResult.rows[0];

    // Create AI orchestrator
    const orchestrator = createAIOrchestrator(tenantId, {
      provider: session.provider,
      model: session.model,
    });

    // Retrieve RAG context if enabled
    let ragContext;
    if (includeRag) {
      ragContext = await orchestrator.retrieveContext(content, {
        knowledgeBaseIds,
        maxChunks: 5,
      });
    }

    // Build messages for completion
    const messages: ChatMessage[] = [...history, { role: 'user', content }];

    // Get AI response
    const response = await orchestrator.chatCompletion({
      tenantId,
      sessionId,
      messages,
      ragContext,
    });

    // Save assistant message
    const assistantMessageResult = await req.dbClient!.query(
      `
      INSERT INTO rag_messages (
        session_id, role, content, sources, tokens_input, tokens_output,
        confidence_score, confidence_factors, requires_escalation, escalation_reason,
        created_at
      ) VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `,
      [
        sessionId,
        response.content,
        JSON.stringify(response.sources),
        response.tokensInput,
        response.tokensOutput,
        response.confidenceScore,
        JSON.stringify(response.confidenceFactors),
        response.requiresEscalation,
        response.escalationReason || null,
      ]
    );

    const assistantMessage = assistantMessageResult.rows[0];

    // Create escalation if needed
    let escalationId: string | null = null;
    if (response.requiresEscalation) {
      escalationId = await orchestrator.createEscalation({
        messageId: assistantMessage.id,
        sessionId,
        employeeId: session.user_id_employee_id,
        originalQuery: content,
        aiResponse: response.content,
        confidenceScore: response.confidenceScore,
        escalationReason: response.escalationReason || 'Low confidence',
        category: 'low_confidence',
        priority: response.confidenceScore < 0.2 ? 'high' : 'normal',
      });
    }

    // Update session timestamp
    await req.dbClient!.query('UPDATE rag_sessions SET updated_at = NOW() WHERE id = $1', [
      sessionId,
    ]);

    res.json({
      success: true,
      data: {
        userMessage,
        assistantMessage: {
          ...assistantMessage,
          sources: response.sources,
          confidenceScore: response.confidenceScore,
          confidenceFactors: response.confidenceFactors,
          requiresEscalation: response.requiresEscalation,
          escalationReason: response.escalationReason,
          escalationId,
        },
      },
    });
  })
);

/**
 * GET /ai-chat/sessions/:sessionId
 * Get session with messages
 */
router.get(
  '/sessions/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const sessionId = req.params['sessionId'] as string;

    const sessionResult = await req.dbClient!.query(
      `
      SELECT rs.*, e.first_name || ' ' || e.last_name as user_name
      FROM rag_sessions rs
      LEFT JOIN employees e ON rs.user_id_employee_id = e.id
      WHERE rs.id = $1 AND rs.tenant_id = $2
    `,
      [sessionId, tenantId]
    );

    if (sessionResult.rows.length === 0) {
      throw Errors.notFound('Session', sessionId);
    }

    const messagesResult = await req.dbClient!.query(
      `
      SELECT id, session_id, role, content, sources, tokens_input, tokens_output,
        confidence_score, confidence_factors, requires_escalation, escalation_reason,
        feedback_rating, feedback_comment, created_at
      FROM rag_messages WHERE session_id = $1 ORDER BY created_at ASC
    `,
      [sessionId]
    );

    res.json({
      success: true,
      data: {
        ...(sessionResult.rows[0] || {}),
        messages: messagesResult.rows,
      },
    });
  })
);

/**
 * GET /ai-chat/my-sessions
 * Get current user's chat sessions
 */
router.get(
  '/my-sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req as AuthenticatedRequest & TenantRequest;
    const userId = authReq.user?.userId;

    const {
      limit = '20',
      offset = '0',
      includeArchived = 'false',
    } = req.query as Record<string, string>;

    let query = `
      SELECT rs.*,
        (SELECT COUNT(*) FROM rag_messages rm WHERE rm.session_id = rs.id) as message_count,
        (SELECT content FROM rag_messages rm WHERE rm.session_id = rs.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM rag_sessions rs
      WHERE rs.tenant_id = $1 AND rs.user_id = $2
    `;
    const params: unknown[] = [tenantId, userId];

    if (includeArchived !== 'true') {
      query += ' AND rs.is_archived = false';
    }

    query += ` ORDER BY rs.updated_at DESC LIMIT $3 OFFSET $4`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * POST /ai-chat/messages/:messageId/feedback
 * Submit feedback for a message
 */
router.post(
  '/messages/:messageId/feedback',
  validate(messageFeedbackSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const messageId = req.params['messageId'] as string;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw Errors.badRequest('Rating must be between 1 and 5');
    }

    // Verify message belongs to a session in this tenant
    const verifyResult = await req.dbClient!.query(
      `
      SELECT rm.id FROM rag_messages rm
      JOIN rag_sessions rs ON rm.session_id = rs.id
      WHERE rm.id = $1 AND rs.tenant_id = $2
    `,
      [messageId, tenantId]
    );

    if (verifyResult.rows.length === 0) {
      throw Errors.notFound('Message', messageId);
    }

    await req.dbClient!.query(
      `
      UPDATE rag_messages SET feedback_rating = $1, feedback_comment = $2
      WHERE id = $3
    `,
      [rating, comment || null, messageId]
    );

    res.json({ success: true, message: 'Feedback recorded' });
  })
);

// =============================================================================
// ESCALATION ENDPOINTS
// =============================================================================

/**
 * GET /ai-chat/escalations
 * Get escalation queue (HR/Admin only)
 */
router.get(
  '/escalations',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      status = 'pending',
      priority,
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT eq.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        ae.first_name || ' ' || ae.last_name as assigned_to_name
      FROM ai_escalation_queue eq
      LEFT JOIN employees e ON eq.employee_id = e.id
      LEFT JOIN employees ae ON eq.assigned_to = ae.id
      WHERE eq.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      query += ` AND eq.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND eq.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    query += ` ORDER BY
      CASE eq.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      eq.created_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    const countResult = await req.dbClient!.query(
      'SELECT COUNT(*) FROM ai_escalation_queue WHERE tenant_id = $1 AND status = $2',
      [tenantId, status || 'pending']
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0]?.count),
        limit: safeParseInt(limit as string, { fallback: 50 }),
        offset: safeParseInt(offset as string, { fallback: 0 }),
      },
    });
  })
);

/**
 * POST /ai-chat/escalations/:id/respond
 * Respond to an escalation
 */
router.post(
  '/escalations/:id/respond',
  validate(respondEscalationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const escalationId = req.params['id'] as string;
    const authReq = req as AuthenticatedRequest & TenantRequest;
    const userId = authReq.user?.userId;

    const { response, resolutionNotes, shouldTrain = false } = req.body;

    if (!response) {
      throw Errors.badRequest('Response is required');
    }

    // Get resolver's employee ID
    let resolverEmployeeId: string | null = null;
    if (userId) {
      const empResult = await req.dbClient!.query(
        'SELECT id FROM employees WHERE user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
      );
      resolverEmployeeId = empResult.rows[0]?.id || null;
    }

    const result = await req.dbClient!.query(
      `
      UPDATE ai_escalation_queue SET
        human_response = $1,
        resolution_notes = $2,
        should_train = $3,
        status = 'resolved',
        resolved_at = NOW(),
        resolved_by = $4,
        updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `,
      [response, resolutionNotes || null, shouldTrain, resolverEmployeeId, escalationId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Escalation', escalationId);
    }

    // Update the original message with human response
    const escalation = result.rows[0];
    await req.dbClient!.query(
      `
      UPDATE rag_messages SET
        human_response = $1,
        human_responded_at = NOW()
      WHERE id = $2
    `,
      [response, escalation.message_id]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Escalation resolved',
    });
  })
);

/**
 * POST /ai-chat/escalations/:id/assign
 * Assign an escalation to an HR team member
 */
router.post(
  '/escalations/:id/assign',
  validate(assignEscalationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const escalationId = req.params['id'] as string;
    const { assignToEmployeeId } = req.body;

    if (!assignToEmployeeId) {
      throw Errors.badRequest('assignToEmployeeId is required');
    }

    const result = await req.dbClient!.query(
      `
      UPDATE ai_escalation_queue SET
        assigned_to = $1,
        assigned_at = NOW(),
        status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
        updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `,
      [assignToEmployeeId, escalationId, tenantId]
    );

    if (result.rows.length === 0) {
      throw Errors.notFound('Escalation', escalationId);
    }

    res.json({
      success: true,
      data: result.rows[0] || null,
      message: 'Escalation assigned',
    });
  })
);

// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================

/**
 * GET /ai-chat/analytics/summary
 * Get AI usage summary for the tenant
 */
router.get(
  '/analytics/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { days = '30' } = req.query as Record<string, string>;
    const daysInt = parseInt(days as string);

    // Basic stats
    const statsResult = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_queries,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT employee_id) as unique_users,
        AVG(response_time_ms)::integer as avg_response_time_ms,
        SUM(tokens_input) as total_tokens_input,
        SUM(tokens_output) as total_tokens_output,
        AVG(confidence_score)::decimal(5,4) as avg_confidence,
        COUNT(*) FILTER (WHERE was_escalated) as escalated_count,
        COUNT(*) FILTER (WHERE had_error) as error_count
      FROM ai_query_audit
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '1 day' * $2
    `,
      [tenantId, daysInt]
    );

    // Provider breakdown
    const providerResult = await req.dbClient!.query(
      `
      SELECT provider, COUNT(*) as count, SUM(tokens_input + tokens_output) as total_tokens
      FROM ai_query_audit
      WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY provider
      ORDER BY count DESC
    `,
      [tenantId, daysInt]
    );

    // Query type breakdown
    const typeResult = await req.dbClient!.query(
      `
      SELECT query_type, COUNT(*) as count
      FROM ai_query_audit
      WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY query_type
      ORDER BY count DESC
    `,
      [tenantId, daysInt]
    );

    // Daily trend
    const trendResult = await req.dbClient!.query(
      `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as queries,
        AVG(confidence_score)::decimal(5,4) as avg_confidence
      FROM ai_query_audit
      WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
      [tenantId, daysInt]
    );

    // Feedback stats
    const feedbackResult = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE feedback_rating IS NOT NULL) as feedback_count,
        AVG(feedback_rating)::decimal(3,2) as avg_rating
      FROM rag_messages rm
      JOIN rag_sessions rs ON rm.session_id = rs.id
      WHERE rs.tenant_id = $1 AND rm.created_at >= NOW() - INTERVAL '1 day' * $2
    `,
      [tenantId, daysInt]
    );

    res.json({
      success: true,
      data: {
        summary: statsResult.rows[0],
        byProvider: providerResult.rows,
        byQueryType: typeResult.rows,
        dailyTrend: trendResult.rows,
        feedback: feedbackResult.rows[0],
      },
    });
  })
);

/**
 * GET /ai-chat/knowledge-bases
 * Get available knowledge bases for the tenant
 */
router.get(
  '/knowledge-bases',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const result = await req.dbClient!.query(
      `
      SELECT kb.*,
        (SELECT COUNT(*) FROM rag_documents d WHERE d.knowledge_base_id = kb.id) as document_count
      FROM rag_knowledge_bases kb
      WHERE (kb.tenant_id = $1 OR kb.tenant_id IS NULL)
        AND kb.is_active = true
      ORDER BY kb.name
      LIMIT 200
    `,
      [tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

export default router;
