/**
 * Contract Management Routes
 * CRUD operations for employee contracts
 * Epic: 3 - Employee Data Management
 * Story: 3.4 - Contract Management
 */
import { Router } from 'express';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes, CCNL_TYPES } from '@heuresys/shared';
import { requireTenant } from '../middleware/tenantContext.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { PERMISSIONS } from '@heuresys/shared';
import { validateIdentifier } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createContractSchema, updateContractSchema, terminateContractSchema, createAmendmentSchema, } from '../schemas/employees.js';
import { asyncHandler } from '../errors/middleware.js';
import { buildMeta } from '../utils/pagination.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// All routes require tenant context and authentication
router.use(requireTenant);
router.use(authMiddleware);
// =============================================================================
// CONTRACT TYPES METADATA
// =============================================================================
const CONTRACT_TYPES = {
    tempo_indeterminato: { label: 'Tempo Indeterminato', requiresEndDate: false },
    tempo_determinato: { label: 'Tempo Determinato', requiresEndDate: true },
    apprendistato: { label: 'Apprendistato', requiresEndDate: true },
    somministrazione: { label: 'Somministrazione', requiresEndDate: true },
    collaborazione: { label: 'Collaborazione', requiresEndDate: true },
};
const AMENDMENT_TYPES = {
    salary_change: 'Variazione Retributiva',
    role_change: 'Cambio Ruolo',
    schedule_change: 'Variazione Orario',
    renewal: 'Rinnovo Contratto',
    promotion: 'Promozione',
    transfer: 'Trasferimento',
    other: 'Altro',
};
// =============================================================================
// GET /api/v1/contracts
// List employee contracts with pagination
// =============================================================================
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const limit = safeParseInt(req.query.limit, { fallback: 50, max: 200 });
    const offset = safeParseInt(req.query.offset, { fallback: 0 });
    const employeeId = req.query.employee_id;
    let whereClause = 'WHERE ec.tenant_id = $1';
    const params = [tenantId];
    if (employeeId) {
        params.push(employeeId);
        whereClause += ` AND ec.employee_id = $${params.length}`;
    }
    const [countResult, dataResult] = await Promise.all([
        req.dbClient.query(`SELECT COUNT(*) as total FROM employee_contracts ec ${whereClause}`, params),
        req.dbClient.query(`SELECT ec.id, ec.employee_id, ec.contract_type, ec.start_date, ec.end_date,
                ec.ccnl_code, ec.level, ec.annual_salary, ec.currency, ec.fte_percentage,
                ec.is_current, ec.created_at,
                e.first_name, e.last_name
         FROM employee_contracts ec
         JOIN employees e ON ec.employee_id = e.id
         ${whereClause}
         ORDER BY ec.start_date DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    ]);
    res.json({
        success: true,
        data: dataResult.rows,
        meta: buildMeta(parseInt(countResult.rows[0]?.total), limit, offset),
    });
}));
// =============================================================================
// GET /api/v1/contracts/meta/types
// Get available contract types
// =============================================================================
router.get('/meta/types', (_req, res) => {
    const types = Object.entries(CONTRACT_TYPES).map(([value, meta]) => ({
        value,
        label: meta.label,
        requiresEndDate: meta.requiresEndDate,
    }));
    res.json({
        success: true,
        data: types,
    });
});
// =============================================================================
// GET /api/v1/contracts/meta/ccnl
// Get available CCNL types
// =============================================================================
router.get('/meta/ccnl', (_req, res) => {
    const ccnlOptions = Object.entries(CCNL_TYPES).map(([key, value]) => ({
        value,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
    res.json({
        success: true,
        data: ccnlOptions,
    });
});
// =============================================================================
// GET /api/v1/contracts/meta/amendment-types
// Get available amendment types
// =============================================================================
router.get('/meta/amendment-types', (_req, res) => {
    const types = Object.entries(AMENDMENT_TYPES).map(([value, label]) => ({
        value,
        label,
    }));
    res.json({
        success: true,
        data: types,
    });
});
// =============================================================================
// GET /api/v1/contracts
// List all contracts with filtering and pagination
// =============================================================================
router.get('/', checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL, PERMISSIONS.EMPLOYEES_VIEW_TEAM), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { employeeId, status, contractType, orgUnitId, startDateFrom, startDateTo, expiringBefore, page = '1', limit = '20', sortBy = 'start_date', sortOrder = 'desc', } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;
    // Build dynamic WHERE clause
    const conditions = ['c.tenant_id = $1'];
    const params = [tenantId];
    let paramIndex = 2;
    if (employeeId) {
        conditions.push(`c.employee_id = $${paramIndex++}`);
        params.push(employeeId);
    }
    if (status) {
        conditions.push(`c.status = $${paramIndex++}`);
        params.push(status);
    }
    if (contractType) {
        conditions.push(`c.contract_type = $${paramIndex++}`);
        params.push(contractType);
    }
    if (orgUnitId) {
        conditions.push(`c.org_unit_id = $${paramIndex++}`);
        params.push(orgUnitId);
    }
    if (startDateFrom) {
        conditions.push(`c.start_date >= $${paramIndex++}`);
        params.push(startDateFrom);
    }
    if (startDateTo) {
        conditions.push(`c.start_date <= $${paramIndex++}`);
        params.push(startDateTo);
    }
    if (expiringBefore) {
        conditions.push(`c.end_date IS NOT NULL AND c.end_date <= $${paramIndex++}`);
        params.push(expiringBefore);
    }
    const whereClause = conditions.join(' AND ');
    // Validate sort column
    const validSortColumns = [
        'start_date',
        'end_date',
        'created_at',
        'gross_annual_salary',
        'contract_type',
        'status',
    ];
    const sortColumn = validateIdentifier(validSortColumns.includes(sortBy) ? sortBy : 'start_date', 'contracts.list-sort');
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    // Get total count
    const countResult = await req.dbClient.query(`SELECT COUNT(*) FROM contracts c WHERE ${whereClause}`, params);
    const totalCount = parseInt(countResult.rows[0]?.count, 10);
    // Get contracts with employee info
    const result = await req.dbClient.query(`SELECT
          c.id, c.tenant_id, c.employee_id, c.contract_type, c.contract_code,
          c.start_date, c.end_date, c.probation_end_date,
          c.ccnl_type, c.ccnl_level, c.gross_annual_salary, c.currency,
          c.salary_type, c.payment_frequency, c.work_hours_weekly,
          c.work_schedule_type, c.part_time_percentage,
          c.job_title, c.org_unit_id, c.location_id, c.cost_center_id,
          c.status, c.termination_date, c.termination_reason,
          c.created_at, c.updated_at,
          e.first_name as employee_first_name,
          e.last_name as employee_last_name,
          e.pernr as employee_code,
          d.name as department_name,
          l.name as location_name,
          cc.name as cost_center_name
        FROM contracts c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN org_units d ON c.org_unit_id = d.id
        LEFT JOIN locations l ON c.location_id = l.id
        LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
        WHERE ${whereClause}
        ORDER BY c.${sortColumn} ${sortDir}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`, [...params, limitNum, offset]);
    res.json({
        success: true,
        data: result.rows,
        meta: buildMeta(totalCount, limitNum, offset),
    });
}));
// =============================================================================
// GET /api/v1/contracts/expiring
// Get contracts expiring within a specified period
// =============================================================================
router.get('/expiring', checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { days = '30' } = req.query;
    const daysNum = Math.max(1, Math.min(365, parseInt(days, 10)));
    const result = await req.dbClient.query(`SELECT
          c.id, c.tenant_id, c.employee_id, c.contract_type, c.contract_code,
          c.start_date, c.end_date, c.probation_end_date,
          c.ccnl_type, c.ccnl_level, c.gross_annual_salary, c.currency,
          c.job_title, c.org_unit_id, c.status,
          c.created_at, c.updated_at,
          e.first_name as employee_first_name,
          e.last_name as employee_last_name,
          e.pernr as employee_code,
          e.email as employee_email,
          d.name as department_name
        FROM contracts c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN org_units d ON c.org_unit_id = d.id
        WHERE c.tenant_id = $1
          AND c.status = 'active'
          AND c.end_date IS NOT NULL
          AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 * INTERVAL '1 day')
        ORDER BY c.end_date ASC`, [tenantId, daysNum]);
    res.json({
        success: true,
        data: result.rows,
        meta: {
            period: `${daysNum} days`,
            count: result.rows.length,
        },
    });
}));
// =============================================================================
// GET /api/v1/contracts/employee/:employeeId
// Get all contracts for a specific employee
// =============================================================================
router.get('/employee/:employeeId', checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL, PERMISSIONS.EMPLOYEES_VIEW_TEAM, PERMISSIONS.EMPLOYEES_VIEW_OWN), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { employeeId } = req.params;
    const result = await req.dbClient.query(`SELECT
          c.id, c.tenant_id, c.employee_id, c.contract_type, c.contract_code,
          c.start_date, c.end_date, c.probation_end_date,
          c.ccnl_type, c.ccnl_level, c.gross_annual_salary, c.currency,
          c.salary_type, c.payment_frequency, c.work_hours_weekly,
          c.work_schedule_type, c.part_time_percentage,
          c.job_title, c.job_description, c.org_unit_id, c.location_id, c.cost_center_id,
          c.status, c.termination_date, c.termination_reason, c.notes,
          c.created_at, c.updated_at,
          d.name as department_name,
          l.name as location_name,
          cc.name as cost_center_name,
          CASE
            WHEN c.contract_type = 'permanent' AND c.end_date IS NULL THEN
              calculate_expected_retirement_date(e.birth_date, c.start_date, c.tenant_id)
            ELSE NULL
          END AS expected_retirement_date
        FROM contracts c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN org_units d ON c.org_unit_id = d.id
        LEFT JOIN locations l ON c.location_id = l.id
        LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
        WHERE c.tenant_id = $1 AND c.employee_id = $2
        ORDER BY c.start_date DESC`, [tenantId, employeeId]);
    // Get active contract
    const activeContract = result.rows.find((c) => c.status === 'active');
    res.json({
        success: true,
        data: {
            contracts: result.rows,
            activeContract: activeContract || null,
            totalContracts: result.rows.length,
        },
    });
}));
// =============================================================================
// GET /api/v1/contracts/:id
// Get a specific contract by ID
// =============================================================================
router.get('/:id', validateUUID(), checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL, PERMISSIONS.EMPLOYEES_VIEW_TEAM), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { id } = req.params;
    const result = await req.dbClient.query(`SELECT
          c.id, c.tenant_id, c.employee_id, c.contract_type, c.contract_code,
          c.start_date, c.end_date, c.probation_end_date,
          c.ccnl_type, c.ccnl_level, c.gross_annual_salary, c.currency,
          c.salary_type, c.payment_frequency, c.work_hours_weekly,
          c.work_schedule_type, c.part_time_percentage,
          c.job_title, c.job_description, c.org_unit_id, c.location_id, c.cost_center_id,
          c.status, c.termination_date, c.termination_reason, c.notes, c.metadata,
          c.created_at, c.updated_at, c.created_by, c.updated_by,
          e.first_name as employee_first_name,
          e.last_name as employee_last_name,
          e.pernr as employee_code,
          d.name as department_name,
          l.name as location_name,
          cc.name as cost_center_name
        FROM contracts c
        LEFT JOIN employees e ON c.employee_id = e.id
        LEFT JOIN org_units d ON c.org_unit_id = d.id
        LEFT JOIN locations l ON c.location_id = l.id
        LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
        WHERE c.id = $1 AND c.tenant_id = $2`, [id, tenantId]);
    if (result.rows.length === 0) {
        throw createAppError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }
    // Get amendments for this contract
    const amendmentsResult = await req.dbClient.query(`SELECT id, contract_id, tenant_id, amendment_type, effective_date,
              description, previous_values, new_values, created_at, created_by,
              approved_by, approved_at
       FROM contract_amendments
         WHERE contract_id = $1 AND tenant_id = $2
         ORDER BY effective_date DESC`, [id, tenantId]);
    res.json({
        success: true,
        data: {
            ...(result.rows[0] || {}),
            amendments: amendmentsResult.rows,
        },
    });
}));
// =============================================================================
// POST /api/v1/contracts
// Create a new contract
// =============================================================================
router.post('/', checkPermission(PERMISSIONS.EMPLOYEES_CREATE, PERMISSIONS.EMPLOYEES_UPDATE), validate(createContractSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const userId = tenantReq.user?.userId;
    const input = req.body;
    // Validate required fields
    if (!input.employeeId) {
        throw createAppError('Employee ID is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!input.contractType || !Object.keys(CONTRACT_TYPES).includes(input.contractType)) {
        throw createAppError('Valid contract type is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!input.startDate) {
        throw createAppError('Start date is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Validate end date requirement based on contract type
    const contractMeta = CONTRACT_TYPES[input.contractType];
    if (contractMeta.requiresEndDate && !input.endDate) {
        throw createAppError(`End date is required for ${contractMeta.label} contracts`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Check if employee exists
    const employeeCheck = await req.dbClient.query('SELECT id FROM employees WHERE id = $1 AND tenant_id = $2', [input.employeeId, tenantId]);
    if (employeeCheck.rows.length === 0) {
        throw createAppError('Employee not found', 404, ErrorCodes.NOT_FOUND);
    }
    // Check for overlapping active contracts
    const overlapCheck = await req.dbClient.query(`SELECT id FROM contracts
         WHERE employee_id = $1
         AND tenant_id = $2
         AND status = 'active'
         AND (end_date IS NULL OR end_date >= $3)
         AND start_date <= COALESCE($4, '9999-12-31')`, [input.employeeId, tenantId, input.startDate, input.endDate || null]);
    if (overlapCheck.rows.length > 0) {
        throw createAppError('Employee already has an active contract during this period', 409, ErrorCodes.CONFLICT);
    }
    // Create the contract
    const result = await req.dbClient.query(`INSERT INTO contracts (
          tenant_id, employee_id, contract_type, contract_code,
          start_date, end_date, probation_end_date,
          ccnl_type, ccnl_level,
          gross_annual_salary, currency, salary_type, payment_frequency,
          work_hours_weekly, work_schedule_type, part_time_percentage,
          job_title, job_description, org_unit_id, location_id, cost_center_id,
          status, notes, metadata, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25
        ) RETURNING *`, [
        tenantId,
        input.employeeId,
        input.contractType,
        input.contractCode || null,
        input.startDate,
        input.endDate || null,
        input.probationEndDate || null,
        input.ccnlType || null,
        input.ccnlLevel || null,
        input.grossAnnualSalary || null,
        input.currency || 'EUR',
        input.salaryType || 'annual',
        input.paymentFrequency || 'monthly',
        input.workHoursWeekly || 40,
        input.workScheduleType || 'full_time',
        input.partTimePercentage || null,
        input.jobTitle || null,
        input.jobDescription || null,
        input.orgUnitId || null,
        input.locationId || null,
        input.costCenterId || null,
        input.status || 'active',
        input.notes || null,
        JSON.stringify(input.metadata || {}),
        userId,
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        message: 'Contract created successfully',
    });
}));
// =============================================================================
// PUT /api/v1/contracts/:id
// Update a contract
// =============================================================================
router.put('/:id', validateUUID(), checkPermission(PERMISSIONS.EMPLOYEES_UPDATE), validate(updateContractSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const userId = tenantReq.user?.userId;
    const { id } = req.params;
    const input = req.body;
    // Check if contract exists
    const existingResult = await req.dbClient.query(`SELECT id, tenant_id, employee_id, contract_type, contract_code,
              start_date, end_date, probation_end_date, ccnl_type, ccnl_level,
              gross_annual_salary, currency, salary_type, payment_frequency,
              work_hours_weekly, work_schedule_type, part_time_percentage,
              job_title, job_description, org_unit_id, location_id, cost_center_id,
              status, termination_date, termination_reason, notes, metadata,
              created_at, updated_at, created_by, updated_by
       FROM contracts WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (existingResult.rows.length === 0) {
        throw createAppError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }
    const existing = existingResult.rows[0];
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    const fieldMappings = {
        contractType: 'contract_type',
        contractCode: 'contract_code',
        startDate: 'start_date',
        endDate: 'end_date',
        probationEndDate: 'probation_end_date',
        ccnlType: 'ccnl_type',
        ccnlLevel: 'ccnl_level',
        grossAnnualSalary: 'gross_annual_salary',
        currency: 'currency',
        salaryType: 'salary_type',
        paymentFrequency: 'payment_frequency',
        workHoursWeekly: 'work_hours_weekly',
        workScheduleType: 'work_schedule_type',
        partTimePercentage: 'part_time_percentage',
        jobTitle: 'job_title',
        jobDescription: 'job_description',
        orgUnitId: 'org_unit_id',
        locationId: 'location_id',
        costCenterId: 'cost_center_id',
        status: 'status',
        terminationDate: 'termination_date',
        terminationReason: 'termination_reason',
        notes: 'notes',
        metadata: 'metadata',
    };
    for (const [inputKey, dbColumn] of Object.entries(fieldMappings)) {
        if (inputKey in input) {
            const value = input[inputKey];
            updates.push(`${dbColumn} = $${paramIndex++}`);
            values.push(inputKey === 'metadata' ? JSON.stringify(value) : value);
        }
    }
    if (updates.length === 0) {
        throw createAppError('No fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }
    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);
    values.push(tenantId);
    const result = await req.dbClient.query(`UPDATE contracts SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
         RETURNING *`, values);
    // Auto-create amendment if significant fields changed
    const significantFields = [
        'gross_annual_salary',
        'job_title',
        'org_unit_id',
        'work_hours_weekly',
    ];
    const changedFields = {};
    for (const field of significantFields) {
        const inputKey = Object.entries(fieldMappings).find(([, v]) => v === field)?.[0];
        if (inputKey && inputKey in input) {
            const newValue = input[inputKey];
            if (existing[field] !== newValue) {
                changedFields[field] = { old: existing[field], new: newValue };
            }
        }
    }
    if (Object.keys(changedFields).length > 0) {
        await req.dbClient.query(`INSERT INTO contract_amendments (
            contract_id, tenant_id, amendment_type, effective_date,
            description, previous_values, new_values, created_by
          ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7)`, [
            id,
            tenantId,
            'other',
            'Auto-generated amendment from contract update',
            JSON.stringify(Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.old]))),
            JSON.stringify(Object.fromEntries(Object.entries(changedFields).map(([k, v]) => [k, v.new]))),
            userId,
        ]);
    }
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Contract updated successfully',
    });
}));
// =============================================================================
// POST /api/v1/contracts/:id/terminate
// Terminate a contract
// =============================================================================
router.post('/:id/terminate', validateUUID(), checkPermission(PERMISSIONS.EMPLOYEES_UPDATE), validate(terminateContractSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const userId = tenantReq.user?.userId;
    const { id } = req.params;
    const { terminationDate, terminationReason } = req.body;
    if (!terminationDate) {
        throw createAppError('Termination date is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Check if contract exists and is active
    const existingResult = await req.dbClient.query(`SELECT id, tenant_id, employee_id, contract_type, status,
              start_date, end_date, gross_annual_salary, job_title,
              org_unit_id, work_hours_weekly
       FROM contracts WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (existingResult.rows.length === 0) {
        throw createAppError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }
    const existing = existingResult.rows[0];
    if (existing.status !== 'active') {
        throw createAppError('Only active contracts can be terminated', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const result = await req.dbClient.query(`UPDATE contracts SET
          status = 'terminated',
          termination_date = $1,
          termination_reason = $2,
          updated_at = NOW(),
          updated_by = $3
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`, [terminationDate, terminationReason || null, userId, id, tenantId]);
    res.json({
        success: true,
        data: result.rows[0] || null,
        message: 'Contract terminated successfully',
    });
}));
// =============================================================================
// POST /api/v1/contracts/:id/amendments
// Add an amendment to a contract
// =============================================================================
router.post('/:id/amendments', checkPermission(PERMISSIONS.EMPLOYEES_UPDATE), validate(createAmendmentSchema), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const userId = tenantReq.user?.userId;
    const { id } = req.params;
    const input = req.body;
    // Validate required fields
    if (!input.amendmentType || !Object.keys(AMENDMENT_TYPES).includes(input.amendmentType)) {
        throw createAppError('Valid amendment type is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!input.effectiveDate) {
        throw createAppError('Effective date is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    // Check if contract exists
    const contractCheck = await req.dbClient.query('SELECT id FROM contracts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (contractCheck.rows.length === 0) {
        throw createAppError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }
    const result = await req.dbClient.query(`INSERT INTO contract_amendments (
          contract_id, tenant_id, amendment_type, effective_date,
          description, previous_values, new_values, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`, [
        id,
        tenantId,
        input.amendmentType,
        input.effectiveDate,
        input.description || null,
        JSON.stringify(input.previousValues || {}),
        JSON.stringify(input.newValues || {}),
        userId,
    ]);
    res.status(201).json({
        success: true,
        data: result.rows[0] || null,
        message: 'Amendment added successfully',
    });
}));
// =============================================================================
// GET /api/v1/contracts/:id/amendments
// Get all amendments for a contract
// =============================================================================
router.get('/:id/amendments', checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL, PERMISSIONS.EMPLOYEES_VIEW_TEAM), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { id } = req.params;
    // Check if contract exists
    const contractCheck = await req.dbClient.query('SELECT id FROM contracts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (contractCheck.rows.length === 0) {
        throw createAppError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }
    const result = await req.dbClient.query(`SELECT ca.*, u.username as created_by_username
         FROM contract_amendments ca
         LEFT JOIN users u ON ca.created_by = u.id
         WHERE ca.contract_id = $1 AND ca.tenant_id = $2
         ORDER BY ca.effective_date DESC, ca.created_at DESC`, [id, tenantId]);
    res.json({
        success: true,
        data: result.rows,
    });
}));
// =============================================================================
// DELETE /api/v1/contracts/:id
// Delete a contract (only draft status)
// =============================================================================
router.delete('/:id', validateUUID(), checkPermission(PERMISSIONS.EMPLOYEES_DELETE), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const { id } = req.params;
    // Check if contract exists and is draft
    const existingResult = await req.dbClient.query('SELECT status FROM contracts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existingResult.rows.length === 0) {
        throw createAppError('Contract not found', 404, ErrorCodes.NOT_FOUND);
    }
    if (existingResult.rows[0].status !== 'draft') {
        throw createAppError('Only draft contracts can be deleted. Use termination for active contracts.', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await req.dbClient.query('DELETE FROM contracts WHERE id = $1 AND tenant_id = $2', [
        id,
        tenantId,
    ]);
    res.json({
        success: true,
        message: 'Contract deleted successfully',
    });
}));
// =============================================================================
// GET /api/v1/contracts/statistics
// Get contract statistics for the tenant
// =============================================================================
router.get('/statistics', checkPermission(PERMISSIONS.EMPLOYEES_VIEW_ALL), asyncHandler(async (req, res) => {
    const tenantReq = req;
    const tenantId = tenantReq.tenant.id;
    const [totalResult, byTypeResult, byStatusResult, expiringResult, avgSalaryResult] = await Promise.all([
        // Total contracts
        req.dbClient.query('SELECT COUNT(*) FROM contracts WHERE tenant_id = $1', [tenantId]),
        // By contract type
        req.dbClient.query(`SELECT contract_type, COUNT(*) as count
           FROM contracts WHERE tenant_id = $1 GROUP BY contract_type`, [tenantId]),
        // By status
        req.dbClient.query(`SELECT status, COUNT(*) as count
           FROM contracts WHERE tenant_id = $1 GROUP BY status`, [tenantId]),
        // Expiring in next 30 days
        req.dbClient.query(`SELECT COUNT(*) FROM contracts
           WHERE tenant_id = $1
           AND status = 'active'
           AND end_date IS NOT NULL
           AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`, [tenantId]),
        // Average salary
        req.dbClient.query(`SELECT AVG(gross_annual_salary) as avg_salary
           FROM contracts
           WHERE tenant_id = $1 AND status = 'active' AND gross_annual_salary IS NOT NULL`, [tenantId]),
    ]);
    res.json({
        success: true,
        data: {
            totalContracts: parseInt(totalResult.rows[0]?.count, 10),
            byType: byTypeResult.rows.reduce((acc, row) => {
                acc[row.contract_type] = parseInt(row.count, 10);
                return acc;
            }, {}),
            byStatus: byStatusResult.rows.reduce((acc, row) => {
                acc[row.status] = parseInt(row.count, 10);
                return acc;
            }, {}),
            expiringIn30Days: parseInt(expiringResult.rows[0]?.count, 10),
            averageSalary: avgSalaryResult.rows[0]?.avg_salary
                ? parseFloat(avgSalaryResult.rows[0]?.avg_salary).toFixed(2)
                : null,
        },
    });
}));
export default router;
//# sourceMappingURL=contracts.js.map