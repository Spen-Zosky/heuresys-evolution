/**
 * Data Export Service
 * Epic 7 - Story 7.4: Data Export & Visualization
 *
 * Features:
 * - Multiple export formats (CSV, Excel, JSON, XML, PDF)
 * - Export configurations (saved templates)
 * - Background export jobs for large datasets
 * - Export history and download management
 * - Data transformation and formatting
 */
export type ExportFormat = 'csv' | 'excel' | 'json' | 'xml' | 'pdf';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
export interface ColumnConfig {
    field: string;
    header: string;
    width?: number;
    format?: string;
    transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'date' | 'currency' | 'number' | 'boolean';
    date_format?: string;
    number_format?: string;
    currency_symbol?: string;
}
export interface ExportOptions {
    format: ExportFormat;
    columns?: ColumnConfig[];
    include_headers?: boolean;
    delimiter?: string;
    sheet_name?: string;
    pretty_print?: boolean;
    root_element?: string;
    page_size?: 'A4' | 'letter' | 'legal';
    orientation?: 'portrait' | 'landscape';
    title?: string;
    subtitle?: string;
    footer?: string;
    include_timestamp?: boolean;
    include_filters?: boolean;
    max_rows?: number;
}
export interface ExportConfigInput {
    tenant_id: string;
    name: string;
    description?: string;
    data_source: 'report' | 'table' | 'query';
    report_id?: string;
    table_name?: string;
    query?: string;
    options: ExportOptions;
    is_default?: boolean;
    created_by: string;
}
export interface ExportJobInput {
    tenant_id: string;
    config_id?: string;
    type: 'report' | 'table' | 'dashboard' | 'custom';
    source_id?: string;
    options: ExportOptions;
    parameters?: Record<string, any>;
    filters?: Record<string, unknown>[];
    created_by: string;
}
export declare class DataExportService {
    /**
     * Create export configuration
     */
    createConfig(input: ExportConfigInput): Promise<Record<string, any>>;
    /**
     * Get export configuration
     */
    getConfig(tenantId: string, configId: string): Promise<Record<string, any>>;
    /**
     * List export configurations
     */
    listConfigs(tenantId: string, options?: {
        data_source?: string;
        search?: string;
    }): Promise<Record<string, any>[]>;
    /**
     * Update export configuration
     */
    updateConfig(tenantId: string, configId: string, updates: Partial<ExportConfigInput>): Promise<Record<string, any>>;
    /**
     * Delete export configuration
     */
    deleteConfig(tenantId: string, configId: string): Promise<boolean>;
    /**
     * Create and start export job
     */
    createExportJob(input: ExportJobInput): Promise<Record<string, any>>;
    /**
     * Process export job
     */
    private processExportJob;
    /**
     * Fetch data from a table
     */
    private fetchTableData;
    /**
     * Fetch dashboard data
     */
    private fetchDashboardData;
    /**
     * Transform data based on column configs
     */
    private transformData;
    /**
     * Format date value
     */
    private formatDate;
    /**
     * Format number value
     */
    private formatNumber;
    /**
     * Generate export content in specified format
     */
    private generateExport;
    /**
     * Generate CSV export
     */
    private generateCSV;
    /**
     * Escape CSV value
     */
    private escapeCSV;
    /**
     * Generate JSON export
     */
    private generateJSON;
    /**
     * Generate XML export
     */
    private generateXML;
    /**
     * Escape XML value
     */
    private escapeXML;
    /**
     * Generate Excel-compatible CSV
     */
    private generateExcelCSV;
    /**
     * Generate PDF-like text (simplified)
     */
    private generatePDFText;
    /**
     * Get export job
     */
    getJob(tenantId: string, jobId: string): Promise<Record<string, any>>;
    /**
     * List export jobs
     */
    listJobs(tenantId: string, options?: {
        status?: ExportStatus;
        type?: string;
        user_id?: string;
        page?: number;
        page_size?: number;
    }): Promise<{
        jobs: Record<string, unknown>[];
        total: number;
    }>;
    /**
     * Cancel export job
     */
    cancelJob(tenantId: string, jobId: string): Promise<boolean>;
    /**
     * Clean up expired jobs
     */
    cleanupExpiredJobs(): Promise<number>;
    /**
     * Get export statistics
     */
    getExportStats(tenantId: string): Promise<Record<string, any>>;
}
export declare const dataExportService: DataExportService;
//# sourceMappingURL=data-export.d.ts.map