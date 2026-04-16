/**
 * Job Skills Enrichment Service
 * Integrates enhanced skill taxonomy with job skills:
 * - Enriches job_skills with classification data from skill_classifications
 * - Suggests skills for job templates based on ESCO occupation codes
 * - Calculates skill distribution (Hard/Soft/Hybrid balance)
 */
import { PrimaryCategory, CognitiveLevel } from './skill-classification.js';
export interface JobSkillEnrichment {
    id: string;
    job_template_id: string;
    skill_name_en: string;
    esco_skill_uri?: string | undefined;
    esco_skill_id?: string | undefined;
    required_level: number;
    is_required: boolean;
    importance: string;
    primary_category?: PrimaryCategory | undefined;
    cognitive_level?: CognitiveLevel | undefined;
    transferability?: string | undefined;
    skill_cluster_id?: string | undefined;
    skill_cluster_code?: string | undefined;
    skill_cluster_name?: string | undefined;
}
export interface SkillSuggestion {
    esco_skill_id: string;
    preferred_label: string;
    description: string;
    primary_category: PrimaryCategory;
    cognitive_level: CognitiveLevel;
    transferability: string;
    transferability_score: number;
    skill_cluster_code?: string | undefined;
    relevance_score: number;
    relevance_reason: string;
}
export interface JobSkillDistribution {
    job_template_id: string;
    job_title: string;
    total_skills: number;
    hard_skills: number;
    soft_skills: number;
    hybrid_skills: number;
    hard_skill_percentage: number;
    soft_skill_percentage: number;
    hybrid_skill_percentage: number;
    cognitive_level_distribution: {
        level_1: number;
        level_2: number;
        level_3: number;
        level_4: number;
    };
    transferability_distribution: {
        specialized: number;
        adjacent: number;
        transferable: number;
    };
    clusters: {
        code: string;
        name: string;
        count: number;
    }[];
}
export interface EnrichmentResult {
    total_skills: number;
    enriched: number;
    not_found: number;
    errors: string[];
}
export declare class JobSkillsEnrichmentService {
    private _tenantId;
    private classificationService;
    constructor(tenantId: string);
    get tenantId(): string;
    /**
     * Enrich all job_skills with classification data from skill_classifications
     * This syncs the taxonomy data to job_skills table
     */
    enrichAllJobSkills(): Promise<EnrichmentResult>;
    /**
     * Enrich job_skills for a specific job template
     */
    enrichJobTemplateSkills(jobTemplateId: string): Promise<EnrichmentResult>;
    /**
     * Suggest skills for a job template based on occupation codes and existing skills
     */
    suggestSkillsForJobTemplate(jobTemplateId: string, options?: {
        max_suggestions?: number | undefined;
        include_hard?: boolean | undefined;
        include_soft?: boolean | undefined;
        include_hybrid?: boolean | undefined;
        min_transferability_score?: number | undefined;
    }): Promise<SkillSuggestion[]>;
    /**
     * Suggest skills by skill cluster to fill gaps
     */
    suggestSkillsByCluster(clusterId: string, excludeSkillIds?: string[], limit?: number): Promise<SkillSuggestion[]>;
    /**
     * Get skill distribution analysis for a job template
     */
    getJobSkillDistribution(jobTemplateId: string): Promise<JobSkillDistribution | null>;
    /**
     * Get skill balance recommendations for a job template
     */
    getSkillBalanceRecommendations(jobTemplateId: string): Promise<{
        distribution: JobSkillDistribution | null;
        recommendations: string[];
        suggested_skills: SkillSuggestion[];
    }>;
    /**
     * Add suggested skill to job template
     */
    addSkillToJobTemplate(jobTemplateId: string, escoSkillId: string, options?: {
        required_level?: number;
        is_required?: boolean;
        importance?: string;
    }): Promise<{
        id: string;
        success: boolean;
        message: string;
    }>;
}
export default JobSkillsEnrichmentService;
//# sourceMappingURL=job-skills-enrichment.d.ts.map