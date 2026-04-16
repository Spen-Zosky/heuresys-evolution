/**
 * Zod Schemas for HR Operations Extended Routes
 * Covers: sap-migration, prototypes, tenant-setup, time-off, rag-sessions,
 *         recognition, workforce-planning, performance-skill-integration, wellbeing-dashboard
 */
import { z } from 'zod';
// =============================================================================
// SAP MIGRATION
// =============================================================================
export const sapParseTestSchema = z.object({
    fileContent: z.string().trim().min(1, 'File content is required'),
    format: z.string().trim().min(1, 'Format is required').max(50),
    limit: z.coerce.number().int().min(1).max(10000).optional(),
});
export const createSapJobSchema = z.object({
    name: z.string().trim().min(1, 'Job name is required').max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    sourceSystem: z.string().trim().max(100).optional().nullable(),
    migrationScope: z.string().trim().max(200).optional().nullable(),
});
export const sapParseSchema = z.object({
    fileContent: z.string().trim().min(1, 'File content is required'),
    format: z.string().trim().min(1, 'Format is required').max(50),
    infotype: z.string().trim().max(50).optional().nullable(),
});
export const sapParsePreviewSchema = z.object({
    fileContent: z.string().trim().min(1, 'File content is required'),
    format: z.string().trim().min(1, 'Format is required').max(50),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const createSapMappingSchema = z.object({
    infotype: z.string().trim().min(1, 'Infotype is required').max(50),
    infotypeName: z.string().trim().max(200).optional().nullable(),
    sapField: z.string().trim().min(1, 'SAP field is required').max(100),
    targetTable: z.string().trim().min(1, 'Target table is required').max(100),
    targetField: z.string().trim().min(1, 'Target field is required').max(100),
    transformType: z.string().trim().max(50).optional().nullable(),
    transformConfig: z.record(z.unknown()).optional().nullable(),
    required: z.boolean().optional(),
});
export const updateSapMappingSchema = z.object({
    infotype: z.string().trim().max(50).optional(),
    infotypeName: z.string().trim().max(200).optional().nullable(),
    sapField: z.string().trim().max(100).optional(),
    targetTable: z.string().trim().max(100).optional(),
    targetField: z.string().trim().max(100).optional(),
    transformType: z.string().trim().max(50).optional().nullable(),
    transformConfig: z.record(z.unknown()).optional().nullable(),
    required: z.boolean().optional(),
});
export const sapExecuteJobSchema = z.object({
    confirmExecution: z.boolean().optional(),
});
export const sapRollbackJobSchema = z.object({
    confirmRollback: z.boolean().optional(),
});
export const sapDeltaSyncCheckSchema = z.object({
    fileContent: z.string().trim().min(1, 'File content is required'),
    format: z.string().trim().min(1, 'Format is required').max(50),
});
export const sapDeltaSyncExecuteSchema = z.object({
    fileContent: z.string().trim().min(1, 'File content is required'),
    format: z.string().trim().min(1, 'Format is required').max(50),
    confirmSync: z.boolean().optional(),
});
export const sapEmployeeMappingSchema = z.object({
    sapPernr: z.string().trim().min(1, 'SAP PERNR is required').max(50),
    employeeId: z.string().uuid('Invalid employee ID'),
});
// =============================================================================
// PROTOTYPES
// =============================================================================
export const prototypeResearchSchema = z.object({
    nace_code: z.string().trim().min(1, 'NACE code is required').max(50),
    company_size: z.coerce.number().int().min(1).optional(),
});
export const createProcessSchema = z.object({
    process_code: z.string().trim().min(1, 'Process code is required').max(50),
    process_name: z.string().trim().min(1, 'Process name is required').max(200),
    process_category: z.string().trim().max(100).optional().nullable(),
    value_chain_position: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    typical_inputs: z.array(z.string().trim().max(200)).optional(),
    typical_outputs: z.array(z.string().trim().max(200)).optional(),
});
const staffingRuleSchema = z.object({
    role_code: z.string().trim().max(50).optional(),
    role_name: z.string().trim().max(200).optional(),
    process_code: z.string().trim().max(50).optional(),
    min_headcount: z.coerce.number().int().min(0).optional(),
    max_headcount: z.coerce.number().int().min(0).optional(),
    ratio_base: z.coerce.number().min(0).optional(),
    ratio_per: z.coerce.number().min(0).optional(),
    scaling_type: z.string().trim().max(50).optional(),
    conditions: z.record(z.unknown()).optional(),
});
export const createStaffingRulesSchema = z.object({
    rules: z.array(staffingRuleSchema).min(1, 'At least one rule is required'),
});
export const calculateStaffingSchema = z.object({
    company_size: z.coerce.number().int().min(1, 'Company size is required'),
});
export const generatePrototypeSchema = z.object({
    profile_id: z.string().uuid('Invalid profile ID').optional(),
    prototype_id: z.string().uuid('Invalid prototype ID').optional(),
    config: z.record(z.unknown()).optional(),
});
export const previewPrototypeSchema = z.object({
    profile_id: z.string().uuid('Invalid profile ID').optional(),
    prototype_id: z.string().uuid('Invalid prototype ID').optional(),
    company_size: z.coerce.number().int().min(1).optional(),
});
export const validateStaffingSchema = z.object({
    staffing_plan: z.record(z.unknown()),
});
export const addJobSkillSchema = z.object({
    esco_skill_id: z.string().uuid('Invalid ESCO skill ID'),
    required_level: z.coerce.number().min(0).max(5).optional(),
    is_required: z.boolean().optional(),
    importance: z.enum(['critical', 'important', 'nice_to_have']).optional(),
});
// =============================================================================
// TENANT SETUP
// =============================================================================
export const tenantSetupStep1Schema = z.object({
    name: z.string().trim().min(1, 'Company name is required').max(200),
    code: z.string().trim().min(1, 'Company code is required').max(50),
    taxId: z.string().trim().max(50).optional().nullable(),
    address: z
        .object({
        street: z.string().trim().max(200).optional(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        zip: z.string().trim().max(20).optional(),
        country: z.string().trim().max(100).optional(),
    })
        .optional(),
    contact: z
        .object({
        name: z.string().trim().max(200).optional(),
        email: z.string().trim().max(200).optional(),
        phone: z.string().trim().max(50).optional(),
    })
        .optional(),
    industry: z.string().trim().max(100).optional().nullable(),
    employeeCount: z.coerce.number().int().min(0).optional(),
});
export const tenantSetupStep2Schema = z.object({
    ccnlType: z.string().trim().max(100).optional().nullable(),
    customRules: z.record(z.unknown()).optional(),
    leaveRules: z.record(z.unknown()).optional(),
});
export const tenantSetupStep3Schema = z.object({
    startMonth: z.coerce.number().int().min(1).max(12).optional(),
    payPeriod: z.string().trim().max(50).optional(),
    holidayCalendar: z.string().trim().max(100).optional(),
    customHolidays: z
        .array(z.object({
        date: z.string().trim().max(50),
        name: z.string().trim().max(200),
    }))
        .optional(),
});
export const tenantUpdateSettingsSchema = z.object({
    settings: z.record(z.unknown()),
});
// =============================================================================
// TIME OFF
// =============================================================================
export const createTimeOffRequestSchema = z.object({
    leave_type: z.string().trim().min(1, 'Leave type is required').max(50),
    start_date: z.string().trim().min(1, 'Start date is required').max(50),
    end_date: z.string().trim().min(1, 'End date is required').max(50),
    reason: z.string().trim().max(2000).optional().nullable(),
    half_day_start: z.boolean().optional(),
    half_day_end: z.boolean().optional(),
});
export const cancelTimeOffRequestSchema = z.object({
    reason: z.string().trim().max(2000).optional().nullable(),
});
export const rejectTimeOffRequestSchema = z.object({
    reason: z.string().trim().max(2000).optional().nullable(),
});
// =============================================================================
// RAG SESSIONS
// =============================================================================
export const createRagSessionSchema = z.object({
    user_id: z.string().uuid('Invalid user ID').optional(),
    user_id_employee_id: z.string().uuid('Invalid employee ID').optional(),
    provider: z.string().trim().max(50).optional(),
    model: z.string().trim().max(100).optional(),
    title: z.string().trim().max(200).optional().nullable(),
    system_prompt: z.string().trim().max(5000).optional().nullable(),
    sources_enabled: z.array(z.string().trim().max(100)).optional(),
});
export const updateRagSessionSchema = z.object({
    title: z.string().trim().max(200).optional().nullable(),
    system_prompt: z.string().trim().max(5000).optional().nullable(),
    sources_enabled: z.array(z.string().trim().max(100)).optional(),
    is_archived: z.boolean().optional(),
});
// =============================================================================
// RECOGNITION
// =============================================================================
export const createRecognitionSchema = z.object({
    from_employee_id: z.string().uuid('Invalid sender employee ID'),
    to_employee_id: z.string().uuid('Invalid recipient employee ID'),
    message: z.string().trim().min(1, 'Message is required').max(2000),
    category: z.string().trim().max(100).optional().nullable(),
    badge_type: z.string().trim().max(50).optional().nullable(),
    core_value: z.string().trim().max(100).optional().nullable(),
    is_public: z.boolean().optional(),
    points_awarded: z.coerce.number().int().min(0).optional(),
});
export const updateRecognitionSchema = z.object({
    message: z.string().trim().min(1).max(2000).optional(),
    category: z.string().trim().max(100).optional().nullable(),
    badge_type: z.string().trim().max(50).optional().nullable(),
    core_value: z.string().trim().max(100).optional().nullable(),
    is_public: z.boolean().optional(),
    points_awarded: z.coerce.number().int().min(0).optional(),
});
// =============================================================================
// WORKFORCE PLANNING
// =============================================================================
const workforceRequirementSchema = z.object({
    skill_id: z.string().uuid('Invalid skill ID').optional(),
    skill_name: z.string().trim().max(200).optional(),
    required_level: z.coerce.number().min(0).max(10).optional(),
    current_level: z.coerce.number().min(0).max(10).optional(),
    headcount_needed: z.coerce.number().int().min(0).optional(),
    priority: z.string().trim().max(50).optional(),
    timeline: z.string().trim().max(100).optional(),
});
export const gapRiskSchema = z.object({
    requirements: z.array(workforceRequirementSchema).min(1, 'At least one requirement is required'),
});
export const hiringRecommendationsSchema = z.object({
    gap_assessments: z.array(z.record(z.unknown())).min(1, 'At least one gap assessment is required'),
});
export const trainingInvestmentsSchema = z.object({
    gap_assessments: z.array(z.record(z.unknown())).min(1, 'At least one gap assessment is required'),
});
export const createWorkforcePlanSchema = z.object({
    name: z.string().trim().min(1, 'Plan name is required').max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    target_date: z.string().trim().max(50).optional().nullable(),
    requirements: z.array(workforceRequirementSchema).optional(),
});
export const updateWorkforcePlanStatusSchema = z.object({
    status: z.enum(['draft', 'active', 'completed', 'cancelled']),
});
export const simulateWorkforceSchema = z.object({
    requirements: z.array(workforceRequirementSchema).min(1, 'At least one requirement is required'),
});
// =============================================================================
// PERFORMANCE-SKILL INTEGRATION
// =============================================================================
// Note: POST /link/:reviewId and POST /gap-analysis/:employeeId have no body fields
// PUT /links/:linkId/address has no body fields
// POST /batch-link has no body fields
// All these endpoints only use URL params and tenant context
// =============================================================================
// WELLBEING DASHBOARD
// =============================================================================
export const createWellbeingCheckinSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
    mood_score: z.coerce.number().min(1).max(10).optional(),
    energy_level: z.coerce.number().min(1).max(10).optional(),
    stress_level: z.coerce.number().min(1).max(10).optional(),
    work_life_balance: z.coerce.number().min(1).max(10).optional(),
    sleep_quality: z.coerce.number().min(1).max(10).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    is_anonymous: z.boolean().optional(),
});
export const createBurnoutAssessmentSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
    exhaustion_score: z.coerce.number().min(1).max(10),
    cynicism_score: z.coerce.number().min(1).max(10),
    inefficacy_score: z.coerce.number().min(1).max(10),
    workload_factor: z.coerce.number().min(1).max(5).optional(),
    autonomy_factor: z.coerce.number().min(1).max(5).optional(),
    recognition_factor: z.coerce.number().min(1).max(5).optional(),
});
export const createWellbeingGoalSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
    goal_type: z.string().trim().max(50).optional(),
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    target_value: z.coerce.number().optional(),
    unit: z.string().trim().max(50).optional().nullable(),
    target_date: z.string().trim().max(50).optional().nullable(),
});
//# sourceMappingURL=hr-operations-extended.js.map