/**
 * Org Charts API Routes
 * Endpoints for org chart generation, employee assignment, and export
 */

import { Router, Request, Response } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes, isValidUUID } from '@heuresys/shared';
import { checkPermission } from '../middleware/rbac.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { buildMeta } from '../utils/pagination.js';
import {
  createOrgChartGeneratorService,
  GenerationConfig,
  GenerationMethod,
} from '../services/org-chart-generator.js';
import { validate } from '../middleware/validate.js';
import {
  createOrgChartSessionSchema,
  generateOrgChartSchema,
  generatePrototypeSchema,
  exportTenantOrgUnitsSchema,
  createSnapshotSchema,
} from '../schemas/employees.js';
import { createEmployeeAssignmentService } from '../services/employee-assignment.js';
import { createComparisonReportService } from '../services/comparison-report.js';
import { createExcalidrawExportService } from '../services/excalidraw-export.js';
import { createIndustryPrototypeService } from '../services/industry-prototype.js';
import { asyncHandler } from '../errors/middleware.js';
import { safeParseInt } from '../utils/query-helpers.js';

const router = Router();

// Tenant context required for all routes
router.use(requireTenant);

// =============================================================================
// SESSIONS
// =============================================================================

/**
 * POST /org-charts/sessions
 * Create a new generation session
 */
router.post(
  '/sessions',
  validate(createOrgChartSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionName, config } = req.body;

    if (!sessionName) {
      throw createAppError('Session name is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validMethods: GenerationMethod[] = ['web_search', 'template', 'nace_esco', 'combined'];
    const generationConfig: GenerationConfig = {
      method: validMethods.includes(config?.method) ? config.method : 'combined',
      aiProvider: config?.aiProvider || 'gemini',
      levelCount: config?.levelCount || 7,
      includeVacancies: config?.includeVacancies ?? false,
      useExistingDepartments: config?.useExistingDepartments ?? true,
      useExistingJobTitles: config?.useExistingJobTitles ?? true,
    };

    const generatorService = createOrgChartGeneratorService(tenantId, generationConfig.aiProvider);
    const session = await generatorService.createSession(sessionName, generationConfig);

    res.status(201).json({
      success: true,
      data: session,
    });
  })
);

/**
 * GET /org-charts/sessions
 * List all sessions for tenant
 */
