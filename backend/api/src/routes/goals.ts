/**
 * Goals Routes
 * CRUD operations for goals/objectives within tenant context
 * NOTE: Schema verified from database - goals table columns:
 *   id, tenant_id, employee_id, title, description, goal_type,
 *   parent_goal_id, start_date, due_date, status, progress_percent,
 *   weight, created_at, updated_at, completed_at, category, owner_id, priority
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { requirePermission, applyScopeFilter } from '../middleware/rbpMiddleware.js';
import { getScopeCondition } from '../utils/scope-helpers.js';
import { validate } from '../middleware/validate.js';
import { createGoalSchema, updateGoalSchema } from '../schemas/goals.js';
import { buildMeta } from '../utils/pagination.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { performanceManagementService } from '../services/performance-management.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// All routes require tenant context
router.use(requireTenant);

/**
 * GET /api/v1/goals/stats/summary
 * Get goal statistics for the tenant
 * (Must be before /:id route)
 */
router.get(
  '/stats/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'on_track', 'at_risk', 'not_started')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        ROUND(AVG(progress_percent), 2) as avg_progress,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled')) as overdue
      FROM goals
      WHERE tenant_id = $1
    `;

    const result = await req.dbClient!.query(query, [tenantId]);
    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        ...row,
        total: Number(row.total),
        draft: Number(row.draft),
        active: Number(row.active),
        completed: Number(row.completed),
        cancelled: Number(row.cancelled),
        on_hold: Number(row.on_hold),
        avg_progress: parseFloat(row.avg_progress) || 0,
        overdue: Number(row.overdue),
      },
    });
  })
);

/**
 * GET /api/v1/goals/stats
 * Get goal statistics for the tenant (alias for /stats/summary)
 * (Must be before /:id route)
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'on_track', 'at_risk', 'not_started')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
        ROUND(AVG(progress_percent), 2) as avg_progress,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled')) as overdue
      FROM goals
      WHERE tenant_id = $1
    `;

    const result = await req.dbClient!.query(query, [tenantId]);
    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        ...row,
        total: Number(row.total),
        draft: Number(row.draft),
        active: Number(row.active),
        completed: Number(row.completed),
        cancelled: Number(row.cancelled),
        on_hold: Number(row.on_hold),
        avg_progress: parseFloat(row.avg_progress) || 0,
        overdue: Number(row.overdue),
      },
    });
  })
);

/**
 * GET /api/v1/goals
 * List all goals for the current tenant (scope-filtered by RBP)
 */
