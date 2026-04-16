/**
 * Zod Schemas for Semantic/Ontology Routes
 * Covers: semantic-intelligence, ontology, onet, skill-extraction, skill-migration
 */
import { z } from 'zod';
// =============================================================================
// SEMANTIC INTELLIGENCE
// =============================================================================
export const semanticSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    entityTypes: z.array(z.string().trim().max(50)).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
    filters: z.record(z.unknown()).optional(),
});
export const semanticDirectSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    entityTypes: z.array(z.string().trim().max(50)).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
});
export const semanticEmbeddingsGenerateSchema = z.object({
    entityType: z.string().trim().min(1, 'Entity type is required').max(50),
    batchSize: z.coerce.number().int().min(1).max(1000).optional(),
    forceRegenerate: z.boolean().optional(),
});
export const semanticTalentSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
    includeInternal: z.boolean().optional(),
    includeExternal: z.boolean().optional(),
});
export const semanticPerformanceSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
    includeReviews: z.boolean().optional(),
    includeCheckIns: z.boolean().optional(),
    includeFeedback: z.boolean().optional(),
});
export const semanticLearningSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
});
export const semanticOrgSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
});
export const semanticAskSchema = z.object({
    question: z.string().trim().min(1, 'Question is required').max(2000),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});
export const semanticQueueProcessSchema = z.object({
    batchSize: z.coerce.number().int().min(1).max(1000).optional(),
});
export const semanticQueueCleanupSchema = z.object({
    daysToKeep: z.coerce.number().int().min(1).max(365).optional(),
});
// =============================================================================
// ONTOLOGY
// =============================================================================
export const ontologySkillSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    language: z.enum(['en', 'it']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    similarity_threshold: z.coerce.number().min(0).max(1).optional(),
    skill_type: z.string().trim().max(50).optional(),
    is_digital: z.boolean().optional(),
    is_green: z.boolean().optional(),
    is_transversal: z.boolean().optional(),
    use_vector: z.boolean().optional(),
    include_custom_skills: z.boolean().optional(),
});
export const ontologyEmbeddingJobSchema = z.object({
    target: z.enum(['esco_skills', 'tenant_custom_skills']).optional(),
    job_type: z.string().trim().max(50).optional(),
});
export const ontologyInferRelationsSchema = z.object({
    similarity_threshold: z.coerce.number().min(0).max(1).optional(),
    limit: z.coerce.number().int().min(1).max(10000).optional(),
});
export const ontologyCrossSearchSchema = z.object({
    query: z.string().trim().min(1, 'Query is required').max(1000),
    language: z.enum(['en', 'it']).optional(),
    entityTypes: z.array(z.string().trim().max(50)).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    similarityThreshold: z.coerce.number().min(0).max(1).optional(),
    tenantId: z.string().uuid('Invalid tenant ID').optional().nullable(),
});
export const ontologyCrossEmbeddingsGenerateSchema = z.object({
    entityType: z.enum([
        'occupations',
        'jobs',
        'courses',
        'goals',
        'industry_classifications_l1',
        'industry_classifications_l2',
        'industry_classifications_l3',
    ]),
    jobType: z.enum(['full', 'incremental']).optional(),
    tenantId: z.string().uuid('Invalid tenant ID').optional().nullable(),
});
export const ontologyOrganizationAdviceSchema = z.object({
    industry: z.string().trim().min(1, 'Industry is required').max(200),
    companySize: z.coerce.number().int().min(1, 'Company size must be positive'),
    language: z.enum(['en', 'it']).optional(),
    additionalContext: z.string().trim().max(2000).optional().nullable(),
});
export const createTenantSkillSchema = z.object({
    tenant_id: z.string().uuid('Invalid tenant ID'),
    code: z.string().trim().min(1, 'Code is required').max(100),
    name_en: z.string().trim().min(1, 'Name (EN) is required').max(200),
    name_it: z.string().trim().max(200).optional().nullable(),
    description_en: z.string().trim().max(5000).optional().nullable(),
    description_it: z.string().trim().max(5000).optional().nullable(),
    skill_type: z.string().trim().max(50).optional(),
    base_esco_skill_id: z.string().uuid('Invalid ESCO skill ID').optional().nullable(),
    category_id: z.string().uuid('Invalid category ID').optional().nullable(),
});
export const updateTenantSkillSchema = z.object({
    name_en: z.string().trim().min(1).max(200).optional(),
    name_it: z.string().trim().max(200).optional().nullable(),
    description_en: z.string().trim().max(5000).optional().nullable(),
    description_it: z.string().trim().max(5000).optional().nullable(),
    skill_type: z.string().trim().max(50).optional(),
    base_esco_skill_id: z.string().uuid('Invalid ESCO skill ID').optional().nullable(),
    category_id: z.string().uuid('Invalid category ID').optional().nullable(),
    is_active: z.boolean().optional(),
});
export const createSkillDimensionSchema = z.object({
    dimension_type: z.enum(['knowledge', 'skill', 'ability', 'behavior', 'attitude']),
    description_en: z.string().trim().max(5000).optional().nullable(),
    description_it: z.string().trim().max(5000).optional().nullable(),
    level_scale: z.string().trim().max(50).optional(),
    min_level: z.coerce.number().int().min(0).optional(),
    max_level: z.coerce.number().int().min(1).optional(),
    is_primary: z.boolean().optional(),
});
export const updateSkillDimensionSchema = z.object({
    description_en: z.string().trim().max(5000).optional().nullable(),
    description_it: z.string().trim().max(5000).optional().nullable(),
    level_scale: z.string().trim().max(50).optional(),
    min_level: z.coerce.number().int().min(0).optional(),
    max_level: z.coerce.number().int().min(1).optional(),
    is_primary: z.boolean().optional(),
});
export const createSkillRelationSchema = z.object({
    target_skill_id: z.string().uuid('Invalid target skill ID'),
    relation_type: z.enum([
        'broader',
        'narrower',
        'related',
        'similar',
        'prerequisite',
        'complements',
    ]),
    strength: z.coerce.number().min(0).max(1).optional(),
    bidirectional: z.boolean().optional(),
});
export const createCategorySchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(100),
    name_en: z.string().trim().min(1, 'Name (EN) is required').max(200),
    name_it: z.string().trim().max(200).optional().nullable(),
    description_en: z.string().trim().max(5000).optional().nullable(),
    description_it: z.string().trim().max(5000).optional().nullable(),
    parent_id: z.string().uuid('Invalid parent ID').optional().nullable(),
    level: z.coerce.number().int().min(0).optional(),
    esco_pillar: z.string().trim().max(100).optional().nullable(),
    isced_field: z.string().trim().max(100).optional().nullable(),
});
export const updateCategorySchema = z.object({
    name_en: z.string().trim().min(1).max(200).optional(),
    name_it: z.string().trim().max(200).optional().nullable(),
    description_en: z.string().trim().max(5000).optional().nullable(),
    description_it: z.string().trim().max(5000).optional().nullable(),
    parent_id: z.string().uuid('Invalid parent ID').optional().nullable(),
    level: z.coerce.number().int().min(0).optional(),
    esco_pillar: z.string().trim().max(100).optional().nullable(),
    isced_field: z.string().trim().max(100).optional().nullable(),
    is_active: z.boolean().optional(),
});
export const recordSkillUsageSchema = z.object({
    skillIds: z
        .array(z.string().uuid('Invalid skill ID'))
        .min(2, 'At least 2 skills required')
        .max(20, 'Maximum 20 skills'),
    tenantId: z.string().uuid('Invalid tenant ID').optional().nullable(),
    contextType: z.string().trim().max(50).optional(),
});
// =============================================================================
// O*NET
// =============================================================================
export const onetImportJobSchema = z.object({
    import_type: z.enum([
        'occupations',
        'skills',
        'abilities',
        'knowledge',
        'work_activities',
        'work_styles',
        'interests',
    ]),
    source_version: z.string().trim().max(50).optional(),
});
export const onetImportExecuteSchema = z.object({
    data: z.array(z.record(z.unknown())).min(1, 'Data array is required'),
    source_version: z.string().trim().max(50).optional(),
});
export const onetMapToEscoSchema = z.object({
    confidence_threshold: z.coerce.number().min(0).max(1).optional(),
});
// =============================================================================
// SKILL EXTRACTION
// =============================================================================
export const skillExtractionExtractSchema = z.object({
    text: z
        .string()
        .trim()
        .min(10, 'Text must be at least 10 characters')
        .max(50000, 'Text must not exceed 50000 characters'),
    options: z
        .object({
        language: z.enum(['en', 'it']).optional(),
        minConfidence: z.coerce.number().min(0).max(1).optional(),
        maxSkills: z.coerce.number().int().min(1).max(100).optional(),
    })
        .optional(),
});
const extractBatchItemSchema = z.object({
    id: z.string().trim().min(1, 'ID is required').max(200),
    text: z.string().trim().min(1, 'Text is required').max(50000),
});
export const skillExtractionExtractBatchSchema = z.object({
    items: z
        .array(extractBatchItemSchema)
        .min(1, 'Items array is required')
        .max(10, 'Maximum 10 items per batch'),
    options: z
        .object({
        language: z.enum(['en', 'it']).optional(),
        minConfidence: z.coerce.number().min(0).max(1).optional(),
        maxSkills: z.coerce.number().int().min(1).max(100).optional(),
    })
        .optional(),
});
export const skillExtractionMapSingleSchema = z.object({
    skillName: z.string().trim().min(1, 'Skill name is required').max(500),
    language: z.enum(['en', 'it']).optional(),
    minConfidence: z.coerce.number().min(0).max(1).optional(),
});
// =============================================================================
// SKILL MIGRATION
// =============================================================================
export const createMigrationJobSchema = z.object({
    tenant_id: z.string().uuid('Invalid tenant ID'),
    job_type: z.enum(['employee_skills', 'position_skills', 'all_skills', 'custom']),
});
export const startMigrationJobSchema = z.object({
    confidence_threshold: z.coerce.number().min(0).max(1).optional(),
    batch_size: z.coerce.number().int().min(1).max(1000).optional(),
    create_custom_skills: z.boolean().optional(),
});
export const approveUnknownSkillSchema = z.object({
    user_id: z.string().uuid('Invalid user ID'),
    esco_skill_id: z.string().uuid('Invalid ESCO skill ID').optional().nullable(),
    use_suggested: z.boolean().optional(),
});
export const rejectUnknownSkillSchema = z.object({
    user_id: z.string().uuid('Invalid user ID'),
});
export const matchSkillSchema = z.object({
    skill_text: z.string().trim().min(1, 'Skill text is required').max(500),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});
//# sourceMappingURL=semantic.js.map