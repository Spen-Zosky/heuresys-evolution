/**
 * Import Engine Service
 * CSV/Excel parsing, validation, mapping, and upsert for bulk data import.
 * Supports: employees, org_units, roles (rbp), skills (tenant_custom), process_roles.
 */
import { PoolClient } from 'pg';
export type ImportType = 'employees' | 'org_units' | 'roles' | 'skills' | 'process_roles';
export interface ParsedRow {
    [key: string]: string | number | boolean | null;
}
export interface ParsedData {
    headers: string[];
    rows: ParsedRow[];
    totalRows: number;
}
export interface ValidationError {
    row: number;
    field: string;
    value: unknown;
    message: string;
    severity: 'error' | 'warning';
}
export interface ValidationResult {
    validRows: ParsedRow[];
    errors: ValidationError[];
    warnings: ValidationError[];
    totalRows: number;
    validCount: number;
    errorCount: number;
}
export interface MappedEntity {
    data: Record<string, unknown>;
    sourceRow: number;
    matchKey: Record<string, unknown>;
}
export interface MappedEntities {
    importType: ImportType;
    entities: MappedEntity[];
    tenantId: string;
}
export interface ImportResult {
    createdRows: number;
    updatedRows: number;
    skippedRows: number;
    errors: ValidationError[];
}
export declare class ImportEngineService {
    private dbClient;
    constructor(dbClient: PoolClient);
    parseFile(buffer: Buffer, mimeType: string, fileName: string): Promise<ParsedData>;
    private parseCsv;
    private parseExcel;
    validateData(parsed: ParsedData, importType: ImportType, tenantId: string): Promise<ValidationResult>;
    mapToEntities(validated: ValidationResult, importType: ImportType, tenantId: string): MappedEntities;
    executeImport(mapped: MappedEntities, _tenantId: string, _userId: string): Promise<ImportResult>;
}
//# sourceMappingURL=import-engine.d.ts.map