router.get(
  '/',
  requirePermission('PERFORMANCE', 'VIEW'),
  applyScopeFilter('PERFORMANCE'),
  asyncHandler(async (req: Request, res: Response) => {
    const scope = getScopeCondition(req, 'g');

    const {
      employee_id,
      status,
      priority,
      category,
      goal_type,
      parent_goal_id,
      limit = '100',
      offset = '0',
    } = req.query as Record<string, string>;

    let query = `
      SELECT
        g.id, g.title, g.description, g.goal_type, g.status, g.priority,
        g.progress_percent, g.start_date, g.due_date, g.completed_at,
        g.category, g.weight, g.employee_id, g.owner_id, g.parent_goal_id,
        g.created_at, g.updated_at,
        e.first_name || ' ' || e.last_name as employee_name,
        p.title as parent_title
      FROM goals g
      LEFT JOIN employees e ON g.employee_id = e.id
      LEFT JOIN goals p ON g.parent_goal_id = p.id
      WHERE ${scope.where}
    `;
    const params: unknown[] = [...scope.params];
    let paramIndex = params.length + 1;

    if (employee_id) {
      query += ` AND g.employee_id = $${paramIndex}`;
      params.push(employee_id as string);
      paramIndex++;
    }

    if (status) {
      query += ` AND g.status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (priority) {
      query += ` AND g.priority = $${paramIndex}`;
      params.push(priority as string);
      paramIndex++;
    }

    if (category) {
      query += ` AND g.category = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    if (goal_type) {
      query += ` AND g.goal_type = $${paramIndex}`;
      params.push(goal_type as string);
      paramIndex++;
    }

    if (parent_goal_id) {
      if (parent_goal_id === 'null') {
        query += ` AND g.parent_goal_id IS NULL`;
      } else {
        query += ` AND g.parent_goal_id = $${paramIndex}`;
        params.push(parent_goal_id as string);
        paramIndex++;
      }
    }

    const MAX_LIMIT = 500;
    query += ` ORDER BY g.due_date ASC NULLS LAST, g.priority DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(
      Math.min(safeParseInt(limit as string, { fallback: 100 }), MAX_LIMIT),
      safeParseInt(offset as string, { fallback: 0 })
    );

    // Build count query with the same scope filter
    const countScope = getScopeCondition(req, 'g');
    let countQuery = `SELECT COUNT(*) FROM goals g WHERE ${countScope.where}`;
    const countParams: unknown[] = [...countScope.params];
    let ci = countParams.length + 1;

    if (employee_id) {
      countQuery += ` AND g.employee_id = $${ci}`;
      countParams.push(employee_id as string);
      ci++;
    }
    if (status) {
      countQuery += ` AND g.status = $${ci}`;
      countParams.push(status as string);
      ci++;
    }
    if (priority) {
      countQuery += ` AND g.priority = $${ci}`;
      countParams.push(priority as string);
      ci++;
    }
    if (category) {
      countQuery += ` AND g.category = $${ci}`;
      countParams.push(category as string);
      ci++;
    }
    if (goal_type) {
      countQuery += ` AND g.goal_type = $${ci}`;
      countParams.push(goal_type as string);
      ci++;
    }
    if (parent_goal_id) {
      if (parent_goal_id === 'null') {
        countQuery += ` AND g.parent_goal_id IS NULL`;
      } else {
        countQuery += ` AND g.parent_goal_id = $${ci}`;
        countParams.push(parent_goal_id as string);
      }
    }

    // Run data and count queries in parallel — they are independent reads
    const [result, countResult] = await Promise.all([
      req.dbClient!.query(query, params),
      req.dbClient!.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.count);
    const parsedLimit = safeParseInt(limit as string, { fallback: 100 });
    const parsedOffset = safeParseInt(offset as string, { fallback: 0 });

    res.json({
      success: true,
      data: result.rows,
      meta: buildMeta(total, parsedLimit, parsedOffset),
    });
  })
);

// =============================================================================
// ADVANCED GOAL MANAGEMENT (Story 9.1) - STATIC ROUTES FIRST
// =============================================================================

/**
 * GET /api/v1/goals/hierarchy
 * Get goal hierarchy tree
 */
router.get(
  '/hierarchy',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employee_id, status, root_only } = req.query as Record<string, string>;

    const hierarchy = await performanceManagementService.getGoalHierarchy(tenantId, {
      employeeId: employee_id as string,
      status: status as string,
      rootOnly: root_only === 'true',
    });

    res.json({ success: true, data: hierarchy });
  })
);

// ============================================================================
// STATIC ROUTES (must be before /:id) - S-PERF-01-07
// ============================================================================

/**
 * GET /api/v1/goals/templates
 * Get goal templates (library)
 */
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { category, difficulty_level, org_unit_id, is_company_wide } = req.query as Record<
      string,
      string
    >;

    let query = `
      SELECT gt.id, gt.tenant_id, gt.name, gt.description, gt.category,
        gt.goal_type, gt.suggested_metrics, gt.suggested_duration_days,
        gt.suggested_weight, gt.difficulty_level, gt.org_unit_id,
        gt.is_company_wide, gt.created_by, gt.is_active, gt.usage_count,
        gt.created_at, gt.updated_at, gt.template_id,
        d.name as department_name,
        e.first_name || ' ' || e.last_name as created_by_name
      FROM goal_templates gt
      LEFT JOIN org_units d ON gt.org_unit_id = d.id
      LEFT JOIN employees e ON gt.created_by = e.id
      WHERE gt.tenant_id = $1 AND gt.is_active = true
    `;
    const params: (string | boolean | number)[] = [tenantId];
    let paramIndex = 2;

    if (category) {
      query += ` AND gt.category = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    if (difficulty_level) {
      query += ` AND gt.difficulty_level = $${paramIndex}`;
      params.push(difficulty_level as string);
      paramIndex++;
    }

    if (org_unit_id) {
      query += ` AND (gt.org_unit_id = $${paramIndex} OR gt.is_company_wide = true)`;
      params.push(org_unit_id as string);
      paramIndex++;
    }

    if (is_company_wide === 'true') {
      query += ` AND gt.is_company_wide = true`;
    }

    query += ` ORDER BY gt.usage_count DESC, gt.name`;

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.rows.length },
    });
  })
);

