/**
 * SAP Migration Service
 * SAP HCM data import, validation, and synchronization
 * Epic 6: SAP HCM Migration - Stories 6.1-6.6
 */
export type MigrationJobType = 'full' | 'delta' | 'dry_run' | 'rollback';
export type MigrationStatus = 'pending' | 'parsing' | 'validating' | 'mapping' | 'executing' | 'completed' | 'failed' | 'rolled_back' | 'cancelled';
export interface MigrationJobConfig {
    name: string;
    description?: string | undefined;
    sourceSystem: string;
    migrationScope: string[];
    jobType?: MigrationJobType | undefined;
    infotypeSelection?: string[] | undefined;
    validateOnly?: boolean | undefined;
    continueOnError?: boolean | undefined;
    batchSize?: number | undefined;
}
export interface InfotypeMappingRule {
    id: string;
    infotype: string;
    sapField: string;
    targetTable: string;
    targetField: string;
    transformType: string;
    transformConfig?: Record<string, unknown>;
    validationRules?: Record<string, unknown>;
    required: boolean;
    defaultValue?: string;
}
export interface StagedRecord {
    id: string;
    infotype: string;
    pernr: string;
    subtype?: string;
    begda?: string;
    endda?: string;
    rawData: Record<string, unknown>;
    status: string;
    validationErrors?: ValidationError[];
    validationWarnings?: ValidationWarning[];
    mappedData?: Record<string, unknown>;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
    code: string;
}
export interface ValidationWarning {
    field: string;
    message: string;
    value?: unknown;
    suggestion?: string;
}
export interface MigrationResult {
    jobId: string;
    status: MigrationStatus;
    totalRecords: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
    skippedCount: number;
    success: boolean;
    errors?: Array<{
        pernr: string;
        infotype: string;
        message: string;
    }> | undefined;
}
export interface ParsedSAPData {
    infotype: string;
    pernr: string;
    subtype?: string | undefined;
    begda?: string | undefined;
    endda?: string | undefined;
    seqnr?: number | undefined;
    data: Record<string, unknown>;
}
export declare class SAPExportParser {
    constructor();
    /**
     * Parse SAP HCM export file (supports CSV, JSON, XML formats)
     */
    parseExportFile(content: string, format?: 'csv' | 'json' | 'xml'): Promise<ParsedSAPData[]>;
    parseCSV(content: string): ParsedSAPData[];
    private parseCSVLine;
    parseJSON(content: string): ParsedSAPData[];
    parseXML(content: string): ParsedSAPData[];
    private parseSAPDate;
    private detectInfotype;
}
export declare class SAPMigrationService {
    private tenantId;
    private parser;
    constructor(tenantId: string);
    createMigrationJob(config: MigrationJobConfig, createdBy?: string): Promise<string>;
    listJobs(options: {
        status?: string | undefined;
        limit: number;
        offset: number;
    }): Promise<Record<string, unknown>[]>;
    getJob(jobId: string): Promise<Record<string, unknown> | null>;
    updateJobStatus(jobId: string, status: MigrationStatus, updates?: {
        progress?: number;
        currentPhase?: string;
        processedRecords?: number;
        successCount?: number;
        errorCount?: number;
        warningCount?: number;
        summary?: Record<string, unknown>;
        errorLog?: Array<unknown>;
    }): Promise<void>;
    parseAndStage(jobId: string, fileContent: string, format?: 'csv' | 'json' | 'xml', infotype?: string): Promise<{
        totalRecords: number;
        stagedCount: number;
        byInfotype: Record<string, number>;
    }>;
    validateStagedData(jobId: string): Promise<{
        validCount: number;
        errorCount: number;
        warningCount: number;
    }>;
    private applyValidationRules;
    mapStagedData(jobId: string): Promise<{
        mappedCount: number;
        errorCount: number;
    }>;
    private mapRecord;
    private transformValue;
    executeMigration(jobId: string, dryRun?: boolean): Promise<MigrationResult>;
    private importRecord;
    private logRollback;
    rollbackMigration(jobId: string): Promise<{
        rolledBackCount: number;
        errorCount: number;
    }>;
    deltaSyncCheck(fileContent?: string, format?: string): Promise<{
        changedRecords: number;
        newRecords: number;
        deletedRecords: number;
    }>;
    executeDeltaSync(fileContent: string, format: string): Promise<{
        updatedCount: number;
        createdCount: number;
        errors: string[];
    }>;
    getDeltaSyncHistory(options: {
        limit: number;
        offset: number;
    }): Promise<Record<string, unknown>[]>;
    logDeltaSync(stats: {
        recordsChecked: number;
        recordsCreated: number;
        recordsUpdated: number;
        recordsDeleted: number;
        recordsUnchanged: number;
        status: string;
        errorMessage?: string | undefined;
    }): Promise<void>;
    getValidationErrors(jobId: string, options: {
        severity?: string | undefined;
        limit: number;
        offset: number;
    }): Promise<Record<string, unknown>[]>;
    getMappings(infotype?: string): Promise<InfotypeMappingRule[]>;
    createMapping(mapping: {
        infotype: string;
        infotypeName?: string;
        sapField: string;
        targetTable: string;
        targetField: string;
        transformType: string;
        transformConfig?: Record<string, unknown>;
        required: boolean;
    }): Promise<string>;
    updateMapping(mappingId: string, updates: Partial<{
        sapField: string;
        targetField: string;
        transformType: string;
        transformConfig: Record<string, unknown>;
        required: boolean;
        isActive: boolean;
    }>): Promise<void>;
    deleteMapping(mappingId: string): Promise<void>;
    getEmployeeMappings(options: {
        limit: number;
        offset: number;
    }): Promise<Record<string, unknown>[]>;
    createEmployeeMapping(sapPernr: string, employeeId: string): Promise<void>;
    getStats(): Promise<Record<string, unknown>>;
    private getInfotypeMappings;
}
export declare function createSAPMigrationService(tenantId: string): SAPMigrationService;
export default SAPMigrationService;
//# sourceMappingURL=sap-migration.d.ts.map