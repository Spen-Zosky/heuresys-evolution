/**
 * Zod Schemas for Skills Assessment Routes
 * Covers: skill-assessments, skill-taxonomy, skill-verifications, role-skill-requirements, hr-intelligence
 */
import { z } from 'zod';
export declare const createSkillAssessmentSchema: z.ZodObject<{
    employee_id: z.ZodString;
    skill_name: z.ZodString;
    esco_skill_uri: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assessed_level: z.ZodNumber;
    required_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    assessment_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assessment_method: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assessed_by: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidence_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    certification_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employee_id: string;
    skill_name: string;
    assessed_level: number;
    evidence_notes?: string | null | undefined;
    assessment_date?: string | null | undefined;
    required_level?: number | null | undefined;
    esco_skill_uri?: string | null | undefined;
    assessment_method?: string | null | undefined;
    assessed_by?: string | null | undefined;
    certification_url?: string | null | undefined;
}, {
    employee_id: string;
    skill_name: string;
    assessed_level: number;
    evidence_notes?: string | null | undefined;
    assessment_date?: string | null | undefined;
    required_level?: number | null | undefined;
    esco_skill_uri?: string | null | undefined;
    assessment_method?: string | null | undefined;
    assessed_by?: string | null | undefined;
    certification_url?: string | null | undefined;
}>;
export declare const updateSkillAssessmentSchema: z.ZodObject<{
    assessed_level: z.ZodOptional<z.ZodNumber>;
    required_level: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    assessment_method: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidence_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    certification_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    evidence_notes?: string | null | undefined;
    required_level?: number | null | undefined;
    assessed_level?: number | undefined;
    assessment_method?: string | null | undefined;
    certification_url?: string | null | undefined;
}, {
    evidence_notes?: string | null | undefined;
    required_level?: number | null | undefined;
    assessed_level?: number | undefined;
    assessment_method?: string | null | undefined;
    certification_url?: string | null | undefined;
}>;
export declare const createClassificationSchema: z.ZodObject<{
    esco_skill_id: z.ZodString;
    primary_category: z.ZodString;
    secondary_category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    industry_relevance: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    proficiency_framework: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    learning_difficulty: z.ZodOptional<z.ZodNumber>;
    market_demand_score: z.ZodOptional<z.ZodNumber>;
    automation_risk_score: z.ZodOptional<z.ZodNumber>;
    future_relevance_score: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    esco_skill_id: string;
    primary_category: string;
    metadata?: Record<string, unknown> | undefined;
    secondary_category?: string | null | undefined;
    industry_relevance?: string | null | undefined;
    proficiency_framework?: string | null | undefined;
    learning_difficulty?: number | undefined;
    market_demand_score?: number | undefined;
    automation_risk_score?: number | undefined;
    future_relevance_score?: number | undefined;
}, {
    esco_skill_id: string;
    primary_category: string;
    metadata?: Record<string, unknown> | undefined;
    secondary_category?: string | null | undefined;
    industry_relevance?: string | null | undefined;
    proficiency_framework?: string | null | undefined;
    learning_difficulty?: number | undefined;
    market_demand_score?: number | undefined;
    automation_risk_score?: number | undefined;
    future_relevance_score?: number | undefined;
}>;
export declare const validateClassificationSchema: z.ZodObject<{
    updates: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    updates?: Record<string, unknown> | undefined;
}, {
    updates?: Record<string, unknown> | undefined;
}>;
export declare const createClusterSchema: z.ZodObject<{
    code: z.ZodString;
    name_en: z.ZodString;
    name_it: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parent_cluster_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cluster_level: z.ZodOptional<z.ZodNumber>;
    career_path_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    industry_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name_en: string;
    description?: string | null | undefined;
    name_it?: string | null | undefined;
    parent_cluster_id?: string | null | undefined;
    cluster_level?: number | undefined;
    career_path_codes?: string[] | undefined;
    industry_codes?: string[] | undefined;
}, {
    code: string;
    name_en: string;
    description?: string | null | undefined;
    name_it?: string | null | undefined;
    parent_cluster_id?: string | null | undefined;
    cluster_level?: number | undefined;
    career_path_codes?: string[] | undefined;
    industry_codes?: string[] | undefined;
}>;
export declare const assignClusterSchema: z.ZodObject<{
    cluster_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    cluster_id: string;
}, {
    cluster_id: string;
}>;
export declare const createRelationshipSchema: z.ZodObject<{
    source_skill_id: z.ZodString;
    target_skill_id: z.ZodString;
    relationship_type: z.ZodString;
    strength: z.ZodOptional<z.ZodNumber>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    relationship_type: string;
    source_skill_id: string;
    target_skill_id: string;
    description?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    strength?: number | undefined;
}, {
    relationship_type: string;
    source_skill_id: string;
    target_skill_id: string;
    description?: string | null | undefined;
    metadata?: Record<string, unknown> | undefined;
    strength?: number | undefined;
}>;
export declare const validateRelationshipSchema: z.ZodObject<{
    updates: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    updates?: Record<string, unknown> | undefined;
}, {
    updates?: Record<string, unknown> | undefined;
}>;
export declare const createAdjacencySchema: z.ZodObject<{
    skill_id: z.ZodString;
    adjacent_skill_id: z.ZodString;
    adjacency_score: z.ZodOptional<z.ZodNumber>;
    adjacency_type: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    skill_id: string;
    adjacent_skill_id: string;
    adjacency_score?: number | undefined;
    adjacency_type?: string | undefined;
}, {
    skill_id: string;
    adjacent_skill_id: string;
    adjacency_score?: number | undefined;
    adjacency_type?: string | undefined;
}>;
export declare const calculateAdjacencySchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: string | undefined;
}, {
    type?: string | undefined;
}>;
export declare const approveSkillSchema: z.ZodObject<{
    verifierId: z.ZodString;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expiresAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    verifierId: string;
    notes?: string | null | undefined;
    expiresAt?: string | null | undefined;
}, {
    verifierId: string;
    notes?: string | null | undefined;
    expiresAt?: string | null | undefined;
}>;
export declare const rejectSkillSchema: z.ZodObject<{
    verifierId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    verifierId: string;
}, {
    reason: string;
    verifierId: string;
}>;
export declare const overrideSkillSchema: z.ZodObject<{
    verifierId: z.ZodString;
    knowledge: z.ZodOptional<z.ZodNumber>;
    skill: z.ZodOptional<z.ZodNumber>;
    ability: z.ZodOptional<z.ZodNumber>;
    behavior: z.ZodOptional<z.ZodNumber>;
    attitude: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodString;
    autoApprove: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    verifierId: string;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    autoApprove?: boolean | undefined;
}, {
    reason: string;
    verifierId: string;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    autoApprove?: boolean | undefined;
}>;
export declare const bulkApproveSchema: z.ZodObject<{
    profileIds: z.ZodArray<z.ZodString, "many">;
    verifierId: z.ZodString;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    verifierId: string;
    profileIds: string[];
    notes?: string | null | undefined;
}, {
    verifierId: string;
    profileIds: string[];
    notes?: string | null | undefined;
}>;
export declare const replaceSkillRequirementsSchema: z.ZodObject<{
    requirements: z.ZodArray<z.ZodObject<{
        skillId: z.ZodString;
        knowledge: z.ZodOptional<z.ZodNumber>;
        skill: z.ZodOptional<z.ZodNumber>;
        ability: z.ZodOptional<z.ZodNumber>;
        behavior: z.ZodOptional<z.ZodNumber>;
        attitude: z.ZodOptional<z.ZodNumber>;
        minCompositeScore: z.ZodOptional<z.ZodNumber>;
        importance: z.ZodOptional<z.ZodEnum<["critical", "important", "nice_to_have"]>>;
        weight: z.ZodOptional<z.ZodNumber>;
        isPrimary: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        notes?: string | null | undefined;
        weight?: number | undefined;
        importance?: "critical" | "important" | "nice_to_have" | undefined;
        minCompositeScore?: number | undefined;
    }, {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        notes?: string | null | undefined;
        weight?: number | undefined;
        importance?: "critical" | "important" | "nice_to_have" | undefined;
        minCompositeScore?: number | undefined;
    }>, "many">;
    tenantId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    requirements: {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        notes?: string | null | undefined;
        weight?: number | undefined;
        importance?: "critical" | "important" | "nice_to_have" | undefined;
        minCompositeScore?: number | undefined;
    }[];
    tenantId?: string | undefined;
}, {
    requirements: {
        skillId: string;
        knowledge?: number | undefined;
        skill?: number | undefined;
        ability?: number | undefined;
        behavior?: number | undefined;
        attitude?: number | undefined;
        isPrimary?: boolean | undefined;
        notes?: string | null | undefined;
        weight?: number | undefined;
        importance?: "critical" | "important" | "nice_to_have" | undefined;
        minCompositeScore?: number | undefined;
    }[];
    tenantId?: string | undefined;
}>;
export declare const createSkillRequirementSchema: z.ZodObject<{
    skillId: z.ZodString;
    knowledge: z.ZodOptional<z.ZodNumber>;
    skill: z.ZodOptional<z.ZodNumber>;
    ability: z.ZodOptional<z.ZodNumber>;
    behavior: z.ZodOptional<z.ZodNumber>;
    attitude: z.ZodOptional<z.ZodNumber>;
    minCompositeScore: z.ZodOptional<z.ZodNumber>;
    importance: z.ZodOptional<z.ZodEnum<["critical", "important", "nice_to_have"]>>;
    weight: z.ZodOptional<z.ZodNumber>;
    isPrimary: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    tenantId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    skillId: string;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    notes?: string | null | undefined;
    weight?: number | undefined;
    tenantId?: string | undefined;
    importance?: "critical" | "important" | "nice_to_have" | undefined;
    minCompositeScore?: number | undefined;
}, {
    skillId: string;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    notes?: string | null | undefined;
    weight?: number | undefined;
    tenantId?: string | undefined;
    importance?: "critical" | "important" | "nice_to_have" | undefined;
    minCompositeScore?: number | undefined;
}>;
export declare const seedFromEscoSchema: z.ZodObject<{
    tenantId: z.ZodOptional<z.ZodString>;
    defaultImportance: z.ZodOptional<z.ZodEnum<["critical", "important", "nice_to_have"]>>;
    defaultLevel: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    tenantId?: string | undefined;
    defaultImportance?: "critical" | "important" | "nice_to_have" | undefined;
    defaultLevel?: number | undefined;
}, {
    tenantId?: string | undefined;
    defaultImportance?: "critical" | "important" | "nice_to_have" | undefined;
    defaultLevel?: number | undefined;
}>;
export declare const copyFromRoleSchema: z.ZodObject<{
    tenantId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenantId?: string | undefined;
}, {
    tenantId?: string | undefined;
}>;
export declare const hrIntelligenceAddSkillSchema: z.ZodObject<{
    skillId: z.ZodOptional<z.ZodString>;
    escoSkillId: z.ZodOptional<z.ZodString>;
    knowledge: z.ZodOptional<z.ZodNumber>;
    skill: z.ZodOptional<z.ZodNumber>;
    ability: z.ZodOptional<z.ZodNumber>;
    behavior: z.ZodOptional<z.ZodNumber>;
    attitude: z.ZodOptional<z.ZodNumber>;
    isPrimary: z.ZodOptional<z.ZodBoolean>;
    sourceDescription: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    skillId?: string | undefined;
    escoSkillId?: string | undefined;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    sourceDescription?: string | null | undefined;
}, {
    skillId?: string | undefined;
    escoSkillId?: string | undefined;
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    sourceDescription?: string | null | undefined;
}>;
export declare const hrIntelligenceUpdateSkillSchema: z.ZodObject<{
    knowledge: z.ZodOptional<z.ZodNumber>;
    skill: z.ZodOptional<z.ZodNumber>;
    ability: z.ZodOptional<z.ZodNumber>;
    behavior: z.ZodOptional<z.ZodNumber>;
    attitude: z.ZodOptional<z.ZodNumber>;
    isPrimary: z.ZodOptional<z.ZodBoolean>;
    sourceDescription: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    sourceDescription?: string | null | undefined;
}, {
    knowledge?: number | undefined;
    skill?: number | undefined;
    ability?: number | undefined;
    behavior?: number | undefined;
    attitude?: number | undefined;
    isPrimary?: boolean | undefined;
    sourceDescription?: string | null | undefined;
}>;
export declare const hrIntelligenceExtractSkillsSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    jobType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text?: string | undefined;
    source?: string | undefined;
    jobType?: string | undefined;
}, {
    text?: string | undefined;
    source?: string | undefined;
    jobType?: string | undefined;
}>;
export declare const hrIntelligenceCreateAliasSchema: z.ZodObject<{
    escoSkillId: z.ZodString;
    aliasText: z.ZodString;
    aliasType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    escoSkillId: string;
    aliasText: string;
    aliasType?: string | undefined;
}, {
    escoSkillId: string;
    aliasText: string;
    aliasType?: string | undefined;
}>;
export declare const hrIntelligenceGapAnalysisSchema: z.ZodObject<{
    employeeId: z.ZodString;
    targetPositionId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    analysisName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    targetPositionId?: string | null | undefined;
    analysisName?: string | null | undefined;
}, {
    employeeId: string;
    targetPositionId?: string | null | undefined;
    analysisName?: string | null | undefined;
}>;
export declare const hrIntelligenceSkillMatrixSchema: z.ZodObject<{
    entityType: z.ZodEnum<["team", "department"]>;
    entityId: z.ZodString;
    matrixName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    entityType: "team" | "department";
    entityId: string;
    matrixName?: string | null | undefined;
}, {
    entityType: "team" | "department";
    entityId: string;
    matrixName?: string | null | undefined;
}>;
export declare const hrIntelligenceBenchmarkReportSchema: z.ZodObject<{
    configId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reportName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reportType: z.ZodOptional<z.ZodEnum<["industry", "role", "company"]>>;
}, "strip", z.ZodTypeAny, {
    configId?: string | null | undefined;
    reportName?: string | null | undefined;
    reportType?: "role" | "company" | "industry" | undefined;
}, {
    configId?: string | null | undefined;
    reportName?: string | null | undefined;
    reportType?: "role" | "company" | "industry" | undefined;
}>;
//# sourceMappingURL=skills-assessment.d.ts.map