/**
 * GET /api/v1/goals/team
 * Get goals for manager's direct reports
 */
router.get(
  '/team',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { manager_id, status, category, include_overdue } = req.query as Record<string, string>;

    if (!manager_id) {
      throw Errors.badRequest('manager_id is required');
    }

    let query = `
      SELECT id, tenant_id, employee_id, employee_name, manager_id, manager_name,
        org_unit_id, department_name, title, description, goal_type, status,
        progress_percent, weight, priority, start_date, due_date, completed_at,
        parent_goal_id, parent_goal_title, is_smart_validated, smart_score,
        timeline_status, check_in_count, last_check_in
      FROM v_team_goals
      WHERE tenant_id = $1 AND manager_id = $2
    `;
    const params: (string | boolean | number)[] = [tenantId, manager_id as string];
    let paramIndex = 3;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category as string);
      paramIndex++;
    }

    if (include_overdue === 'true') {
      query += ` AND timeline_status = 'overdue'`;
    }

    query += ` ORDER BY due_date NULLS LAST, priority DESC, employee_name LIMIT 200`;

    const result = await req.dbClient!.query(query, params);

    // Get summary stats
    const summaryResult = await req.dbClient!.query(
      `
      SELECT
        COUNT(*) as total_goals,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'on_track', 'at_risk', 'not_started')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE timeline_status = 'overdue') as overdue,
        ROUND(AVG(progress_percent), 2) as avg_progress,
        COUNT(DISTINCT employee_id) as employee_count
      FROM v_team_goals
      WHERE tenant_id = $1 AND manager_id = $2
    `,
      [tenantId, manager_id]
    );

    res.json({
      success: true,
      data: {
        goals: result.rows,
        summary: summaryResult.rows[0],
      },
      meta: { total: result.rows.length },
    });
  })
);

/**
 * GET /api/v1/goals/cascade
 * Get full goal cascade tree
 */
