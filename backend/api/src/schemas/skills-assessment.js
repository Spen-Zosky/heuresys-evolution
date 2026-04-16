/**
 * Zod Schemas for Skills Assessment Routes
 * Covers: skill-assessments, skill-taxonomy, skill-verifications, role-skill-requirements, hr-intelligence
 */
import { z } from 'zod';
// =============================================================================
// SKILL ASSESSMENTS
// =============================================================================
export const createSkillAssessmentSchema = z.object({
    employee_id: z.string().uuid('Invalid employee ID'),
    skill_name: z.string().trim().min(1, 'Skill name is required').max(200),
    esco_skill_uri: z.string().trim().max(500).optional().nullable(),
    assessed_level: z.coerce.number().min(0).max(10),
    required_level: z.coerce.number().min(0).max(10).optional().nullable(),
    assessment_date: z.string().trim().max(50).optional().nullable(),
    assessment_method: z.string().trim().max(100).optional().nullable(),
    assessed_by: z.string().uuid('Invalid assessor ID').optional().nullable(),
    evidence_notes: z.string().trim().max(5000).optional().nullable(),
    certification_url: z.string().trim().max(500).optional().nullable(),
});
export const updateSkillAssessmentSchema = z.object({
    assessed_level: z.coerce.number().min(0).max(10).optional(),
    required_level: z.coerce.number().min(0).max(10).optional().nullable(),
    assessment_method: z.string().trim().max(100).optional().nullable(),
    evidence_notes: z.string().trim().max(5000).optional().nullable(),
    certification_url: z.string().trim().max(500).optional().nullable(),
});
// =============================================================================
// SKILL TAXONOMY
// =============================================================================
export const createClassificationSchema = z.object({
    esco_skill_id: z.string().uuid('Invalid ESCO skill ID'),
    primary_category: z.string().trim().min(1, 'Primary category is required').max(100),
    secondary_category: z.string().trim().max(100).optional().nullable(),
    industry_relevance: z.string().trim().max(200).optional().nullable(),
    proficiency_framework: z.string().trim().max(100).optional().nullable(),
    learning_difficulty: z.coerce.number().min(0).max(10).optional(),
    market_demand_score: z.coerce.number().min(0).max(10).optional(),
    automation_risk_score: z.coerce.number().min(0).max(1).optional(),
    future_relevance_score: z.coerce.number().min(0).max(10).optional(),
    metadata: z.record(z.unknown()).optional(),
});
export const validateClassificationSchema = z.object({
    updates: z.record(z.unknown()).optional(),
});
export const createClusterSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(50),
    name_en: z.string().trim().min(1, 'Name (EN) is required').max(200),
    name_it: z.string().trim().max(200).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    parent_cluster_id: z.string().uuid('Invalid parent cluster ID').optional().nullable(),
    cluster_level: z.coerce.number().int().min(0).optional(),
    career_path_codes: z.array(z.string().trim().max(50)).optional(),
    industry_codes: z.array(z.string().trim().max(50)).optional(),
});
export const assignClusterSchema = z.object({
    cluster_id: z.string().uuid('Invalid cluster ID'),
});
export const createRelationshipSchema = z.object({
    source_skill_id: z.string().uuid('Invalid source skill ID'),
    target_skill_id: z.string().uuid('Invalid target skill ID'),
    relationship_type: z.string().trim().min(1, 'Relationship type is required').max(50),
    strength: z.coerce.number().min(0).max(1).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
});
export const validateRelationshipSchema = z.object({
    updates: z.record(z.unknown()).optional(),
});
export const createAdjacencySchema = z.object({
    skill_id: z.string().uuid('Invalid skill ID'),
    adjacent_skill_id: z.string().uuid('Invalid adjacent skill ID'),
    adjacency_score: z.coerce.number().min(0).max(1).optional(),
    adjacency_type: z.string().trim().max(50).optional(),
});
export const calculateAdjacencySchema = z.object({
    type: z.string().trim().max(50).optional(),
});
// =============================================================================
// SKILL VERIFICATIONS
// =============================================================================
export const approveSkillSchema = z.object({
    verifierId: z.string().uuid('Invalid verifier ID'),
    notes: z.string().trim().max(2000).optional().nullable(),
    expiresAt: z.string().trim().max(50).optional().nullable(),
});
export const rejectSkillSchema = z.object({
    verifierId: z.string().uuid('Invalid verifier ID'),
    reason: z.string().trim().min(1, 'Reason is required').max(2000),
});
export const overrideSkillSchema = z.object({
    verifierId: z.string().uuid('Invalid verifier ID'),
    knowledge: z.coerce.number().min(0).max(5).optional(),
    skill: z.coerce.number().min(0).max(5).optional(),
    ability: z.coerce.number().min(0).max(5).optional(),
    behavior: z.coerce.number().min(0).max(5).optional(),
    attitude: z.coerce.number().min(0).max(5).optional(),
    reason: z.string().trim().min(1, 'Reason is required').max(2000),
    autoApprove: z.boolean().optional(),
});
export const bulkApproveSchema = z.object({
    profileIds: z.array(z.string().uuid('Invalid profile ID')).min(1, 'At least one profile ID is required'),
    verifierId: z.string().uuid('Invalid verifier ID'),
    notes: z.string().trim().max(2000).optional().nullable(),
});
// =============================================================================
// ROLE SKILL REQUIREMENTS
// =============================================================================
const skillRequirementItemSchema = z.object({
    skillId: z.string().uuid('Invalid skill ID'),
    knowledge: z.coerce.number().min(0).max(5).optional(),
    skill: z.coerce.number().min(0).max(5).optional(),
    ability: z.coerce.number().min(0).max(5).optional(),
    behavior: z.coerce.number().min(0).max(5).optional(),
    attitude: z.coerce.number().min(0).max(5).optional(),
    minCompositeScore: z.coerce.number().min(0).max(5).optional(),
    importance: z.enum(['critical', 'important', 'nice_to_have']).optional(),
    weight: z.coerce.number().min(0).max(1).optional(),
    isPrimary: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
});
export const replaceSkillRequirementsSchema = z.object({
    requirements: z.array(skillRequirementItemSchema),
    tenantId: z.string().uuid('Invalid tenant ID').optional(),
});
export const createSkillRequirementSchema = z.object({
    skillId: z.string().uuid('Invalid skill ID'),
    knowledge: z.coerce.number().min(0).max(5).optional(),
    skill: z.coerce.number().min(0).max(5).optional(),
    ability: z.coerce.number().min(0).max(5).optional(),
    behavior: z.coerce.number().min(0).max(5).optional(),
    attitude: z.coerce.number().min(0).max(5).optional(),
    minCompositeScore: z.coerce.number().min(0).max(5).optional(),
    importance: z.enum(['critical', 'important', 'nice_to_have']).optional(),
    weight: z.coerce.number().min(0).max(1).optional(),
    isPrimary: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    tenantId: z.string().uuid('Invalid tenant ID').optional(),
});
export const seedFromEscoSchema = z.object({
    tenantId: z.string().uuid('Invalid tenant ID').optional(),
    defaultImportance: z.enum(['critical', 'important', 'nice_to_have']).optional(),
    defaultLevel: z.coerce.number().min(0).max(5).optional(),
});
export const copyFromRoleSchema = z.object({
    tenantId: z.string().uuid('Invalid tenant ID').optional(),
});
// =============================================================================
// HR INTELLIGENCE
// =============================================================================
export const hrIntelligenceAddSkillSchema = z.object({
    skillId: z.string().uuid('Invalid skill ID').optional(),
    escoSkillId: z.string().uuid('Invalid ESCO skill ID').optional(),
    knowledge: z.coerce.number().min(0).max(5).optional(),
    skill: z.coerce.number().min(0).max(5).optional(),
    ability: z.coerce.number().min(0).max(5).optional(),
    behavior: z.coerce.number().min(0).max(5).optional(),
    attitude: z.coerce.number().min(0).max(5).optional(),
    isPrimary: z.boolean().optional(),
    sourceDescription: z.string().trim().max(500).optional().nullable(),
});
export const hrIntelligenceUpdateSkillSchema = z.object({
    knowledge: z.coerce.number().min(0).max(5).optional(),
    skill: z.coerce.number().min(0).max(5).optional(),
    ability: z.coerce.number().min(0).max(5).optional(),
    behavior: z.coerce.number().min(0).max(5).optional(),
    attitude: z.coerce.number().min(0).max(5).optional(),
    isPrimary: z.boolean().optional(),
    sourceDescription: z.string().trim().max(500).optional().nullable(),
});
export const hrIntelligenceExtractSkillsSchema = z.object({
    text: z.string().trim().min(1, 'Text is required').max(50000).optional(),
    source: z.string().trim().max(200).optional(),
    jobType: z.string().trim().max(100).optional(),
});
export const hrIntelligenceCreateAliasSchema = z.object({
    escoSkillId: z.string().uuid('Invalid ESCO skill ID'),
    aliasText: z.string().trim().min(1, 'Alias text is required').max(500),
    aliasType: z.string().trim().max(50).optional(),
});
export const hrIntelligenceGapAnalysisSchema = z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    targetPositionId: z.string().uuid('Invalid position ID').optional().nullable(),
    analysisName: z.string().trim().max(200).optional().nullable(),
});
export const hrIntelligenceSkillMatrixSchema = z.object({
    entityType: z.enum(['team', 'department']),
    entityId: z.string().uuid('Invalid entity ID'),
    matrixName: z.string().trim().max(200).optional().nullable(),
});
export const hrIntelligenceBenchmarkReportSchema = z.object({
    configId: z.string().uuid('Invalid config ID').optional().nullable(),
    reportName: z.string().trim().max(200).optional().nullable(),
    reportType: z.enum(['industry', 'role', 'company']).optional(),
});
//# sourceMappingURL=skills-assessment.js.map