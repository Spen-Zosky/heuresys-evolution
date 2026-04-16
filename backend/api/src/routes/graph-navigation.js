/**
 * Graph Navigation Routes
 * Traversal endpoints for the process-skill-employee-org knowledge graph.
 * Mount point: /api/v1/graph
 */
import { Router } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { GraphNavigationService } from '../services/graph-navigation.js';
import { z } from 'zod';
const router = Router();
// All graph navigation operations require tenant context
router.use(requireTenant);
// =============================================================================
// UUID VALIDATION HELPER
// =============================================================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUUID(value, label) {
    if (!UUID_REGEX.test(value)) {
        throw Errors.badRequest(`Invalid ${label} format`);
    }
}
// =============================================================================
// ZOD SCHEMAS
// =============================================================================
const industryCodeSchema = z.object({
    industryCode: z.string().min(1).max(20),
});
// =============================================================================
// ENDPOINT 1: GET /process/:processId/deep
// Full process with phases, roles, skill requirements, KPIs
// =============================================================================
router.get('/process/:processId/deep', asyncHandler(async (req, res) => {
    const { processId } = req.params;
    assertUUID(processId, 'processId');
    const service = new GraphNavigationService(req.dbClient);
    const result = await service.getProcessDeep(processId);
    if (!result) {
        throw Errors.notFound('Process not found');
    }
    res.json({ data: result });
}));
// =============================================================================
// ENDPOINT 2: GET /process/:processId/skills
// Skills required by process with tenant employee coverage
// =============================================================================
router.get('/process/:processId/skills', asyncHandler(async (req, res) => {
    const { processId } = req.params;
    assertUUID(processId, 'processId');
    const tenantId = req.tenantId;
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getProcessSkills(processId, tenantId);
    res.json({ data, meta: { total: data.length } });
}));
// =============================================================================
// ENDPOINT 3: GET /skill/:skillId/processes
// Reverse lookup: which processes require this ESCO skill
// =============================================================================
router.get('/skill/:skillId/processes', asyncHandler(async (req, res) => {
    const { skillId } = req.params;
    assertUUID(skillId, 'skillId');
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getSkillProcesses(skillId);
    res.json({ data, meta: { total: data.length } });
}));
// =============================================================================
// ENDPOINT 4: GET /employee/:employeeId/process-qualification
// Employee qualification score for each process
// =============================================================================
router.get('/employee/:employeeId/process-qualification', asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    assertUUID(employeeId, 'employeeId');
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getEmployeeProcessQualification(employeeId);
    res.json({ data, meta: { total: data.length } });
}));
// =============================================================================
// ENDPOINT 5: GET /org-unit/:orgUnitId/coverage
// Org unit skill coverage and mapped processes
// =============================================================================
router.get('/org-unit/:orgUnitId/coverage', asyncHandler(async (req, res) => {
    const { orgUnitId } = req.params;
    assertUUID(orgUnitId, 'orgUnitId');
    const tenantId = req.tenantId;
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getOrgUnitCoverage(orgUnitId, tenantId);
    res.json({ data });
}));
// =============================================================================
// ENDPOINT 6: GET /org-unit/:orgUnitId/skill-gaps
// Gap analysis: required skills from mapped processes vs employee skill profiles
// =============================================================================
router.get('/org-unit/:orgUnitId/skill-gaps', asyncHandler(async (req, res) => {
    const { orgUnitId } = req.params;
    assertUUID(orgUnitId, 'orgUnitId');
    const tenantId = req.tenantId;
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getOrgUnitSkillGaps(orgUnitId, tenantId);
    res.json({ data, meta: { total: data.length } });
}));
// =============================================================================
// ENDPOINT 7: GET /industry/:industryCode/process-map
// Industry → occupations → processes → skills
// =============================================================================
router.get('/industry/:industryCode/process-map', validate(industryCodeSchema, 'params'), asyncHandler(async (req, res) => {
    const { industryCode } = req.params;
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getIndustryProcessMap(industryCode);
    res.json({ data });
}));
// =============================================================================
// ENDPOINT 8: GET /process/:processId/kpi-cascade
// KPI process cascade with role and org unit alignment
// =============================================================================
router.get('/process/:processId/kpi-cascade', asyncHandler(async (req, res) => {
    const { processId } = req.params;
    assertUUID(processId, 'processId');
    const tenantId = req.tenantId;
    const service = new GraphNavigationService(req.dbClient);
    const data = await service.getProcessKpiCascade(processId, tenantId);
    if (!data) {
        throw Errors.notFound('Process not found');
    }
    res.json({ data });
}));
export default router;
//# sourceMappingURL=graph-navigation.js.map