router.get(
  '/cascade',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { root_id, org_unit_id, max_level } = req.query as Record<string, string>;

    let query = `
      SELECT id, tenant_id, title, description, employee_id, parent_goal_id,
        status, progress_percent, weight, due_date, level, path, root_id,
        owner_name, owner_job_title, owner_department, parent_goal_title
      FROM v_goal_cascade
      WHERE tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];
    let paramIndex = 2;

    if (root_id) {
      query += ` AND root_id = $${paramIndex}`;
      params.push(root_id as string);
      paramIndex++;
    }

    if (org_unit_id) {
      query += ` AND owner_department = (SELECT name FROM org_units WHERE id = $${paramIndex})`;
      params.push(org_unit_id as string);
      paramIndex++;
    }

    if (max_level) {
      query += ` AND level <= $${paramIndex}`;
      params.push(parseInt(max_level as string));
      paramIndex++;
    }

    query += ` ORDER BY path LIMIT 200`;

    const result = await req.dbClient!.query(query, params);

    // Build tree structure
    const tree = buildGoalTree(result.rows);

    res.json({
      success: true,
      data: tree,
      meta: { total_nodes: result.rows.length },
    });
  })
);

// Helper function to build tree structure
function buildGoalTree(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const nodeMap = new Map<string, Record<string, unknown>>();
  const roots: Record<string, unknown>[] = [];

  // First pass: create all nodes
  for (const row of rows) {
    nodeMap.set(row.id as string, { ...row, children: [] });
  }

  // Second pass: build tree
  for (const row of rows) {
    const node = nodeMap.get(row.id as string)!;
    if (row.parent_goal_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(row.parent_goal_id as string);
      if (parent) {
        (parent.children as Record<string, unknown>[]).push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

/**
 * GET /api/v1/goals/:id
 * Get a single goal by ID
 */
router.get(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const query = `
      SELECT
        g.id, g.title, g.description, g.goal_type, g.status, g.priority,
        g.progress_percent, g.start_date, g.due_date, g.completed_at,
        g.category, g.weight, g.employee_id, g.owner_id, g.parent_goal_id,
        g.created_at, g.updated_at,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        p.title as parent_title,
        (SELECT COUNT(*) FROM goals WHERE parent_goal_id = g.id) as child_count
      FROM goals g
      LEFT JOIN employees e ON g.employee_id = e.id
      LEFT JOIN goals p ON g.parent_goal_id = p.id
      WHERE g.id = $1 AND g.tenant_id = $2
    `;

    const result = await req.dbClient!.query(query, [id, tenantId]);

    if (result.rows.length === 0) {
      throw Errors.notFound('Goal');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * POST /api/v1/goals
 * Create a new goal
 */
router.post(
  '/',
  validate(createGoalSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      employee_id,
      title,
      description,
      goal_type = 'individual',
      status = 'draft',
      priority,
      start_date,
      due_date,
      parent_goal_id,
      category,
      weight,
      owner_id,
    } = req.body;

    if (!employee_id || !title) {
      throw Errors.badRequest('Employee ID and title are required');
    }

    // Verify employee belongs to tenant
    const employeeCheck = await req.dbClient!.query(
      'SELECT id FROM employees WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );

    if (employeeCheck.rows.length === 0) {
      throw Errors.badRequest('Invalid employee ID');
    }

    const query = `
      INSERT INTO goals (
        tenant_id, employee_id, owner_id, title, description,
        goal_type, status, priority, start_date, due_date,
        parent_goal_id, category, weight
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await req.dbClient!.query(query, [
      tenantId,
      employee_id,
      owner_id || null,
      title,
      description || null,
      goal_type,
      status,
      priority || null,
      start_date || null,
      due_date || null,
      parent_goal_id || null,
      category || null,
      weight || null,
    ]);

    res.status(201).json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * PUT /api/v1/goals/:id
 * Update a goal
 */
router.put(
  '/:id',
  validateUUID(),
  validate(updateGoalSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const {
      title,
      description,
      goal_type,
      status,
      priority,
      progress_percent,
      start_date,
      due_date,
      parent_goal_id,
      category,
      weight,
    } = req.body;

    // Check goal exists and belongs to tenant
    const existingGoal = await req.dbClient!.query(
      'SELECT id, status FROM goals WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (existingGoal.rows.length === 0) {
      throw Errors.notFound('Goal');
    }

    // Prevent circular parent reference
    if (parent_goal_id === id) {
      throw Errors.badRequest('Goal cannot be its own parent');
    }

    // Auto-set completed_at when status changes to completed
    let completedAtValue: string | null | undefined = undefined;
    if (status === 'completed' && existingGoal.rows[0].status !== 'completed') {
      completedAtValue = new Date().toISOString();
    } else if (status !== 'completed' && status !== undefined) {
      completedAtValue = null;
    }

    const query = `
      UPDATE goals SET
        title = COALESCE($1, title),
        description = $2,
        goal_type = COALESCE($3, goal_type),
        status = COALESCE($4, status),
        priority = $5,
        progress_percent = COALESCE($6, progress_percent),
        start_date = $7,
        due_date = $8,
        parent_goal_id = $9,
        category = $10,
        weight = $11,
        completed_at = COALESCE($12::timestamptz, completed_at),
        updated_at = NOW()
      WHERE id = $13 AND tenant_id = $14
      RETURNING *
    `;

    const result = await req.dbClient!.query(query, [
      title || null,
      description,
      goal_type || null,
      status || null,
      priority,
      progress_percent,
      start_date,
      due_date,
      parent_goal_id,
      category,
      weight,
      completedAtValue,
      id,
      tenantId,
    ]);

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * DELETE /api/v1/goals/:id
 * Delete a goal (hard delete)
 */
router.delete(
  '/:id',
  validateUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    // Check if goal has children
    const childCheck = await req.dbClient!.query(
      'SELECT COUNT(*) FROM goals WHERE parent_goal_id = $1',
      [id]
    );

    if (parseInt(childCheck.rows[0].count) > 0) {
      throw Errors.badRequest('Cannot delete goal with child goals');
    }

    const query = `
      DELETE FROM goals
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `;

    const result = await req.dbClient!.query(query, [id, tenantId]);

    if (result.rows.length === 0) {
      throw Errors.notFound('Goal');
    }

    res.json({ success: true, message: 'Goal deleted' });
  })
);

/**
 * PATCH /api/v1/goals/:id/progress
 * Update goal progress
 */
router.patch(
  '/:id/progress',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { progress_percent } = req.body;

    if (progress_percent === undefined) {
      throw Errors.badRequest('progress_percent is required');
    }

    const query = `
      UPDATE goals SET
        progress_percent = $1,
        updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, progress_percent
    `;

    const result = await req.dbClient!.query(query, [progress_percent, id, tenantId]);

    if (result.rows.length === 0) {
      throw Errors.notFound('Goal');
    }

    res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * GET /api/v1/goals/:id/children
 * Get child goals
 */
router.get(
  '/:id/children',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const query = `
      SELECT
        g.id, g.title, g.status, g.priority,
        g.progress_percent, g.due_date,
        e.first_name || ' ' || e.last_name as employee_name
      FROM goals g
      LEFT JOIN employees e ON g.employee_id = e.id
      WHERE g.parent_goal_id = $1 AND g.tenant_id = $2
      ORDER BY g.due_date ASC NULLS LAST
    `;

    const result = await req.dbClient!.query(query, [id, tenantId]);

    res.json({ success: true, data: result.rows });
  })
);

/**
 * GET /api/v1/goals/:id/alignments
 * Get goal alignments
 */
router.get(
  '/:id/alignments',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const alignments = await performanceManagementService.getGoalAlignments(tenantId, id);

    res.json({ success: true, data: alignments });
  })
);

