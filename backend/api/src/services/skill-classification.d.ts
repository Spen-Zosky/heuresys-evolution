/**
 * Skill Classification Service
 * Manages enhanced skill taxonomy: Hard/Soft classification, Cognitive Levels,
 * Social Dimensions, Transferability, and Skill Clusters
 */
export type PrimaryCategory = 'hard' | 'soft' | 'hybrid';
export type CognitiveLevel = 1 | 2 | 3 | 4;
export type SocialDimension = 'intrapersonal' | 'interpersonal' | 'task_oriented';
export type Transferability = 'specialized' | 'adjacent' | 'transferable';
export type ClassificationSource = 'esco_derived' | 'rule_based' | 'ai_assisted' | 'manual';
export interface SkillCluster {
    id: string;
    code: string;
    name_en: string;
    name_it?: string;
    description?: string;
    parent_cluster_id?: string;
    cluster_level: number;
    career_path_codes?: string[];
    industry_codes?: string[];
    is_active: boolean;
    skill_count?: number;
}
export interface SkillClassification {
    id: string;
    esco_skill_id: string;
    primary_category: PrimaryCategory;
    primary_category_confidence?: number | undefined;
    cognitive_level?: CognitiveLevel | undefined;
    cognitive_level_label?: string | undefined;
    social_dimension?: SocialDimension | undefined;
    transferability: Transferability;
    transferability_score?: number | undefined;
    skill_cluster_id?: string | undefined;
    skill_cluster?: SkillCluster | undefined;
    classification_source: ClassificationSource;
    needs_review: boolean;
    classified_by?: string | undefined;
    classified_at?: string | undefined;
}
export interface ClassifiedSkill {
    id: string;
    uri: string;
    preferred_label: string;
    description?: string | undefined;
    esco_skill_type?: string | undefined;
    reuse_level?: string | undefined;
    is_digital: boolean;
    is_green: boolean;
    classification?: SkillClassification | undefined;
}
export interface ClassificationStats {
    total_skills: number;
    classified_skills: number;
    unclassified_skills: number;
    classification_percentage: number;
    hard_skills: number;
    soft_skills: number;
    hybrid_skills: number;
    cognitive_level_1: number;
    cognitive_level_2: number;
    cognitive_level_3: number;
    cognitive_level_4: number;
    intrapersonal: number;
    interpersonal: number;
    task_oriented: number;
    specialized: number;
    adjacent: number;
    transferable: number;
    needs_review: number;
}
export interface ClusterSuggestion {
    cluster: SkillCluster;
    confidence: number;
    reason: string;
}
export interface AIClassificationSuggestion {
    primary_category: PrimaryCategory;
    cognitive_level: CognitiveLevel;
    social_dimension: SocialDimension;
    transferability: Transferability;
    suggested_cluster_id?: string;
    confidence: number;
    reasoning: string;
}
export declare class SkillClassificationService {
    private _tenantId;
    constructor(_tenantId: string);
    get tenantId(): string;
    /**
     * Get classification for a specific ESCO skill
     */
    getClassification(escoSkillId: string): Promise<SkillClassification | null>;
    /**
     * Get all classifications with optional filters
     */
    getAllClassifications(filters?: {
        primary_category?: PrimaryCategory;
        cognitive_level?: CognitiveLevel;
        social_dimension?: SocialDimension;
        transferability?: Transferability;
        cluster_id?: string;
        needs_review?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: SkillClassification[];
        total: number;
    }>;
    /**
     * Create or update classification for a skill
     */
    upsertClassification(escoSkillId: string, classification: Partial<SkillClassification>, classifiedBy?: string): Promise<SkillClassification>;
    /**
     * Validate a classification (mark as reviewed)
     */
    validateClassification(classificationId: string, validatedBy: string, updates?: Partial<SkillClassification>): Promise<SkillClassification>;
    /**
     * Get all skill clusters
     */
    getClusters(options?: {
        level?: number;
        parent_id?: string;
        include_skill_count?: boolean;
    }): Promise<SkillCluster[]>;
    /**
     * Get skills in a cluster (including sub-clusters)
     */
    getSkillsInCluster(clusterId: string): Promise<ClassifiedSkill[]>;
    /**
     * Create a new skill cluster
     */
    createCluster(cluster: Partial<SkillCluster>): Promise<SkillCluster>;
    /**
     * Assign a skill to a cluster
     */
    assignToCluster(escoSkillId: string, clusterId: string): Promise<void>;
    /**
     * Suggest clusters for a skill based on its properties
     */
    suggestCluster(escoSkillId: string): Promise<ClusterSuggestion[]>;
    /**
     * Get skills by primary category
     */
    getSkillsByCategory(category: PrimaryCategory): Promise<ClassifiedSkill[]>;
    /**
     * Get skills by cognitive level
     */
    getSkillsByCognitiveLevel(level: CognitiveLevel): Promise<ClassifiedSkill[]>;
    /**
     * Get skills by transferability
     */
    getSkillsByTransferability(transferability: Transferability): Promise<ClassifiedSkill[]>;
    /**
     * Get classification statistics
     */
    getStats(): Promise<ClassificationStats>;
    /**
     * Get cluster summary with skill counts
     */
    getClusterSummary(): Promise<SkillCluster[]>;
}
export default SkillClassificationService;
//# sourceMappingURL=skill-classification.d.ts.map