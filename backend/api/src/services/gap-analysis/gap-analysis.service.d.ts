/**
 * Gap Analysis Service
 * Epic: E-ONTO-03 (Business Applications)
 * Story: S-ONTO-03-05 (Gap Analysis Engine)
 *
 * Analyzes skill gaps between:
 * - Employee skills vs Role requirements
 * - Team skills vs Project requirements
 */
export interface KsabaLevels {
    knowledge: number;
    skill: number;
    ability: number;
    behavior: number;
    attitude: number;
}
export interface SkillGap {
    skillId: string;
    skillName: string;
    skillType: string;
    skillGroup: string | null;
    current: KsabaLevels;
    required: KsabaLevels;
    gaps: KsabaLevels;
    currentComposite: number;
    requiredComposite: number;
    gapScore: number;
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    importance: string;
    weight: number;
    isPrimary: boolean;
}
export interface GapAnalysisResult {
    analysisId: string;
    analysisType: 'employee_role' | 'team_role' | 'team_project';
    timestamp: Date;
    targetType: 'employee' | 'team';
    targetId: string;
    targetName: string;
    requirementType: 'role' | 'project';
    requirementId: string;
    requirementName: string;
    overallGapScore: number;
    overallFitScore: number;
    gapCount: number;
    skillsExceeding: number;
    skillsMeeting: number;
    skillsBelowMinor: number;
    skillsBelowMajor: number;
    skillsMissing: number;
    severityDistribution: {
        none: number;
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    gaps: SkillGap[];
    ksabaGaps: KsabaLevels;
}
export declare function analyzeEmployeeVsRole(employeeId: string, roleId: string, tenantId?: string): Promise<GapAnalysisResult>;
export declare function analyzeTeamVsRole(employeeIds: string[], roleId: string, aggregation?: 'average' | 'best' | 'coverage', tenantId?: string): Promise<GapAnalysisResult>;
export declare const gapAnalysisService: {
    analyzeEmployeeVsRole: typeof analyzeEmployeeVsRole;
    analyzeTeamVsRole: typeof analyzeTeamVsRole;
};
//# sourceMappingURL=gap-analysis.service.d.ts.map