router.get(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { status, limit = 20, offset = 0 } = req.query as Record<string, string>;

    let query = `
      SELECT
        s.id, s.tenant_id, s.session_name, s.generation_method, s.status,
        s.nace_code, s.industry_name, s.company_size,
        s.created_at, s.completed_at, s.error_message,
        COALESCE(es.staging_count, 0) as staging_count
      FROM org_chart_generation_sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as staging_count
        FROM employees_staging
        GROUP BY session_id
      ) es ON es.session_id = s.id
      WHERE s.tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];

    if (status) {
      params.push(status as string);
      query += ` AND s.status = $${params.length}`;
    }

    // Order by sessions with staging data first, then by creation date
    query += ` ORDER BY COALESCE(es.staging_count, 0) DESC, s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(
      safeParseInt(limit as string, { fallback: 50 }),
      safeParseInt(offset as string, { fallback: 0 })
    );

    const result = await req.dbClient!.query(query, params);

    // Get total count
    const countResult = await req.dbClient!.query(
      `SELECT COUNT(*) FROM org_chart_generation_sessions WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        sessions: result.rows,
        meta: buildMeta(
          parseInt(countResult.rows[0]?.count),
          safeParseInt(limit as string, { fallback: 50 }),
          safeParseInt(offset as string, { fallback: 0 })
        ),
      },
    });
  })
);

/**
 * GET /org-charts/sessions/:id
 * Get session details
 */
router.get(
  '/sessions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const generatorService = createOrgChartGeneratorService(tenantId);
    const session = await generatorService.getSession(id);

    if (!session) {
      throw createAppError('Session not found', 404, ErrorCodes.NOT_FOUND);
    }

    res.json({
      success: true,
      data: session,
    });
  })
);

// =============================================================================
// GENERATION
// =============================================================================

/**
 * POST /org-charts/sessions/:id/generate
 * Generate org chart for session
 */
router.post(
  '/sessions/:id/generate',
  validate(generateOrgChartSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;
    const { method, aiProvider } = req.body;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const config: GenerationConfig = {
      method: method || 'combined',
      aiProvider: aiProvider || 'gemini',
    };

    const generatorService = createOrgChartGeneratorService(tenantId, config.aiProvider);
    const orgChart = await generatorService.generate(id, config);

    res.json({
      success: true,
      data: orgChart,
    });
  })
);

/**
 * POST /org-charts/generate-prototype
 * One-step generation: create session and generate
 */
router.post(
  '/generate-prototype',
  validate(generatePrototypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionName, method, aiProvider } = req.body;

    const config: GenerationConfig = {
      method: method || 'combined',
      aiProvider: aiProvider || 'gemini',
    };

    const generatorService = createOrgChartGeneratorService(tenantId, config.aiProvider);

    // Create session
    const session = await generatorService.createSession(
      sessionName || `Generation ${new Date().toISOString()}`,
      config
    );

    // Generate org chart
    const orgChart = await generatorService.generate(session.id, config);

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          sessionName: session.sessionName,
          status: 'generated',
        },
        orgChart,
      },
    });
  })
);

// =============================================================================
// EMPLOYEE ASSIGNMENT
// =============================================================================

/**
 * POST /org-charts/sessions/:id/assign-employees
 * Assign employees to positions in generated org chart
 */
router.post(
  '/sessions/:id/assign-employees',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get generated structure from session
    const sessionResult = await req.dbClient!.query(
      `SELECT generated_structure FROM org_chart_generation_sessions
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (sessionResult.rows.length === 0) {
      throw createAppError('Session not found', 404, ErrorCodes.NOT_FOUND);
    }

    const generatedStructure = sessionResult.rows[0]?.generated_structure;
    if (!generatedStructure) {
      throw createAppError(
        'No generated structure found. Generate org chart first.',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const assignmentService = createEmployeeAssignmentService(tenantId);
    const result = await assignmentService.assignEmployeesToPositions(id, generatedStructure);

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// COMPARISON & STAGING
// =============================================================================

/**
 * GET /org-charts/staging/:sessionId/compare
 * Get comparison report between employees and staging
 */
router.get(
  '/staging/:sessionId/compare',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionId } = req.params as Record<string, string>;
    const { format } = req.query as Record<string, string>;

    if (!sessionId || !isValidUUID(sessionId)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const comparisonService = createComparisonReportService(tenantId);

    if (format === 'csv') {
      const csv = await comparisonService.exportAsCSV(sessionId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="comparison_${sessionId}.csv"`);
      res.send(csv);
      return;
    }

    if (format === 'detailed-csv') {
      const csv = await comparisonService.exportDetailedCSV(sessionId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="comparison_detailed_${sessionId}.csv"`
      );
      res.send(csv);
      return;
    }

    const report = await comparisonService.generateComparison(sessionId);

    res.json({
      success: true,
      data: report,
    });
  })
);

/**
 * GET /org-charts/staging/:sessionId/employees
 * Get all staging records for session
 */
router.get(
  '/staging/:sessionId/employees',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionId } = req.params as Record<string, string>;
    const { level, changeType, limit = 100, offset = 0 } = req.query as Record<string, string>;

    if (!sessionId || !isValidUUID(sessionId)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    let query = `
      SELECT
        id, original_employee_id, first_name, last_name, email, job_title,
        department, hierarchy_level, position_code, unit_code,
        change_type, assignment_method, assignment_confidence,
        diff_fields, is_approved
      FROM employees_staging
      WHERE session_id = $1 AND tenant_id = $2
    `;
    const params: (string | number)[] = [sessionId, tenantId];

    if (level) {
      params.push(safeParseInt(level as string, { fallback: 0 }));
      query += ` AND hierarchy_level = $${params.length}`;
    }

    if (changeType) {
      params.push(changeType as string);
      query += ` AND change_type = $${params.length}`;
    }

    query += ` ORDER BY hierarchy_level, last_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
 * POST /org-charts/staging/:sessionId/approve
 * Approve all staging changes
 */
router.post(
  '/staging/:sessionId/approve',
  checkPermission('employees:update'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionId } = req.params as Record<string, string>;
    const userId = (req as AuthenticatedRequest).user?.userId || 'system';

    if (!sessionId || !isValidUUID(sessionId)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const comparisonService = createComparisonReportService(tenantId);
    const result = await comparisonService.approveChanges(sessionId, userId);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /org-charts/staging/:sessionId/apply
 * Apply approved changes to employees table
 */
router.post(
  '/staging/:sessionId/apply',
  checkPermission('employees:update'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionId } = req.params as Record<string, string>;

    if (!sessionId || !isValidUUID(sessionId)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const comparisonService = createComparisonReportService(tenantId);
    const result = await comparisonService.applyApprovedChanges(sessionId);

    res.json({
      success: true,
      data: result,
    });
  })
);

// =============================================================================
// EXPORT
// =============================================================================

/**
 * GET /org-charts/sessions/:id/export/json
 * Export org chart as JSON tree
 */
router.get(
  '/sessions/:id/export/json',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await req.dbClient!.query(
      `SELECT generated_structure FROM org_chart_generation_sessions
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw createAppError('Session not found', 404, ErrorCodes.NOT_FOUND);
    }

    const structure = result.rows[0]?.generated_structure;
    if (!structure) {
      throw createAppError('No generated structure found', 400, ErrorCodes.VALIDATION_ERROR);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="org_chart_${id}.json"`);
    res.send(JSON.stringify(structure, null, 2));
  })
);

/**
 * GET /org-charts/sessions/:id/export/excalidraw
 * Export org chart as Excalidraw file
 */
router.get(
  '/sessions/:id/export/excalidraw',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;
    const { includeEmployees } = req.query as Record<string, string>;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const excalidrawService = createExcalidrawExportService(tenantId);
    const excalidrawFile = await excalidrawService.exportToExcalidraw(
      id,
      includeEmployees !== 'false'
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="org_chart_${id}.excalidraw"`);
    res.send(JSON.stringify(excalidrawFile, null, 2));
  })
);