/**
 * POST /api/v1/goals/:id/alignments
 * Create goal alignment
 */
router.post(
  '/:id/alignments',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { aligned_goal_id, alignment_type, weight } = req.body;

    if (!aligned_goal_id || !alignment_type) {
      throw Errors.badRequest('aligned_goal_id and alignment_type are required');
    }

    const alignment = await performanceManagementService.createGoalAlignment(
      tenantId,
      id,
      aligned_goal_id,
      alignment_type,
      weight
    );

    res.status(201).json({ success: true, data: alignment });
  })
);

/**
 * GET /api/v1/goals/:id/updates
 * Get goal update history
 */
router.get(
  '/:id/updates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { limit = '50' } = req.query as Record<string, string>;

    const updates = await performanceManagementService.getGoalUpdates(
      tenantId,
      id,
      safeParseInt(limit as string, { fallback: 50 })
    );

    res.json({ success: true, data: updates });
  })
);

/**
 * POST /api/v1/goals/:id/updates
 * Add goal update
 */
router.post(
  '/:id/updates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;
    const { author_id, update_type, content, new_progress, new_status } = req.body;

    if (!update_type) {
      throw Errors.badRequest('update_type is required');
    }

    const update = await performanceManagementService.addGoalUpdate(tenantId, id, {
      author_id,
      update_type,
      content,
      new_progress,
      new_status,
    });

    res.status(201).json({ success: true, data: update });
  })
);

