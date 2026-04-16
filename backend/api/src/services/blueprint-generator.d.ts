/**
 * Blueprint Generator Service
 * Dual-mode engine: greenfield (generate from template) + overlay (analyze existing tenant).
 * 5 overlay analyzers: org_units, process_coverage, skill_gaps, hierarchy, KPI coverage.
 * Rule-based deterministic core — no AI calls.
 */
import { PoolClient } from 'pg';
import type { BlueprintRun, BlueprintResult } from './business-process-research.js';
export interface BlueprintRunInput {
    templateId: string;
    tenantId: string;
    runMode: 'greenfield' | 'overlay';
    createdBy?: string;
    inputConfig?: Record<string, unknown>;
}
export interface BlueprintRunOutput {
    run: BlueprintRun;
    results: BlueprintResult[];
    summary: {
        total: number;
        bySeverity: Record<string, number>;
        byType: Record<string, number>;
    };
}
export declare class BlueprintGeneratorService {
    private dbClient;
    constructor(dbClient: PoolClient);
    runBlueprint(input: BlueprintRunInput): Promise<BlueprintRunOutput>;
    private runGreenfield;
    private runOverlay;
    private analyzeOrgUnits;
    private analyzeProcessCoverage;
    private analyzeSkillGaps;
    private analyzeHierarchy;
    private analyzeKpiCoverage;
    private loadTemplate;
    private createRun;
    private updateRunStatus;
    private completeRun;
    private failRun;
    private saveResults;
    private buildSummary;
    private computeAvgProficiency;
    private mapTemplate;
    private mapRun;
    private mapResult;
}
//# sourceMappingURL=blueprint-generator.d.ts.map