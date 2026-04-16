/**
 * Export Engine Service
 * Generates Excel (.xlsx) and PDF reports for blueprint results,
 * skill gap analysis, org chart, and skill inventory.
 * Horizon O2.3
 */
import { PoolClient } from 'pg';
export interface SkillInventoryFilters {
    orgUnitId?: string | undefined;
    verificationStatus?: string | undefined;
    minCompositeScore?: number | undefined;
    skillType?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}
type ExportFormat = 'xlsx' | 'pdf';
export declare class ExportEngineService {
    private dbClient;
    constructor(dbClient: PoolClient);
    exportBlueprintReport(runId: string, format: ExportFormat): Promise<Buffer>;
    private blueprintToXlsx;
    private blueprintToPdf;
    exportSkillGapReport(orgUnitId: string, format: ExportFormat): Promise<Buffer>;
    private skillGapToXlsx;
    private skillGapToPdf;
    exportOrgChart(format: ExportFormat): Promise<Buffer>;
    private orgChartToXlsx;
    private orgChartToPdf;
    exportSkillInventory(filters: SkillInventoryFilters | undefined, format: ExportFormat): Promise<Buffer>;
    private skillInventoryToXlsx;
    private skillInventoryToPdf;
}
export {};
//# sourceMappingURL=export-engine.d.ts.map