/**
 * GET /api/v1/goals/:id/milestones
 * Get goal milestones
 */
router.get(
  '/:id/milestones',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const milestones = await performanceManagementService.getGoalMilestones(tenantId, id);

    res.json({ success: true, data: milestones });
  })
);

/**
 * POST /api/v1/goals/:id/milestones
 * Create goal milestone
 */
router.post(
  '/:id/milestones',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const goalId = req.params['id'] as string;
    const { title, description, target_date, weight } = req.body;

    if (!title) {
      throw Errors.badRequest('title is required');
    }

    const milestone = await performanceManagementService.createGoalMilestone(tenantId, goalId, {
      goal_id: goalId,
      title,
      description,
      target_date,
      weight,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: milestone });
  })
);

/**
 * POST /api/v1/goals/:id/milestones/:milestoneId/complete
 * Complete a milestone
 */
router.post(
  '/:id/milestones/:milestoneId/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const goalId = req.params['id'] as string;
    const milestoneId = req.params['milestoneId'] as string;

    // Verify goal exists
    const goalCheck = await req.dbClient!.query(
      'SELECT id FROM goals WHERE id = $1 AND tenant_id = $2',
      [goalId, tenantId]
    );
    if (goalCheck.rows.length === 0) {
      throw Errors.notFound('Goal', goalId);
    }

    // Verify milestone exists
    const milestoneCheck = await req.dbClient!.query(
      'SELECT id FROM goal_milestones WHERE id = $1 AND tenant_id = $2',
      [milestoneId, tenantId]
    );
    if (milestoneCheck.rows.length === 0) {
      throw Errors.notFound('Milestone', milestoneId);
    }

    const milestone = await performanceManagementService.completeMilestone(tenantId, milestoneId);

    res.json({ success: true, data: milestone, message: 'Milestone completed' });
  })
);

/**
 * GET /api/v1/goals/:id/cascaded-progress
 * Calculate cascaded progress from child goals
 */
router.get(
  '/:id/cascaded-progress',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'] as string;

    const progress = await performanceManagementService.calculateCascadedProgress(tenantId, id);

    res.json({
      success: true,
      data: {
        goal_id: id,
        cascaded_progress: progress,
      },
    });
  })
);

// ============================================================================
// GOAL TEMPLATES POST ENDPOINTS - S-PERF-01-07
// ============================================================================

/**
 * POST /api/v1/goals/templates
 * Create a goal template
 */
