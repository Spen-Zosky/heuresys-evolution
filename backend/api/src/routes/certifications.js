/**
 * Certifications Routes
 * CRUD operations for certifications and employee certifications
 */
import { Router } from 'express';
import { requireTenant, getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { validate } from '../middleware/validate.js';
import { createCertificationSchema, updateCertificationSchema, } from '../schemas/skills-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { cachedForTenant, CACHE_TTL } from '../services/cache.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
router.use(requireTenant);
// =============================================================================
// EMPLOYEE SELF-SERVICE ENDPOINTS (must be before parametric routes)
// =============================================================================
/**
 * GET /certifications/me
 * Get current employee's certifications
 */
router.get('/me', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const authReq = req;
    const employeeId = authReq.user?.employeeId;
    if (!employeeId) {
        throw Errors.unauthorized('No employee profile linked to this user');
    }
    const result = await req.dbClient.query(`
      SELECT
        ec.id as certification_record_id,
        ec.issued_date,
        ec.expiry_date,
        ec.status,
        ec.credential_id,
        ec.credential_url,
        ec.document_url,
        c.id as certification_id,
        c.name,
        c.name_en,
        c.issuing_organization,
        c.validity_months,
        c.verification_url,
        CASE
          WHEN ec.expiry_date IS NOT NULL AND ec.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN ec.expiry_date IS NOT NULL AND ec.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE ec.status
        END as display_status
      FROM employee_certifications ec
      JOIN certifications c ON ec.certification_id = c.id
      JOIN employees e ON ec.employee_id = e.id
      WHERE ec.employee_id = $1 AND e.tenant_id = $2
      ORDER BY
        CASE ec.status WHEN 'active' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
        ec.expiry_date ASC NULLS LAST
    `, [employeeId, tenantId]);
    // Transform to match frontend expectations
    const certifications = result.rows.map((row) => ({
        id: row.certification_record_id,
        certificationId: row.certification_id,
        name: row.name,
        issuer: row.issuing_organization,
        issuedDate: row.issued_date,
        expiryDate: row.expiry_date,
        status: row.display_status,
        credentialId: row.credential_id,
        credentialUrl: row.credential_url,
        documentUrl: row.document_url,
        validityMonths: row.validity_months,
    }));
    res.json({
        success: true,
        data: certifications,
        meta: {
            total: result.rows.length,
            active: result.rows.filter((r) => r.status === 'active').length,
            inProgress: result.rows.filter((r) => r.status === 'in_progress').length,
        },
    });
}));
/**
 * Get certifications for a specific employee (admin/manager view).
 * Returns the same shape as /me but for any employee_id.
 */
router.get('/employee/:employeeId', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { employeeId } = req.params;
    const result = await req.dbClient.query(`
      SELECT
        ec.id as certification_record_id,
        ec.issued_date,
        ec.expiry_date,
        ec.status,
        ec.credential_id,
        ec.credential_url,
        ec.document_url,
        c.id as certification_id,
        c.name,
        c.name_en,
        c.issuing_organization,
        c.validity_months,
        c.verification_url,
        CASE
          WHEN ec.expiry_date IS NOT NULL AND ec.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN ec.expiry_date IS NOT NULL AND ec.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE ec.status
        END as display_status
      FROM employee_certifications ec
      JOIN certifications c ON ec.certification_id = c.id
      JOIN employees e ON ec.employee_id = e.id
      WHERE ec.employee_id = $1 AND e.tenant_id = $2
      ORDER BY
        CASE ec.status WHEN 'active' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
        ec.expiry_date ASC NULLS LAST
    `, [employeeId, tenantId]);
    const certifications = result.rows.map((row) => ({
        id: row.certification_record_id,
        certificationId: row.certification_id,
        name: row.name,
        issuer: row.issuing_organization,
        issuedDate: row.issued_date,
        expiryDate: row.expiry_date,
        status: row.display_status,
        credentialId: row.credential_id,
        credentialUrl: row.credential_url,
        documentUrl: row.document_url,
        validityMonths: row.validity_months,
    }));
    res.json({
        success: true,
        data: certifications,
        meta: {
            total: result.rows.length,
            active: result.rows.filter((r) => r.status === 'active').length,
            inProgress: result.rows.filter((r) => r.status === 'in_progress').length,
        },
    });
}));
// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================
/**
 * GET /certifications
 */