/**
 * GET /org-charts/staging/:sessionId/export/excalidraw
 * Export staging hierarchy as Excalidraw file
 */
router.get(
  '/staging/:sessionId/export/excalidraw',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionId } = req.params as Record<string, string>;

    if (!sessionId || !isValidUUID(sessionId)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const excalidrawService = createExcalidrawExportService(tenantId);
    const excalidrawFile = await excalidrawService.exportStagingToExcalidraw(sessionId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="staging_org_chart_${sessionId}.excalidraw"`
    );
    res.send(JSON.stringify(excalidrawFile, null, 2));
  })
);

/**
 * POST /org-charts/sessions/:id/export/tenant-org-units
 * Export generated structure to tenant_org_charts and tenant_org_units tables
 */
router.post(
  '/sessions/:id/export/tenant-org-units',
  checkPermission('employees:update'),
  validate(exportTenantOrgUnitsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;
    const { chartName, setAsActive } = req.body;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get generated structure
    const sessionResult = await req.dbClient!.query(
      `SELECT session_name, generated_structure FROM org_chart_generation_sessions
         WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (sessionResult.rows.length === 0) {
      throw createAppError('Session not found', 404, ErrorCodes.NOT_FOUND);
    }

    const session = sessionResult.rows[0];
    const structure = session.generated_structure;

    if (!structure || !structure.units) {
      throw createAppError('No generated structure found', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create tenant_org_chart
    const chartResult = await req.dbClient!.query(
      `
        INSERT INTO tenant_org_charts (tenant_id, name, description, status, effective_date, is_active)
        VALUES ($1, $2, $3, 'draft', CURRENT_DATE, false)
        RETURNING id
      `,
      [tenantId, chartName || session.session_name, `Generated from session ${id}`]
    );

    const chartId = chartResult.rows[0]?.id;

    // Insert units with ltree paths
    let insertedUnits = 0;
    const unitIdMap = new Map<string, string>();

    // Sort units by level to ensure parents are created first
    const sortedUnits = [...structure.units].sort((a, b) => a.level - b.level);

    for (const unit of sortedUnits) {
      // Determine parent_id
      let parentId: string | null = null;
      let parentPath = '';

      if (unit.parentCode) {
        parentId = unitIdMap.get(unit.parentCode) || null;
        if (parentId) {
          const parentResult = await req.dbClient!.query(
            `SELECT path FROM tenant_org_units WHERE id = $1`,
            [parentId]
          );
          if (parentResult.rows.length > 0) {
            parentPath = parentResult.rows[0]?.path || '';
          }
        }
      }

      // Build path
      const path = parentPath ? `${parentPath}.${unit.code}` : unit.code;

      const unitResult = await req.dbClient!.query(
        `
          INSERT INTO tenant_org_units (
            chart_id, parent_id, path, depth, code, name_it, name_en,
            level, is_line, is_management, headcount_budget
          ) VALUES ($1, $2, $3::ltree, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `,
        [
          chartId,
          parentId,
          path,
          unit.level - 1,
          unit.code,
          unit.name,
          unit.nameEn || unit.name,
          unit.level,
          unit.type !== 'company',
          unit.type === 'company' || unit.level <= 2,
          unit.headcountBudget || 0,
        ]
      );

      unitIdMap.set(unit.code, unitResult.rows[0]?.id);
      insertedUnits++;
    }

    // Optionally set as active (deactivate others first)
    if (setAsActive) {
      await req.dbClient!.query(
        `UPDATE tenant_org_charts SET is_active = false WHERE tenant_id = $1 AND id != $2`,
        [tenantId, chartId]
      );
      await req.dbClient!.query(
        `UPDATE tenant_org_charts SET is_active = true, status = 'active' WHERE id = $1`,
        [chartId]
      );
    }

    res.json({
      success: true,
      data: {
        chartId,
        chartName: chartName || session.session_name,
        unitsCreated: insertedUnits,
        isActive: setAsActive || false,
      },
    });
  })
);

// =============================================================================
// TENANT ORG UNITS (Official Structure)
// =============================================================================

/**
 * GET /org-charts/tenant-units
 * Get tenant_org_units from the active org chart
 */
router.get(
  '/tenant-units',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    // Get active chart
    const chartResult = await req.dbClient!.query(
      `SELECT id, name, status, effective_date FROM tenant_org_charts
       WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    if (chartResult.rows.length === 0) {
      res.json({
        success: true,
        data: {
          chart: null,
          units: [],
          message: 'No active org chart found for tenant',
        },
      });
      return;
    }

    const chart = chartResult.rows[0];

    // Get all units for this chart
    const unitsResult = await req.dbClient!.query(
      `
      SELECT
        u.id, u.code, u.name_it, u.name_en, u.short_name,
        u.level, u.depth, u.path::text as path,
        u.parent_id, p.code as parent_code, p.name_it as parent_name,
        u.headcount_budget, u.headcount_actual,
        u.is_line, u.is_management, u.cost_center,
        u.manager_employee_id,
        e.first_name as manager_first_name, e.last_name as manager_last_name
      FROM tenant_org_units u
      LEFT JOIN tenant_org_units p ON u.parent_id = p.id
      LEFT JOIN employees e ON u.manager_employee_id = e.id
      WHERE u.chart_id = $1
      ORDER BY u.level, u.code
    `,
      [chart.id]
    );

    res.json({
      success: true,
      data: {
        chart: {
          id: chart.id,
          name: chart.name,
          status: chart.status,
          effectiveDate: chart.effective_date,
        },
        units: unitsResult.rows.map((row) => ({
          id: row.id,
          code: row.code,
          nameIt: row.name_it,
          nameEn: row.name_en,
          shortName: row.short_name,
          level: row.level,
          depth: row.depth,
          path: row.path,
          parentId: row.parent_id,
          parentCode: row.parent_code,
          parentName: row.parent_name,
          headcountBudget: row.headcount_budget,
          headcountActual: row.headcount_actual,
          isLine: row.is_line,
          isManagement: row.is_management,
          costCenter: row.cost_center,
          managerEmployeeId: row.manager_employee_id,
          managerName: row.manager_first_name
            ? `${row.manager_first_name} ${row.manager_last_name}`
            : null,
        })),
      },
    });
  })
);

// =============================================================================
// TENANT CONTEXT
// =============================================================================

/**
 * GET /org-charts/tenant-context
 * Get tenant context for org chart generation
 */
router.get(
  '/tenant-context',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const prototypeService = createIndustryPrototypeService(tenantId);
    const context = await prototypeService.getTenantContext();
    const prototype = await prototypeService.getPrototypeForTenant();

    res.json({
      success: true,
      data: {
        context,
        prototype,
      },
    });
  })
);

/**
 * GET /org-charts/industry-prototype
 * Get industry prototype for tenant
 */
router.get(
  '/industry-prototype',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);

    const prototypeService = createIndustryPrototypeService(tenantId);
    const prototype = await prototypeService.getPrototypeForTenant();

    res.json({
      success: true,
      data: prototype,
    });
  })
);

// =============================================================================
// SNAPSHOTS
// =============================================================================

/**
 * GET /org-charts/snapshots
 * List snapshots for tenant
 */
router.get(
  '/snapshots',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { sessionId, type, limit = 20 } = req.query as Record<string, string>;

    let query = `
      SELECT id, session_id, snapshot_name, snapshot_type, snapshot_version,
             statistics, is_active, created_at
      FROM org_chart_snapshots
      WHERE tenant_id = $1
    `;
    const params: (string | number)[] = [tenantId];

    if (sessionId && isValidUUID(sessionId as string)) {
      params.push(sessionId as string);
      query += ` AND session_id = $${params.length}`;
    }

    if (type) {
      params.push(type as string);
      query += ` AND snapshot_type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(safeParseInt(limit as string, { fallback: 50 }));

    const result = await req.dbClient!.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  })
);