router.post(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const {
      name,
      description,
      category,
      goal_type,
      suggested_metrics,
      suggested_duration_days,
      suggested_weight,
      difficulty_level,
      org_unit_id,
      is_company_wide,
      created_by,
    } = req.body;

    if (!name) {
      throw Errors.badRequest('name is required');
    }

    const result = await req.dbClient!.query(
      `
      INSERT INTO goal_templates (
        tenant_id, name, description, category, goal_type,
        suggested_metrics, suggested_duration_days, suggested_weight,
        difficulty_level, org_unit_id, is_company_wide, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
      [
        tenantId,
        name,
        description,
        category || 'performance',
        goal_type || 'objective',
        suggested_metrics || [],
        suggested_duration_days,
        suggested_weight || 1.0,
        difficulty_level || 'medium',
        org_unit_id,
        is_company_wide || false,
        created_by,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0] || null,
      message: 'Goal template created',
    });
  })
);

/**
 * POST /api/v1/goals/from-template
 * Create a goal from template
 */
router.post(
  '/from-template',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { template_id, employee_id, title, start_date, due_date, parent_goal_id } = req.body;

    if (!template_id || !employee_id) {
      throw Errors.badRequest('template_id and employee_id are required');
    }

    // Get template
    const templateResult = await req.dbClient!.query(
      `
      SELECT id, tenant_id, name, description, category, goal_type,
        suggested_metrics, suggested_duration_days, suggested_weight,
        difficulty_level, org_unit_id, role_id, is_company_wide,
        usage_count, is_active, created_by, created_at, updated_at
      FROM goal_templates WHERE id = $1 AND tenant_id = $2
    `,
      [template_id, tenantId]
    );

    if (templateResult.rows.length === 0) {
      throw Errors.notFound('Template');
    }

    const template = templateResult.rows[0];

    // Calculate due date if not provided
    const goalDueDate =
      due_date ||
      (template.suggested_duration_days
        ? new Date(Date.now() + template.suggested_duration_days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]
        : null);

    // Create goal from template
    const goalResult = await req.dbClient!.query(
      `
      INSERT INTO goals (
        tenant_id, employee_id, title, description, goal_type,
        category, weight, start_date, due_date, parent_goal_id,
        template_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
      RETURNING *
    `,
      [
        tenantId,
        employee_id,
        title || template.name,
        template.description,
        template.goal_type,
        template.category,
        template.suggested_weight,
        start_date || new Date().toISOString().split('T')[0],
        goalDueDate,
        parent_goal_id,
        template_id,
      ]
    );

    // Increment template usage count
    await req.dbClient!.query(
      `
      UPDATE goal_templates SET usage_count = usage_count + 1 WHERE id = $1
    `,
      [template_id]
    );

    res.status(201).json({
      success: true,
      data: goalResult.rows[0] || null,
      message: 'Goal created from template',
    });
  })
);

// ============================================================================
// GOAL CHECK-INS - S-PERF-01-07
// ============================================================================

/**
 * GET /api/v1/goals/:id/check-ins
 * Get check-in history for a goal
 */
router.get(
  '/:id/check-ins',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const goalId = req.params['id'] as string;

    const result = await req.dbClient!.query(
      `
      SELECT gc.id, gc.tenant_id, gc.goal_id, gc.employee_id,
        gc.check_in_date, gc.previous_progress, gc.new_progress,
        gc.status_update, gc.notes, gc.blockers, gc.next_steps,
        gc.confidence_level, gc.created_at,
        e.first_name || ' ' || e.last_name as employee_name
      FROM goal_check_ins gc
      JOIN employees e ON gc.employee_id = e.id
      WHERE gc.goal_id = $1 AND gc.tenant_id = $2
      ORDER BY gc.check_in_date DESC, gc.created_at DESC
    `,
      [goalId, tenantId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.rows.length },
    });
  })
);

/**
 * POST /api/v1/goals/:id/check-in
 * Create a check-in (progress update)
 */
router.post(
  '/:id/check-in',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const goalId = req.params['id'] as string;
    const {
      employee_id,
      new_progress,
      status_update,
      notes,
      blockers,
      next_steps,
      confidence_level,
    } = req.body;

    if (!employee_id || new_progress === undefined) {
      throw Errors.badRequest('employee_id and new_progress are required');
    }

    // Get current progress
    const goalResult = await req.dbClient!.query(
      `
      SELECT progress_percent, status FROM goals WHERE id = $1 AND tenant_id = $2
    `,
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      throw Errors.notFound('Goal');
    }

    const previousProgress = goalResult.rows[0]?.progress_percent;

    // Create check-in
    const checkInResult = await req.dbClient!.query(
      `
      INSERT INTO goal_check_ins (
        tenant_id, goal_id, employee_id, previous_progress, new_progress,
        status_update, notes, blockers, next_steps, confidence_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
      [
        tenantId,
        goalId,
        employee_id,
        previousProgress,
        new_progress,
        status_update,
        notes,
        blockers,
        next_steps,
        confidence_level,
      ]
    );

    // Update goal progress and status
    await req.dbClient!.query(
      `
      UPDATE goals
      SET progress_percent = $1,
          status = CASE WHEN $2 >= 100 THEN 'completed' ELSE status END,
          completed_at = CASE WHEN $2 >= 100 THEN NOW() ELSE completed_at END,
          updated_at = NOW()
      WHERE id = $3
    `,
      [new_progress, new_progress, goalId]
    );

    res.status(201).json({
      success: true,
      data: checkInResult.rows[0] || null,
      message: 'Check-in recorded',
    });
  })
);

