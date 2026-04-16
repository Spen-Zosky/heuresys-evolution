/**
 * HR Intelligence Service
 * Epic 8: HR Intelligence
 * Stories: 8.1-8.5
 */
export interface ESCOSkill {
    id: string;
    uri: string;
    preferredLabel: string;
    altLabels: string[];
    description: string;
    skillType: string;
    reuseLevel: string;
    isDigital: boolean;
    isGreen: boolean;
    broaderUri: string | null;
    narrowerUris: string[];
    relatedUris: string[];
    iscoGroups: string[];
}
export interface ESCOOccupation {
    id: string;
    uri: string;
    preferredLabel: string;
    altLabels: string[];
    description: string;
    iscoGroup: string;
    essentialSkills: string[];
    optionalSkills: string[];
}
export interface EmployeeSkill {
    id: string;
    employeeId: string;
    escoSkillId?: string;
    customSkillName?: string;
    proficiencyLevel: number;
    proficiencyLabel: string;
    yearsExperience?: number;
    isPrimary: boolean;
    isVerified: boolean;
    source: 'self_assessment' | 'manager_assessment' | 'certification' | 'ai_inferred';
    confidenceScore?: number;
    lastUsedAt?: Date;
}
export interface SkillGapAnalysis {
    id: string;
    analysisName: string;
    analysisType: 'individual' | 'team' | 'department' | 'organization';
    targetEntityId?: string;
    targetPositionName?: string;
    overallMatchScore: number;
    coverageScore: number;
    proficiencyScore: number;
    skillMatches: SkillMatch[];
    skillGaps: SkillGap[];
    recommendations: string[];
}
export interface SkillMatch {
    skillId: string;
    skillName: string;
    requiredLevel: number;
    currentLevel: number;
    status: 'exceeds' | 'meets' | 'below';
}
export interface SkillGap {
    skillId: string;
    skillName: string;
    requiredLevel: number;
    currentLevel: number;
    gapSize: number;
    priority: 'high' | 'medium' | 'low';
    trainingRecommendations: string[];
}
export interface MarketBenchmark {
    skillUri: string;
    skillName: string;
    demandScore: number;
    avgSalaryMin: number;
    avgSalaryMax: number;
    growthRate: number;
    jobPostingsCount: number;
    trendDirection: 'up' | 'down' | 'stable';
}
export interface SkillExtractionResult {
    extractedSkills: string[];
    mappedSkills: MappedSkill[];
    unmappedSkills: string[];
    confidence: number;
}
export interface MappedSkill {
    originalText: string;
    escoUri: string;
    escoLabel: string;
    confidence: number;
}
export declare class HRIntelligenceService {
    private tenantId;
    constructor(tenantId: string);
    /**
     * Search ESCO skills by text
     */
    searchSkills(query: string, options?: {
        skillType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        skills: ESCOSkill[];
        total: number;
    }>;
    /**
     * Get ESCO skill by ID or URI
     */
    getSkill(idOrUri: string): Promise<ESCOSkill | null>;
    /**
     * Get skill hierarchy (broader/narrower)
     */
    getSkillHierarchy(skillUri: string): Promise<{
        skill: ESCOSkill | null;
        broader: ESCOSkill[];
        narrower: ESCOSkill[];
        related: ESCOSkill[];
    }>;
    /**
     * Search ESCO occupations
     */
    searchOccupations(query: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<{
        occupations: ESCOOccupation[];
        total: number;
    }>;
    /**
     * Get skills required for an occupation
     */
    getOccupationSkills(occupationUri: string): Promise<{
        occupation: ESCOOccupation | null;
        essentialSkills: ESCOSkill[];
        optionalSkills: ESCOSkill[];
    }>;
    /**
     * Add skill to employee
     */
    addEmployeeSkill(employeeId: string, skillData: {
        escoSkillId?: string;
        customSkillName?: string;
        proficiencyLevel: number;
        yearsExperience?: number;
        isPrimary?: boolean;
        source?: string;
        notes?: string;
    }): Promise<string>;
    /**
     * Get employee skills
     */
    getEmployeeSkills(employeeId: string, options?: {
        includeESCODetails?: boolean;
    }): Promise<EmployeeSkill[]>;
    /**
     * Update employee skill
     */
    updateEmployeeSkill(skillId: string, updates: Partial<{
        proficiencyLevel: number;
        yearsExperience: number;
        isPrimary: boolean;
        lastUsedAt: Date;
        notes: string;
    }>): Promise<void>;
    /**
     * Verify employee skill
     */
    verifyEmployeeSkill(skillId: string, verifiedBy: string): Promise<void>;
    /**
     * Delete employee skill
     */
    deleteEmployeeSkill(skillId: string): Promise<void>;
    /**
     * Get job market sources
     */
    getJobMarketSources(): Promise<Record<string, unknown>[]>;
    /**
     * Search job market postings
     */
    searchJobPostings(options: {
        query?: string;
        skills?: string[];
        location?: string;
        countryCode?: string;
        industry?: string;
        experienceLevel?: string;
        salaryMin?: number;
        salaryMax?: number;
        employmentType?: string;
        locationType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        postings: Record<string, unknown>[];
        total: number;
    }>;
    /**
     * Get job market statistics
     */
    getJobMarketStatistics(options: {
        countryCode?: string;
        industry?: string;
        period?: 'daily' | 'weekly' | 'monthly';
        days?: number;
    }): Promise<Record<string, unknown>[]>;
    /**
     * Get trending skills from job market
     */
    getTrendingSkills(options: {
        countryCode?: string;
        industry?: string;
        days?: number;
        limit?: number;
    }): Promise<MarketBenchmark[]>;
    /**
     * Extract skills from text
     */
    extractSkills(text: string, options?: {
        source?: string;
        jobType?: string;
    }): Promise<SkillExtractionResult>;
    /**
     * Simple keyword extraction (placeholder for NLP)
     */
    private extractSkillKeywords;
    /**
     * Find best ESCO match for a skill text
     */
    private findBestESCOMatch;
    /**
     * Add skill alias
     */
    addSkillAlias(escoSkillId: string, aliasText: string, aliasType?: string): Promise<string>;
    /**
     * Create skill gap analysis for an employee
     */
    createSkillGapAnalysis(employeeId: string, targetPositionId: string, analysisName: string): Promise<SkillGapAnalysis>;
    /**
     * Generate training recommendations
     */
    private generateTrainingRecommendations;
    /**
     * Generate overall recommendations
     */
    private generateRecommendations;
    /**
     * Get skill gap analysis
     */
    getSkillGapAnalysis(analysisId: string): Promise<SkillGapAnalysis | null>;
    /**
     * List skill gap analyses
     */
    listSkillGapAnalyses(options: {
        entityType?: string;
        entityId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        analyses: Record<string, unknown>[];
        total: number;
    }>;
    /**
     * Generate team skill matrix
     */
    generateSkillMatrix(entityType: 'team' | 'department', entityId: string, matrixName: string): Promise<string>;
    /**
     * Get benchmark configurations
     */
    getBenchmarkConfigs(): Promise<Record<string, unknown>[]>;
    /**
     * Create benchmark report
     */
    createBenchmarkReport(configId: string | null, reportName: string, reportType: 'salary_benchmark' | 'skill_demand' | 'talent_availability'): Promise<string>;
    /**
     * Generate salary benchmark data
     */
    private generateSalaryBenchmark;
    /**
     * Generate skill demand report
     */
    private generateSkillDemandReport;
    /**
     * Generate talent availability report
     */
    private generateTalentAvailabilityReport;
    /**
     * Get benchmark report
     */
    getBenchmarkReport(reportId: string): Promise<Record<string, unknown> | null>;
    /**
     * List benchmark reports
     */
    listBenchmarkReports(options: {
        reportType?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        reports: Record<string, unknown>[];
        total: number;
    }>;
    private mapESCOSkill;
    private mapESCOOccupation;
}
//# sourceMappingURL=hr-intelligence.d.ts.map