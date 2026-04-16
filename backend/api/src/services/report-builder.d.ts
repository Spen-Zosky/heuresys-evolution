/**
 * Report Builder Engine Service
 * Epic 7 - Story 7.1: Report Builder Engine
 *
 * Features:
 * - Dynamic query builder for multiple data sources
 * - Calculated fields support
 * - Multi-table joins
 * - Parameterized reports
 * - Report execution engine
 * - Caching and performance optimization
 */
export interface ReportField {
    name: string;
    source_field: string;
    alias?: string;
    aggregate?: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
    format?: string;
}
export interface CalculatedField {
    name: string;
    expression: string;
    type: 'number' | 'string' | 'date' | 'boolean';
    alias?: string;
}
export interface ReportJoin {
    table: string;
    alias?: string;
    type: 'inner' | 'left' | 'right' | 'full';
    on: {
        left_field: string;
        right_field: string;
        operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
    };
}
export interface ReportFilter {
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'ilike' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'between';
    value?: any;
    value2?: any;
    parameterized?: boolean;
    parameter_name?: string;
}
export interface ReportSort {
    field: string;
    direction: 'asc' | 'desc';
}
export interface ReportGroupBy {
    field: string;
}
export interface ReportParameter {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select';
    label: string;
    default_value?: any;
    required?: boolean;
    options?: {
        value: any;
        label: string;
    }[];
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
    };
}
export interface DrillDownConfig {
    enabled: boolean;
    target_report_id?: string;
    parameters_mapping?: Record<string, string>;
    fields?: string[];
}
export interface ReportDefinitionInput {
    tenant_id: string;
    name: string;
    description?: string;
    category?: string;
    data_source: string;
    fields: ReportField[];
    calculated_fields?: CalculatedField[];
    joins?: ReportJoin[];
    filters?: ReportFilter[];
    sort?: ReportSort[];
    group_by?: ReportGroupBy[];
    parameters?: ReportParameter[];
    drill_down_config?: DrillDownConfig;
    access_control?: {
        roles?: string[];
        users?: string[];
        departments?: string[];
    };
    is_system?: boolean;
    is_public?: boolean;
    created_by: string;
}
export interface ReportExecutionOptions {
    parameters?: Record<string, any>;
    page?: number;
    page_size?: number;
    export_format?: 'json' | 'csv' | 'excel';
    include_totals?: boolean;
}
export interface ReportExecutionResult {
    execution_id: string;
    report_id: string;
    data: Record<string, unknown>[];
    totals?: Record<string, any>;
    metadata: {
        total_rows: number;
        page: number;
        page_size: number;
        total_pages: number;
        execution_time_ms: number;
        generated_at: string;
    };
}
export declare class ReportBuilderService {
    /**
     * Create a new report definition
     */
    createReport(input: ReportDefinitionInput): Promise<Record<string, any>>;
    /**
     * Get report definition by ID
     */
    getReport(tenantId: string, reportId: string): Promise<Record<string, any>>;
    /**
     * List reports for a tenant
     */
    listReports(tenantId: string, options?: {
        category?: string;
        search?: string;
        include_system?: boolean;
        page?: number;
        page_size?: number;
    }): Promise<{
        reports: Record<string, unknown>[];
        total: number;
    }>;
    /**
     * Update a report definition
     */
    updateReport(tenantId: string, reportId: string, updates: Partial<ReportDefinitionInput>): Promise<Record<string, any>>;
    /**
     * Delete a report (hard delete - templates cannot be deleted)
     */
    deleteReport(tenantId: string, reportId: string): Promise<boolean>;
    /**
     * Execute a report and return results
     */
    executeReport(tenantId: string, reportId: string, options?: ReportExecutionOptions): Promise<ReportExecutionResult>;
    /**
     * Calculate totals for numeric fields
     */
    private calculateTotals;
    /**
     * Log report execution
     */
    private logExecution;
    /**
     * Preview report (limited results for testing)
     */
    previewReport(tenantId: string, definition: Partial<ReportDefinitionInput>): Promise<Record<string, any>[]>;
    /**
     * Clone an existing report
     */
    cloneReport(tenantId: string, reportId: string, newName: string, createdBy: string): Promise<Record<string, any>>;
    /**
     * Get available data sources for reporting
     */
    getAvailableDataSources(): {
        name: string;
        description: string;
    }[];
    private getTableDescription;
    /**
     * Get field metadata for a data source
     */
    getDataSourceFields(dataSource: string): Promise<Record<string, any>[]>;
    private mapPostgresType;
    /**
     * Get report execution history
     */
    getExecutionHistory(tenantId: string, reportId: string, limit?: number): Promise<Record<string, any>[]>;
}
export declare const reportBuilderService: ReportBuilderService;
//# sourceMappingURL=report-builder.d.ts.map