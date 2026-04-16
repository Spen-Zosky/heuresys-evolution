/**
 * Process Layer Routes
 * CRUD endpoints for process phases, roles, skill requirements, KPIs, and blueprint templates.
 * Mount point: /api/v1/process-layer
 */
import { Router } from 'express';
import { requireTenant } from '../middleware/tenantContext.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { ProcessLayerService } from '../services/process-layer.js';
import { z } from 'zod';
const router = Router();
// All process layer operations require tenant context and authentication
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
const createPhaseSchema = z.object({
    phaseCode: z.string().min(1).max(50),
    phaseName: z.string().min(1).max(200),
    phaseOrder: z.number().int().min(0),
    description: z.string().max(1000).optional(),
    estimatedDurationDays: z.number().min(0).optional(),
    isOptional: z.boolean().optional(),
});
const updatePhaseSchema = z
    .object({
    phaseCode: z.string().min(1).max(50).optional(),
    phaseName: z.string().min(1).max(200).optional(),
    phaseOrder: z.number().int().min(0).optional(),
    description: z.string().max(1000).optional(),
    estimatedDurationDays: z.number().min(0).optional(),
    isOptional: z.boolean().optional(),
})
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
const createRoleSchema = z.object({
    roleName: z.string().min(1).max(200),
    roleType: z.enum(['owner', 'executor', 'approver', 'reviewer', 'informed']),
    phaseId: z.string().uuid().optional(),
    escoOccupationId: z.string().uuid().optional(),
    minHeadcount: z.number().int().min(0).optional(),
    maxHeadcount: z.number().int().min(0).optional(),
    description: z.string().max(1000).optional(),
});
const updateRoleSchema = z
    .object({
    roleName: z.string().min(1).max(200).optional(),
    roleType: z.enum(['owner', 'executor', 'approver', 'reviewer', 'informed']).optional(),
    phaseId: z.string().uuid().nullable().optional(),
    escoOccupationId: z.string().uuid().nullable().optional(),
    minHeadcount: z.number().int().min(0).optional(),
    maxHeadcount: z.number().int().min(0).nullable().optional(),
    description: z.string().max(1000).optional(),
})
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
const createSkillReqSchema = z.object({
    escoSkillId: z.string().uuid(),
    phaseId: z.string().uuid().optional(),
    proficiencyLevel: z.number().int().min(1).max(5),
    isMandatory: z.boolean().optional(),
    description: z.string().max(1000).optional(),
});
const updateSkillReqSchema = z
    .object({
    escoSkillId: z.string().uuid().optional(),
    phaseId: z.string().uuid().nullable().optional(),
    proficiencyLevel: z.number().int().min(1).max(5).optional(),
    isMandatory: z.boolean().optional(),
    description: z.string().max(1000).optional(),
})
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
const createKpiSchema = z.object({
    kpiCode: z.string().min(1).max(50),
    kpiName: z.string().min(1).max(200),
    phaseId: z.string().uuid().optional(),
    measurementUnit: z.string().max(50).optional(),
    targetDirection: z.enum(['higher_better', 'lower_better', 'target_range']).optional(),
    benchmarkValue: z.number().optional(),
    benchmarkMin: z.number().optional(),
    benchmarkMax: z.number().optional(),
    description: z.string().max(1000).optional(),
});
const updateKpiSchema = z
    .object({
    kpiCode: z.string().min(1).max(50).optional(),
    kpiName: z.string().min(1).max(200).optional(),
    phaseId: z.string().uuid().nullable().optional(),
    measurementUnit: z.string().max(50).optional(),
    targetDirection: z.enum(['higher_better', 'lower_better', 'target_range']).optional(),
    benchmarkValue: z.number().nullable().optional(),
    benchmarkMin: z.number().nullable().optional(),
    benchmarkMax: z.number().nullable().optional(),
    description: z.string().max(1000).optional(),
})
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field required' });
// =============================================================================
// LIST PROCESSES (1 endpoint)
// =============================================================================
router.get('/processes', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const { category, search } = req.query;
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.listProcesses(category, search);
    res.json({ success: true, data });
}));
// =============================================================================
// PHASES (4 endpoints)
// =============================================================================
router.get('/processes/:processId/phases', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getPhasesByProcess(processId);
    res.json({ success: true, data });
}));
router.post('/processes/:processId/phases', requirePermission('ORGANIZATION', 'CREATE'), validate(createPhaseSchema), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.createPhase(processId, req.body);
    res.status(201).json({ success: true, data });
}));
router.put('/processes/:processId/phases/:phaseId', requirePermission('ORGANIZATION', 'EDIT'), validate(updatePhaseSchema), asyncHandler(async (req, res) => {
    const { processId, phaseId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(phaseId, 'phase ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.updatePhase(phaseId, req.body);
    res.json({ success: true, data });
}));
router.delete('/processes/:processId/phases/:phaseId', requirePermission('ORGANIZATION', 'DELETE'), asyncHandler(async (req, res) => {
    const { processId, phaseId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(phaseId, 'phase ID');
    const service = new ProcessLayerService(req.dbClient);
    await service.deletePhase(phaseId);
    res.json({ success: true, message: 'Phase deleted' });
}));
// =============================================================================
// ROLES (4 endpoints)
// =============================================================================
router.get('/processes/:processId/roles', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getRolesByProcess(processId);
    res.json({ success: true, data });
}));
router.post('/processes/:processId/roles', requirePermission('ORGANIZATION', 'CREATE'), validate(createRoleSchema), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.createRole(processId, req.body);
    res.status(201).json({ success: true, data });
}));
router.put('/processes/:processId/roles/:roleId', requirePermission('ORGANIZATION', 'EDIT'), validate(updateRoleSchema), asyncHandler(async (req, res) => {
    const { processId, roleId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(roleId, 'role ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.updateRole(roleId, req.body);
    res.json({ success: true, data });
}));
router.delete('/processes/:processId/roles/:roleId', requirePermission('ORGANIZATION', 'DELETE'), asyncHandler(async (req, res) => {
    const { processId, roleId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(roleId, 'role ID');
    const service = new ProcessLayerService(req.dbClient);
    await service.deleteRole(roleId);
    res.json({ success: true, message: 'Role deleted' });
}));
// =============================================================================
// SKILL REQUIREMENTS (4 endpoints)
// =============================================================================
router.get('/processes/:processId/skill-requirements', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getSkillRequirementsByProcess(processId);
    res.json({ success: true, data });
}));
router.post('/processes/:processId/skill-requirements', requirePermission('ORGANIZATION', 'CREATE'), validate(createSkillReqSchema), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.createSkillRequirement(processId, req.body);
    res.status(201).json({ success: true, data });
}));
router.put('/processes/:processId/skill-requirements/:reqId', requirePermission('ORGANIZATION', 'EDIT'), validate(updateSkillReqSchema), asyncHandler(async (req, res) => {
    const { processId, reqId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(reqId, 'requirement ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.updateSkillRequirement(reqId, req.body);
    res.json({ success: true, data });
}));
router.delete('/processes/:processId/skill-requirements/:reqId', requirePermission('ORGANIZATION', 'DELETE'), asyncHandler(async (req, res) => {
    const { processId, reqId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(reqId, 'requirement ID');
    const service = new ProcessLayerService(req.dbClient);
    await service.deleteSkillRequirement(reqId);
    res.json({ success: true, message: 'Skill requirement deleted' });
}));
// =============================================================================
// KPIs (4 endpoints)
// =============================================================================
router.get('/processes/:processId/kpis', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getKpisByProcess(processId);
    res.json({ success: true, data });
}));
router.post('/processes/:processId/kpis', requirePermission('ORGANIZATION', 'CREATE'), validate(createKpiSchema), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.createKpi(processId, req.body);
    res.status(201).json({ success: true, data });
}));
router.put('/processes/:processId/kpis/:kpiId', requirePermission('ORGANIZATION', 'EDIT'), validate(updateKpiSchema), asyncHandler(async (req, res) => {
    const { processId, kpiId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(kpiId, 'KPI ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.updateKpi(kpiId, req.body);
    res.json({ success: true, data });
}));
router.delete('/processes/:processId/kpis/:kpiId', requirePermission('ORGANIZATION', 'DELETE'), asyncHandler(async (req, res) => {
    const { processId, kpiId } = req.params;
    assertUUID(processId, 'process ID');
    assertUUID(kpiId, 'KPI ID');
    const service = new ProcessLayerService(req.dbClient);
    await service.deleteKpi(kpiId);
    res.json({ success: true, message: 'KPI deleted' });
}));
// =============================================================================
// COMPOSITE DETAIL (1 endpoint)
// =============================================================================
router.get('/processes/:processId/detail', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const processId = req.params['processId'];
    assertUUID(processId, 'process ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getProcessDetail(processId);
    if (!data) {
        throw Errors.notFound('Business process');
    }
    res.json({ success: true, data });
}));
// =============================================================================
// BLUEPRINT TEMPLATES (2 endpoints)
// =============================================================================
router.get('/blueprint-templates', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const { profileId } = req.query;
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getTemplates(profileId);
    res.json({ success: true, data });
}));
router.get('/blueprint-templates/:templateId', requirePermission('ORGANIZATION', 'VIEW'), asyncHandler(async (req, res) => {
    const templateId = req.params['templateId'];
    assertUUID(templateId, 'template ID');
    const service = new ProcessLayerService(req.dbClient);
    const data = await service.getTemplateById(templateId);
    if (!data) {
        throw Errors.notFound('Blueprint template');
    }
    res.json({ success: true, data });
}));
export default router;
//# sourceMappingURL=process-layer.js.map