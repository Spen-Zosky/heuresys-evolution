/**
 * Export Engine Routes
 * PDF/Excel report generation for blueprint, skill gap, org chart, skill inventory.
 * Horizon O2.3
 * Mount point: /api/v1/export
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireTenant } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { ExportEngineService } from '../services/export-engine.js';
const router = Router();
router.use(requireTenant);
// =============================================================================
// UUID Validation
// =============================================================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUUID(value, label) {
    if (!UUID_REGEX.test(value)) {
        throw Errors.badRequest(`Invalid ${label} format`);
    }
}
// =============================================================================
// Zod Schemas (query params)
// =============================================================================
const formatSchema = z.object({
    format: z.enum(['xlsx', 'pdf']).optional().default('xlsx'),
});
const skillInventoryQuerySchema = z.object({
    format: z.enum(['xlsx', 'pdf']).optional().default('xlsx'),
    orgUnitId: z.string().uuid().optional(),
    verificationStatus: z.string().optional(),
    minCompositeScore: z.coerce.number().min(0).max(10).optional(),
    skillType: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(10000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});
// =============================================================================
// Helpers
// =============================================================================
function sendFile(res, buffer, filename, format) {
    const contentType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
}
// =============================================================================
// Routes
// =============================================================================
/**
 * GET /export/blueprint/:runId
 * Export blueprint run results as PDF or Excel
 */
router.get('/blueprint/:runId', requirePermission('ORGANIZATION', 'VIEW'), validate(formatSchema, 'query'), asyncHandler(async (req, res) => {
    const runId = req.params['runId'];
    assertUUID(runId, 'run ID');
    const format = req.query['format'] || 'xlsx';
    const service = new ExportEngineService(req.dbClient);
    const buffer = await service.exportBlueprintReport(runId, format);
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    sendFile(res, buffer, `blueprint-report-${runId.slice(0, 8)}.${ext}`, format);
}));
/**
 * GET /export/skill-gap/:orgUnitId
 * Export skill gap analysis for an org unit
 */
router.get('/skill-gap/:orgUnitId', requirePermission('ORGANIZATION', 'VIEW'), validate(formatSchema, 'query'), asyncHandler(async (req, res) => {
    const orgUnitId = req.params['orgUnitId'];
    assertUUID(orgUnitId, 'org unit ID');
    const format = req.query['format'] || 'xlsx';
    const service = new ExportEngineService(req.dbClient);
    const buffer = await service.exportSkillGapReport(orgUnitId, format);
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    sendFile(res, buffer, `skill-gap-${orgUnitId.slice(0, 8)}.${ext}`, format);
}));
/**
 * GET /export/org-chart
 * Export org chart (hierarchical structure)
 */
router.get('/org-chart', requirePermission('ORGANIZATION', 'VIEW'), validate(formatSchema, 'query'), asyncHandler(async (req, res) => {
    const format = req.query['format'] || 'xlsx';
    const service = new ExportEngineService(req.dbClient);
    const buffer = await service.exportOrgChart(format);
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    sendFile(res, buffer, `org-chart.${ext}`, format);
}));
/**
 * GET /export/skill-inventory
 * Export skill inventory with optional filters
 */
router.get('/skill-inventory', requirePermission('ORGANIZATION', 'VIEW'), validate(skillInventoryQuerySchema, 'query'), asyncHandler(async (req, res) => {
    const { format = 'xlsx', orgUnitId, verificationStatus, minCompositeScore, skillType, limit, offset, } = req.query;
    const parsedFormat = format || 'xlsx';
    const filters = {
        orgUnitId,
        verificationStatus,
        minCompositeScore: minCompositeScore != null ? parseFloat(minCompositeScore) : undefined,
        skillType,
        limit: limit != null ? parseInt(limit, 10) : undefined,
        offset: offset != null ? parseInt(offset, 10) : undefined,
    };
    const service = new ExportEngineService(req.dbClient);
    const buffer = await service.exportSkillInventory(filters, parsedFormat);
    const ext = parsedFormat === 'pdf' ? 'pdf' : 'xlsx';
    sendFile(res, buffer, `skill-inventory.${ext}`, parsedFormat);
}));
export default router;
//# sourceMappingURL=export-engine.js.map