router.get('/', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { is_active, is_internal, search, limit = '100', offset = '0', } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 100 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    const hasFilters = is_active !== undefined || is_internal !== undefined || search;
    const fetchData = async () => {
        let query = `
        SELECT c.*,
          (SELECT COUNT(*) FROM employee_certifications ec WHERE ec.certification_id = c.id) as holder_count
        FROM certifications c
        WHERE c.tenant_id = $1
      `;
        const params = [tenantId];
        let paramIndex = 2;
        if (is_active !== undefined) {
            query += ` AND c.is_active = $${paramIndex}`;
            params.push(is_active === 'true');
            paramIndex++;
        }
        if (is_internal !== undefined) {
            query += ` AND c.is_internal = $${paramIndex}`;
            params.push(is_internal === 'true');
            paramIndex++;
        }
        if (search) {
            query += ` AND (c.name ILIKE $${paramIndex} OR c.issuing_organization ILIKE $${paramIndex})`;
            params.push(`%${escapeILIKE(search)}%`);
            paramIndex++;
        }
        query += ` ORDER BY c.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limitNum, offsetNum);
        const result = await req.dbClient.query(query, params);
        const countResult = await req.dbClient.query('SELECT COUNT(*) FROM certifications WHERE tenant_id = $1', [tenantId]);
        return {
            rows: result.rows,
            total: parseInt(countResult.rows[0]?.count),
        };
    };
    const data = hasFilters
        ? await fetchData()
        : await cachedForTenant(tenantId, `certifications:list:${limitNum}:${offsetNum}`, fetchData, CACHE_TTL.MODERATE);
    res.json({
        success: true,
        data: data.rows,
        meta: {
            total: data.total,
            limit: limitNum,
            offset: offsetNum,
        },
    });
}));
/**
 * GET /certifications/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM employee_certifications ec WHERE ec.certification_id = c.id) as holder_count,
        (SELECT COUNT(*) FROM employee_certifications ec WHERE ec.certification_id = c.id AND ec.expiry_date < NOW()) as expired_count
      FROM certifications c
      WHERE c.id = $1 AND c.tenant_id = $2
    `, [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Certification');
    }
    res.json({ success: true, data: result.rows[0] || null });
}));
/**
 * POST /certifications
 */
router.post('/', validate(createCertificationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const { code, name, name_en, issuing_organization, description, validity_months, renewal_requirements, verification_url, is_internal = false, is_active = true, } = req.body;
    if (!name) {
        throw Errors.badRequest('Name is required');
    }
    const result = await req.dbClient.query(`
      INSERT INTO certifications (tenant_id, code, name, name_en, issuing_organization, description,
        validity_months, renewal_requirements, verification_url, is_internal, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `, [
        tenantId,
        code,
        name,
        name_en,
        issuing_organization,
        description,
        validity_months,
        renewal_requirements,
        verification_url,
        is_internal,
        is_active,
    ]);
    res
        .status(201)
        .json({ success: true, data: result.rows[0] || null, message: 'Certification created' });
}));
/**
 * PATCH /certifications/:id
 */
router.patch('/:id', validate(updateCertificationSchema), asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const existing = await req.dbClient.query('SELECT id FROM certifications WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (existing.rows.length === 0) {
        throw Errors.notFound('Certification');
    }
    const allowedFields = [
        'name',
        'name_en',
        'issuing_organization',
        'description',
        'validity_months',
        'renewal_requirements',
        'verification_url',
        'is_internal',
        'is_active',
    ];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(req.body[field]);
            paramIndex++;
        }
    }
    if (updates.length === 0) {
        throw Errors.badRequest('No fields to update');
    }
    const result = await req.dbClient.query(`UPDATE certifications SET ${updates.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`, [...values, id, tenantId]);
    res.json({ success: true, data: result.rows[0] || null, message: 'Certification updated' });
}));
/**
 * DELETE /certifications/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query('UPDATE certifications SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId]);
    if (result.rows.length === 0) {
        throw Errors.notFound('Certification');
    }
    res.json({ success: true, message: 'Certification deactivated' });
}));
/**
 * GET /certifications/:id/holders
 */
router.get('/:id/holders', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const id = req.params['id'];
    const result = await req.dbClient.query(`
      SELECT ec.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.email as employee_email,
        ec.expiry_date < NOW() as is_expired
      FROM employee_certifications ec
      JOIN employees e ON ec.employee_id = e.id
      WHERE ec.certification_id = $1 AND e.tenant_id = $2
      ORDER BY ec.expiry_date ASC NULLS LAST
    `, [id, tenantId]);
    res.json({ success: true, data: result.rows });
}));
export default router;
//# sourceMappingURL=certifications.js.map