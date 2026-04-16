/**
 * O*NET Import Service
 *
 * Handles importing O*NET occupational data from the O*NET database.
 * Supports import of occupations, skills, abilities, knowledge, and work activities.
 *
 * @module services/onet-import
 * @story S-ONTO-01-04
 */
import { Pool } from 'pg';
interface ONetOccupation {
    onet_soc_code: string;
    title: string;
    description?: string;
    job_zone?: number;
    related_experience?: string;
    education_required?: string;
    on_job_training?: string;
}
interface ONetSkill {
    element_id: string;
    element_name: string;
    description?: string;
    category?: string;
}
interface ONetAbility {
    element_id: string;
    element_name: string;
    description?: string;
    category?: string;
}
interface ONetKnowledge {
    element_id: string;
    element_name: string;
    description?: string;
    domain?: string;
}
interface ONetWorkActivity {
    element_id: string;
    element_name: string;
    description?: string;
    activity_type?: string;
    parent_element_id?: string;
}
interface ONetOccupationLink {
    onet_soc_code: string;
    element_id: string;
    importance: number;
    level: number;
}
interface ImportJobResult {
    id: string;
    import_type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_records: number;
    processed_records: number;
    failed_records: number;
    error_message: string | null;
    started_at: Date | null;
    completed_at: Date | null;
}
interface ImportStats {
    occupations: number;
    skills: number;
    abilities: number;
    knowledge: number;
    work_activities: number;
    occupation_skill_links: number;
}
export declare class ONetImportService {
    private pool;
    private openaiApiKey;
    constructor(pool: Pool);
    private initOpenAIKey;
    /**
     * Get O*NET statistics
     */
    getStats(): Promise<{
        occupations_total: number;
        occupations_with_embeddings: number;
        skills_total: number;
        skills_mapped_to_esco: number;
        abilities_total: number;
        knowledge_total: number;
        work_activities_total: number;
        occupation_skill_links: number;
        last_import_at: Date | null;
    }>;
    /**
     * Create import job
     */
    createImportJob(importType: string, sourceVersion?: string): Promise<ImportJobResult>;
    /**
     * Get import job status
     */
    getImportJobStatus(jobId: string): Promise<ImportJobResult | null>;
    /**
     * List import jobs
     */
    listImportJobs(limit?: number, offset?: number): Promise<{
        jobs: ImportJobResult[];
        total: number;
    }>;
    /**
     * Import occupations from data array
     */
    importOccupations(jobId: string, occupations: ONetOccupation[], sourceVersion?: string): Promise<ImportStats>;
    /**
     * Import skills from data array
     */
    importSkills(jobId: string, skills: ONetSkill[]): Promise<ImportStats>;
    /**
     * Import abilities from data array
     */
    importAbilities(jobId: string, abilities: ONetAbility[]): Promise<ImportStats>;
    /**
     * Import knowledge areas from data array
     */
    importKnowledge(jobId: string, knowledgeAreas: ONetKnowledge[]): Promise<ImportStats>;
    /**
     * Import work activities from data array
     */
    importWorkActivities(jobId: string, activities: ONetWorkActivity[]): Promise<ImportStats>;
    /**
     * Import occupation-skill links
     */
    importOccupationSkillLinks(jobId: string, links: ONetOccupationLink[]): Promise<ImportStats>;
    /**
     * Map O*NET skills to ESCO using semantic similarity
     */
    mapSkillsToEsco(confidenceThreshold?: number): Promise<{
        mapped: number;
        failed: number;
    }>;
    /**
     * Get occupations by skill requirements
     */
    getOccupationsBySkill(skillId: string, minImportance?: number): Promise<Array<{
        id: string;
        onet_soc_code: string;
        title: string;
        importance: number;
        level: number;
    }>>;
    /**
     * Get skills required for an occupation
     */
    getSkillsForOccupation(occupationId: string): Promise<Array<{
        id: string;
        element_id: string;
        element_name: string;
        category: string;
        importance: number;
        level: number;
        esco_skill_id: string | null;
        esco_skill_name: string | null;
    }>>;
    /**
     * Search occupations by text
     */
    searchOccupations(query: string, limit?: number): Promise<Array<{
        id: string;
        onet_soc_code: string;
        title: string;
        job_zone: number;
        rank: number;
    }>>;
    /**
     * Get unified skills view
     */
    getUnifiedSkills(sources?: string[], limit?: number, offset?: number): Promise<Array<{
        source: string;
        id: string;
        external_id: string;
        name: string;
        description: string;
        category: string;
    }>>;
    private rowToJob;
}
export default ONetImportService;
//# sourceMappingURL=onet-import.d.ts.map