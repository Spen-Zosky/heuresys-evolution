/**
 * Zod Schemas for Semantic/Ontology Routes
 * Covers: semantic-intelligence, ontology, onet, skill-extraction, skill-migration
 */
import { z } from 'zod';
export declare const semanticSearchSchema: z.ZodObject<{
    query: z.ZodString;
    entityTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    entityTypes?: string[] | undefined;
    filters?: Record<string, unknown> | undefined;
    similarityThreshold?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    entityTypes?: string[] | undefined;
    filters?: Record<string, unknown> | undefined;
    similarityThreshold?: number | undefined;
}>;
export declare const semanticDirectSearchSchema: z.ZodObject<{
    query: z.ZodString;
    entityTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    entityTypes?: string[] | undefined;
    similarityThreshold?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    entityTypes?: string[] | undefined;
    similarityThreshold?: number | undefined;
}>;
export declare const semanticEmbeddingsGenerateSchema: z.ZodObject<{
    entityType: z.ZodString;
    batchSize: z.ZodOptional<z.ZodNumber>;
    forceRegenerate: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    entityType: string;
    batchSize?: number | undefined;
    forceRegenerate?: boolean | undefined;
}, {
    entityType: string;
    batchSize?: number | undefined;
    forceRegenerate?: boolean | undefined;
}>;
export declare const semanticTalentSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
    includeInternal: z.ZodOptional<z.ZodBoolean>;
    includeExternal: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
    includeInternal?: boolean | undefined;
    includeExternal?: boolean | undefined;
}, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
    includeInternal?: boolean | undefined;
    includeExternal?: boolean | undefined;
}>;
export declare const semanticPerformanceSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
    includeReviews: z.ZodOptional<z.ZodBoolean>;
    includeCheckIns: z.ZodOptional<z.ZodBoolean>;
    includeFeedback: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
    includeReviews?: boolean | undefined;
    includeCheckIns?: boolean | undefined;
    includeFeedback?: boolean | undefined;
}, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
    includeReviews?: boolean | undefined;
    includeCheckIns?: boolean | undefined;
    includeFeedback?: boolean | undefined;
}>;
export declare const semanticLearningSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
}>;
export declare const semanticOrgSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    similarityThreshold?: number | undefined;
}>;
export declare const semanticAskSchema: z.ZodObject<{
    question: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    question: string;
    limit?: number | undefined;
}, {
    question: string;
    limit?: number | undefined;
}>;
export declare const semanticQueueProcessSchema: z.ZodObject<{
    batchSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    batchSize?: number | undefined;
}, {
    batchSize?: number | undefined;
}>;
export declare const semanticQueueCleanupSchema: z.ZodObject<{
    daysToKeep: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    daysToKeep?: number | undefined;
}, {
    daysToKeep?: number | undefined;
}>;
export declare const ontologySkillSearchSchema: z.ZodObject<{
    query: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
    limit: z.ZodOptional<z.ZodNumber>;
    similarity_threshold: z.ZodOptional<z.ZodNumber>;
    skill_type: z.ZodOptional<z.ZodString>;
    is_digital: z.ZodOptional<z.ZodBoolean>;
    is_green: z.ZodOptional<z.ZodBoolean>;
    is_transversal: z.ZodOptional<z.ZodBoolean>;
    use_vector: z.ZodOptional<z.ZodBoolean>;
    include_custom_skills: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    skill_type?: string | undefined;
    is_digital?: boolean | undefined;
    is_green?: boolean | undefined;
    language?: "it" | "en" | undefined;
    similarity_threshold?: number | undefined;
    is_transversal?: boolean | undefined;
    use_vector?: boolean | undefined;
    include_custom_skills?: boolean | undefined;
}, {
    query: string;
    limit?: number | undefined;
    skill_type?: string | undefined;
    is_digital?: boolean | undefined;
    is_green?: boolean | undefined;
    language?: "it" | "en" | undefined;
    similarity_threshold?: number | undefined;
    is_transversal?: boolean | undefined;
    use_vector?: boolean | undefined;
    include_custom_skills?: boolean | undefined;
}>;
export declare const ontologyEmbeddingJobSchema: z.ZodObject<{
    target: z.ZodOptional<z.ZodEnum<["esco_skills", "tenant_custom_skills"]>>;
    job_type: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    target?: "esco_skills" | "tenant_custom_skills" | undefined;
    job_type?: string | undefined;
}, {
    target?: "esco_skills" | "tenant_custom_skills" | undefined;
    job_type?: string | undefined;
}>;
export declare const ontologyInferRelationsSchema: z.ZodObject<{
    similarity_threshold: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    similarity_threshold?: number | undefined;
}, {
    limit?: number | undefined;
    similarity_threshold?: number | undefined;
}>;
export declare const ontologyCrossSearchSchema: z.ZodObject<{
    query: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
    entityTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodOptional<z.ZodNumber>;
    similarityThreshold: z.ZodOptional<z.ZodNumber>;
    tenantId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    tenantId?: string | null | undefined;
    language?: "it" | "en" | undefined;
    entityTypes?: string[] | undefined;
    similarityThreshold?: number | undefined;
}, {
    query: string;
    limit?: number | undefined;
    tenantId?: string | null | undefined;
    language?: "it" | "en" | undefined;
    entityTypes?: string[] | undefined;
    similarityThreshold?: number | undefined;
}>;
export declare const ontologyCrossEmbeddingsGenerateSchema: z.ZodObject<{
    entityType: z.ZodEnum<["occupations", "jobs", "courses", "goals", "industry_classifications_l1", "industry_classifications_l2", "industry_classifications_l3"]>;
    jobType: z.ZodOptional<z.ZodEnum<["full", "incremental"]>>;
    tenantId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    entityType: "goals" | "courses" | "jobs" | "occupations" | "industry_classifications_l1" | "industry_classifications_l2" | "industry_classifications_l3";
    jobType?: "full" | "incremental" | undefined;
    tenantId?: string | null | undefined;
}, {
    entityType: "goals" | "courses" | "jobs" | "occupations" | "industry_classifications_l1" | "industry_classifications_l2" | "industry_classifications_l3";
    jobType?: "full" | "incremental" | undefined;
    tenantId?: string | null | undefined;
}>;
export declare const ontologyOrganizationAdviceSchema: z.ZodObject<{
    industry: z.ZodString;
    companySize: z.ZodNumber;
    language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
    additionalContext: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    industry: string;
    companySize: number;
    language?: "it" | "en" | undefined;
    additionalContext?: string | null | undefined;
}, {
    industry: string;
    companySize: number;
    language?: "it" | "en" | undefined;
    additionalContext?: string | null | undefined;
}>;
export declare const createTenantSkillSchema: z.ZodObject<{
    tenant_id: z.ZodString;
    code: z.ZodString;
    name_en: z.ZodString;
    name_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_type: z.ZodOptional<z.ZodString>;
    base_esco_skill_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name_en: string;
    tenant_id: string;
    description_en?: string | null | undefined;
    skill_type?: string | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    category_id?: string | null | undefined;
    base_esco_skill_id?: string | null | undefined;
}, {
    code: string;
    name_en: string;
    tenant_id: string;
    description_en?: string | null | undefined;
    skill_type?: string | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    category_id?: string | null | undefined;
    base_esco_skill_id?: string | null | undefined;
}>;
export declare const updateTenantSkillSchema: z.ZodObject<{
    name_en: z.ZodOptional<z.ZodString>;
    name_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    skill_type: z.ZodOptional<z.ZodString>;
    base_esco_skill_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name_en?: string | undefined;
    is_active?: boolean | undefined;
    description_en?: string | null | undefined;
    skill_type?: string | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    category_id?: string | null | undefined;
    base_esco_skill_id?: string | null | undefined;
}, {
    name_en?: string | undefined;
    is_active?: boolean | undefined;
    description_en?: string | null | undefined;
    skill_type?: string | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    category_id?: string | null | undefined;
    base_esco_skill_id?: string | null | undefined;
}>;
export declare const createSkillDimensionSchema: z.ZodObject<{
    dimension_type: z.ZodEnum<["knowledge", "skill", "ability", "behavior", "attitude"]>;
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    level_scale: z.ZodOptional<z.ZodString>;
    min_level: z.ZodOptional<z.ZodNumber>;
    max_level: z.ZodOptional<z.ZodNumber>;
    is_primary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    dimension_type: "knowledge" | "skill" | "ability" | "behavior" | "attitude";
    max_level?: number | undefined;
    description_en?: string | null | undefined;
    description_it?: string | null | undefined;
    level_scale?: string | undefined;
    min_level?: number | undefined;
    is_primary?: boolean | undefined;
}, {
    dimension_type: "knowledge" | "skill" | "ability" | "behavior" | "attitude";
    max_level?: number | undefined;
    description_en?: string | null | undefined;
    description_it?: string | null | undefined;
    level_scale?: string | undefined;
    min_level?: number | undefined;
    is_primary?: boolean | undefined;
}>;
export declare const updateSkillDimensionSchema: z.ZodObject<{
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    level_scale: z.ZodOptional<z.ZodString>;
    min_level: z.ZodOptional<z.ZodNumber>;
    max_level: z.ZodOptional<z.ZodNumber>;
    is_primary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    max_level?: number | undefined;
    description_en?: string | null | undefined;
    description_it?: string | null | undefined;
    level_scale?: string | undefined;
    min_level?: number | undefined;
    is_primary?: boolean | undefined;
}, {
    max_level?: number | undefined;
    description_en?: string | null | undefined;
    description_it?: string | null | undefined;
    level_scale?: string | undefined;
    min_level?: number | undefined;
    is_primary?: boolean | undefined;
}>;
export declare const createSkillRelationSchema: z.ZodObject<{
    target_skill_id: z.ZodString;
    relation_type: z.ZodEnum<["broader", "narrower", "related", "similar", "prerequisite", "complements"]>;
    strength: z.ZodOptional<z.ZodNumber>;
    bidirectional: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    target_skill_id: string;
    relation_type: "similar" | "broader" | "narrower" | "related" | "prerequisite" | "complements";
    strength?: number | undefined;
    bidirectional?: boolean | undefined;
}, {
    target_skill_id: string;
    relation_type: "similar" | "broader" | "narrower" | "related" | "prerequisite" | "complements";
    strength?: number | undefined;
    bidirectional?: boolean | undefined;
}>;
export declare const createCategorySchema: z.ZodObject<{
    code: z.ZodString;
    name_en: z.ZodString;
    name_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    level: z.ZodOptional<z.ZodNumber>;
    esco_pillar: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isced_field: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name_en: string;
    level?: number | undefined;
    parent_id?: string | null | undefined;
    description_en?: string | null | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    esco_pillar?: string | null | undefined;
    isced_field?: string | null | undefined;
}, {
    code: string;
    name_en: string;
    level?: number | undefined;
    parent_id?: string | null | undefined;
    description_en?: string | null | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    esco_pillar?: string | null | undefined;
    isced_field?: string | null | undefined;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name_en: z.ZodOptional<z.ZodString>;
    name_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_en: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parent_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    level: z.ZodOptional<z.ZodNumber>;
    esco_pillar: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isced_field: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    level?: number | undefined;
    name_en?: string | undefined;
    parent_id?: string | null | undefined;
    is_active?: boolean | undefined;
    description_en?: string | null | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    esco_pillar?: string | null | undefined;
    isced_field?: string | null | undefined;
}, {
    level?: number | undefined;
    name_en?: string | undefined;
    parent_id?: string | null | undefined;
    is_active?: boolean | undefined;
    description_en?: string | null | undefined;
    name_it?: string | null | undefined;
    description_it?: string | null | undefined;
    esco_pillar?: string | null | undefined;
    isced_field?: string | null | undefined;
}>;
export declare const recordSkillUsageSchema: z.ZodObject<{
    skillIds: z.ZodArray<z.ZodString, "many">;
    tenantId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    contextType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    skillIds: string[];
    tenantId?: string | null | undefined;
    contextType?: string | undefined;
}, {
    skillIds: string[];
    tenantId?: string | null | undefined;
    contextType?: string | undefined;
}>;
export declare const onetImportJobSchema: z.ZodObject<{
    import_type: z.ZodEnum<["occupations", "skills", "abilities", "knowledge", "work_activities", "work_styles", "interests"]>;
    source_version: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    import_type: "knowledge" | "skills" | "occupations" | "abilities" | "work_activities" | "work_styles" | "interests";
    source_version?: string | undefined;
}, {
    import_type: "knowledge" | "skills" | "occupations" | "abilities" | "work_activities" | "work_styles" | "interests";
    source_version?: string | undefined;
}>;
export declare const onetImportExecuteSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    source_version: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data: Record<string, unknown>[];
    source_version?: string | undefined;
}, {
    data: Record<string, unknown>[];
    source_version?: string | undefined;
}>;
export declare const onetMapToEscoSchema: z.ZodObject<{
    confidence_threshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    confidence_threshold?: number | undefined;
}, {
    confidence_threshold?: number | undefined;
}>;
export declare const skillExtractionExtractSchema: z.ZodObject<{
    text: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        maxSkills: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    }, {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    options?: {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    } | undefined;
}, {
    text: string;
    options?: {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    } | undefined;
}>;
export declare const skillExtractionExtractBatchSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        text: string;
    }, {
        id: string;
        text: string;
    }>, "many">;
    options: z.ZodOptional<z.ZodObject<{
        language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        maxSkills: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    }, {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        text: string;
    }[];
    options?: {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    } | undefined;
}, {
    items: {
        id: string;
        text: string;
    }[];
    options?: {
        language?: "it" | "en" | undefined;
        minConfidence?: number | undefined;
        maxSkills?: number | undefined;
    } | undefined;
}>;
export declare const skillExtractionMapSingleSchema: z.ZodObject<{
    skillName: z.ZodString;
    language: z.ZodOptional<z.ZodEnum<["en", "it"]>>;
    minConfidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    skillName: string;
    language?: "it" | "en" | undefined;
    minConfidence?: number | undefined;
}, {
    skillName: string;
    language?: "it" | "en" | undefined;
    minConfidence?: number | undefined;
}>;
export declare const createMigrationJobSchema: z.ZodObject<{
    tenant_id: z.ZodString;
    job_type: z.ZodEnum<["employee_skills", "position_skills", "all_skills", "custom"]>;
}, "strip", z.ZodTypeAny, {
    tenant_id: string;
    job_type: "custom" | "employee_skills" | "position_skills" | "all_skills";
}, {
    tenant_id: string;
    job_type: "custom" | "employee_skills" | "position_skills" | "all_skills";
}>;
export declare const startMigrationJobSchema: z.ZodObject<{
    confidence_threshold: z.ZodOptional<z.ZodNumber>;
    batch_size: z.ZodOptional<z.ZodNumber>;
    create_custom_skills: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    batch_size?: number | undefined;
    confidence_threshold?: number | undefined;
    create_custom_skills?: boolean | undefined;
}, {
    batch_size?: number | undefined;
    confidence_threshold?: number | undefined;
    create_custom_skills?: boolean | undefined;
}>;
export declare const approveUnknownSkillSchema: z.ZodObject<{
    user_id: z.ZodString;
    esco_skill_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    use_suggested: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    esco_skill_id?: string | null | undefined;
    use_suggested?: boolean | undefined;
}, {
    user_id: string;
    esco_skill_id?: string | null | undefined;
    use_suggested?: boolean | undefined;
}>;
export declare const rejectUnknownSkillSchema: z.ZodObject<{
    user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user_id: string;
}, {
    user_id: string;
}>;
export declare const matchSkillSchema: z.ZodObject<{
    skill_text: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    skill_text: string;
    limit?: number | undefined;
}, {
    skill_text: string;
    limit?: number | undefined;
}>;
//# sourceMappingURL=semantic.d.ts.map