/**
 * Enrichment Consent Routes — P3-17 GDPR Consent
 *
 * Employee-facing endpoints for managing enrichment consent.
 * All endpoints operate on the authenticated user's own employee record.
 *
 * - GET  /api/v1/enrichment-consent/me          → current consent status
 * - POST /api/v1/enrichment-consent/me/grant     → grant consent (body: { scopes: string[] })
 * - POST /api/v1/enrichment-consent/me/revoke    → revoke consent + GDPR data erasure
 */
import { Router } from 'express';
import { asyncHandler, sendSuccess } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';
import { logger } from '../config/logger.js';
const router = Router();
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resolveEmployeeId(req) {
    const authReq = req;
    const employeeId = authReq.user?.employeeId;
    if (!employeeId) {
        throw Errors.notFound('No employee profile linked to this user');
    }
    return employeeId;
}
// ---------------------------------------------------------------------------
// GET /me — current consent status
// ---------------------------------------------------------------------------
router.get('/me', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = resolveEmployeeId(req);
    const result = await req.dbClient.query(`SELECT enrichment_consent_at, enrichment_consent_scope
       FROM employees
       WHERE id = $1 AND tenant_id = $2`, [employeeId, tenantId]);
    if (result.rowCount === 0) {
        throw Errors.notFound('Employee record not found');
    }
    const row = result.rows[0];
    sendSuccess(res, {
        consented: row.enrichment_consent_at !== null,
        consentedAt: row.enrichment_consent_at ?? null,
        scopes: row.enrichment_consent_scope ?? [],
    });
}));
// ---------------------------------------------------------------------------
// POST /me/grant — grant consent
// ---------------------------------------------------------------------------
router.post('/me/grant', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = resolveEmployeeId(req);
    const { scopes } = req.body;
    if (!Array.isArray(scopes) || scopes.length === 0) {
        throw Errors.badRequest('scopes must be a non-empty string array');
    }
    // Validate scope values (whitelist)
    const ALLOWED_SCOPES = ['professional_profile', 'skills', 'education', 'certifications'];
    for (const s of scopes) {
        if (!ALLOWED_SCOPES.includes(s)) {
            throw Errors.badRequest(`Invalid scope: ${s}. Allowed: ${ALLOWED_SCOPES.join(', ')}`);
        }
    }
    const result = await req.dbClient.query(`UPDATE employees
       SET enrichment_consent_at = NOW(),
           enrichment_consent_scope = $1
       WHERE id = $2 AND tenant_id = $3`, [scopes, employeeId, tenantId]);
    // Review fix H9: check rowCount
    if (!result.rowCount || result.rowCount === 0) {
        throw Errors.notFound('Employee record not found');
    }
    logger.info({ employeeId, tenantId, scopes }, '[enrichment-consent] consent granted');
    sendSuccess(res, {
        consented: true,
        consentedAt: new Date().toISOString(),
        scopes,
    });
}));
// ---------------------------------------------------------------------------
// POST /me/revoke — revoke consent + GDPR data erasure
// ---------------------------------------------------------------------------
router.post('/me/revoke', asyncHandler(async (req, res) => {
    const tenantId = getTenantIdOrThrow(req);
    const employeeId = resolveEmployeeId(req);
    // 1. Clear consent on employee record
    const updateResult = await req.dbClient.query(`UPDATE employees
       SET enrichment_consent_at = NULL,
           enrichment_consent_scope = NULL
       WHERE id = $1 AND tenant_id = $2`, [employeeId, tenantId]);
    if (!updateResult.rowCount || updateResult.rowCount === 0) {
        throw Errors.notFound('Employee record not found');
    }
    // 2. Review fix C1: GDPR data erasure — remove enrichment candidates
    const candidatesResult = await req.dbClient.query(`DELETE FROM enrichment_candidates
       WHERE entity_id = $1::text AND tenant_id = $2`, [employeeId, tenantId]);
    const candidatesPurged = candidatesResult.rowCount ?? 0;
    // 3. Cancel pending/running enrichment jobs for this employee
    const jobsResult = await req.dbClient.query(`UPDATE enrichment_jobs
       SET status = 'cancelled', updated_at = NOW()
       WHERE entity_id = $1::text AND tenant_id = $2
         AND status IN ('pending', 'running')`, [employeeId, tenantId]);
    const jobsCancelled = jobsResult.rowCount ?? 0;
    const totalPurged = candidatesPurged + jobsCancelled;
    // 4. Audit trail
    logger.info({
        employeeId,
        tenantId,
        candidatesPurged,
        jobsCancelled,
    }, '[enrichment-consent] consent revoked — GDPR data erasure completed');
    sendSuccess(res, {
        consented: false,
        dataRemoved: true,
        recordsPurged: totalPurged,
    });
}));
export default router;
//# sourceMappingURL=enrichment-consent.js.map