/**
 * GET /org-charts/snapshots/:id
 * Get snapshot by ID
 */
router.get(
  '/snapshots/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;
    const { format } = req.query as Record<string, string>;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid snapshot ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const excalidrawService = createExcalidrawExportService(tenantId);
    const snapshot = await excalidrawService.getSnapshot(id);

    if (!snapshot) {
      throw createAppError('Snapshot not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (format === 'excalidraw') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="snapshot_${id}.excalidraw"`);
      res.send(JSON.stringify(snapshot.excalidrawFormat, null, 2));
      return;
    }

    res.json({
      success: true,
      data: snapshot,
    });
  })
);

/**
 * POST /org-charts/sessions/:id/snapshots
 * Create snapshot from session
 */
router.post(
  '/sessions/:id/snapshots',
  validate(createSnapshotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const { id } = req.params as Record<string, string>;
    const { snapshotName, snapshotType = 'staging' } = req.body;

    if (!id || !isValidUUID(id)) {
      throw createAppError('Invalid session ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const excalidrawService = createExcalidrawExportService(tenantId);
    const excalidrawFile = await excalidrawService.exportStagingToExcalidraw(id);

    const snapshotId = await excalidrawService.saveSnapshot(
      id,
      snapshotName || `Snapshot ${new Date().toISOString()}`,
      snapshotType,
      excalidrawFile
    );

    res.status(201).json({
      success: true,
      data: {
        snapshotId,
        snapshotName: snapshotName || `Snapshot ${new Date().toISOString()}`,
      },
    });
  })
);

export default router;
