/**
 * Legacy Skill Migration Service
 *
 * Bridges legacy skill data to the ESCO ontology using semantic matching.
 * Handles: employee_skills, extracted_skills, unknown_skills
 *
 * @module services/legacy-skill-migration
 * @story S-ONTO-01-05
 */
import { Pool } from 'pg';
interface MigrationJob {
    id: string;
    tenant_id: string;
    job_type: 'employee_skills' | 'extracted_skills' | 'unknown_skills' | 'all';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_records: number;
    processed_records: number;
    matched_records: number;
    failed_records: number;
    created_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
    error_message: string | null;
}
interface MigrationStats {
    total: number;
    processed: number;
    matched: number;
    custom_created: number;
    skipped: number;
    failed: number;
}
export declare class LegacySkillMigrationService {
    private pool;
    private openaiApiKey;
    constructor(pool: Pool);
    private initOpenAIKey;
    /**
     * Create a new migration job
     */
    createMigrationJob(tenantId: string, jobType?: MigrationJob['job_type']): Promise<MigrationJob>;
    /**
     * Count unmapped records by type
     */
    countUnmappedRecords(tenantId: string, jobType: MigrationJob['job_type']): Promise<Record<string, number>>;
    /**
     * Execute migration job
     */
    executeMigrationJob(jobId: string, options?: {
        confidenceThreshold?: number;
        batchSize?: number;
        createCustomSkills?: boolean;
    }): Promise<MigrationStats>;
    /**
     * Migrate employee_skills with custom_skill_name to ESCO
     */
    private migrateEmployeeSkills;
    /**
     * Migrate extracted_skills to ESCO
     */
    private migrateExtractedSkills;
    /**
     * Suggest ESCO mappings for unknown_skills
     */
    private migrateUnknownSkills;
    /**
     * Find best ESCO skill match using semantic search
     */
    private findBestEscoMatch;
    /**
     * Fallback text-based matching
     */
    private findBestEscoMatchByText;
    /**
     * Create a tenant custom skill linked to nearest ESCO
     */
    private createTenantCustomSkill;
    /**
     * Get migration job status
     */
    getJobStatus(jobId: string): Promise<MigrationJob | null>;
    /**
     * List migration jobs for a tenant
     */
    listJobs(tenantId: string, limit?: number, offset?: number): Promise<{
        jobs: MigrationJob[];
        total: number;
    }>;
    /**
     * Approve unknown skill suggestion
     */
    approveUnknownSkillMapping(skillId: string, approvedBy: string, usesuggested?: boolean, overrideEscoId?: string): Promise<void>;
    /**
     * Reject unknown skill suggestion
     */
    rejectUnknownSkillMapping(skillId: string, reviewedBy: string): Promise<void>;
    /**
     * Get migration summary for a tenant
     */
    getMigrationSummary(tenantId: string): Promise<{
        employee_skills: {
            total: number;
            mapped: number;
            unmapped: number;
        };
        extracted_skills: {
            total: number;
            mapped: number;
            unmapped: number;
        };
        unknown_skills: {
            total: number;
            approved: number;
            pending: number;
            rejected: number;
        };
        custom_skills: number;
    }>;
    private rowToJob;
    private mergeStats;
}
export default LegacySkillMigrationService;
//# sourceMappingURL=legacy-skill-migration.d.ts.map