// ============================================================================
// SMART VALIDATION - S-PERF-01-07
// ============================================================================

/**
 * POST /api/v1/goals/:id/validate-smart
 * Validate goal against SMART criteria
 */
router.post(
  '/:id/validate-smart',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const goalId = req.params['id'] as string;

    // Get goal
    const goalResult = await req.dbClient!.query(
      `
      SELECT id, tenant_id, employee_id, title, description, goal_type, status,
             priority, start_date, due_date, weight, category, smart_criteria,
             is_smart_validated, smart_score
      FROM goals WHERE id = $1 AND tenant_id = $2
    `,
      [goalId, tenantId]
    );

    if (goalResult.rows.length === 0) {
      throw Errors.notFound('Goal');
    }

    const goal = goalResult.rows[0];

    // SMART criteria evaluation
    const smartCriteria = {
      specific: {
        passed: goal.title && goal.title.length >= 10 && goal.description,
        score: goal.title && goal.title.length >= 10 ? (goal.description ? 100 : 50) : 0,
        feedback: goal.description
          ? 'Goal has clear title and description'
          : 'Add more detail to the description',
      },
      measurable: {
        passed: goal.progress_percent !== null,
        score: goal.progress_percent !== null ? 100 : 0,
        feedback:
          goal.progress_percent !== null
            ? 'Goal has measurable progress'
            : 'Define how progress will be measured',
      },
      achievable: {
        passed: goal.weight && goal.weight > 0 && goal.weight <= 1,
        score: goal.weight ? 100 : 50,
        feedback: goal.weight
          ? 'Goal has appropriate weight/priority'
          : 'Consider setting realistic weight',
      },
      relevant: {
        passed: goal.category || goal.parent_goal_id,
        score: (goal.category ? 50 : 0) + (goal.parent_goal_id ? 50 : 0),
        feedback: goal.parent_goal_id
          ? 'Goal is aligned to parent objective'
          : 'Consider linking to a higher-level goal',
      },
      time_bound: {
        passed: goal.start_date && goal.due_date,
        score: (goal.start_date ? 50 : 0) + (goal.due_date ? 50 : 0),
        feedback: goal.due_date ? 'Goal has defined timeline' : 'Set start and due dates',
      },
    };

    // Calculate overall SMART score
    const scores = Object.values(smartCriteria).map((c) => c.score);
    const smartScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const isSmartValidated = smartScore >= 70;

    // Update goal with SMART validation
    await req.dbClient!.query(
      `
      UPDATE goals
      SET smart_criteria = $1,
          smart_score = $2,
          is_smart_validated = $3,
          updated_at = NOW()
      WHERE id = $4
    `,
      [JSON.stringify(smartCriteria), smartScore, isSmartValidated, goalId]
    );

    res.json({
      success: true,
      data: {
        goal_id: goalId,
        smart_criteria: smartCriteria,
        smart_score: smartScore,
        is_smart_validated: isSmartValidated,
        recommendations: Object.entries(smartCriteria)
          .filter(([, v]) => v.score < 100)
          .map(([k, v]) => ({ criterion: k, feedback: v.feedback })),
      },
    });
  })
);

export default router;
