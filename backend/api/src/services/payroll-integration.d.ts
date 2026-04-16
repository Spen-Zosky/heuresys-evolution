/**
 * Payroll Integration Service
 * Epic 7: Payroll Integration (Zucchetti)
 * Stories: 7.1-7.5
 *
 * Complete payroll export and integration service with:
 * - Provider configuration (Zucchetti, TeamSystem, etc.)
 * - Export generation with validation
 * - Anomaly detection
 * - Transmission and acknowledgment
 * - History and reporting
 */
export type PayrollProvider = 'zucchetti' | 'adsystems' | 'teamsystem' | 'inaz' | 'custom';
export type IntegrationType = 'api' | 'file' | 'sftp';
export type ExportFormat = 'csv' | 'xml' | 'json' | 'fixed_width';
export type ExportType = 'full' | 'delta' | 'correction' | 'annual';
export type ExportSection = 'anagrafica' | 'presenze' | 'straordinari' | 'variazioni' | 'assenze';
export type JobStatus = 'draft' | 'validating' | 'validation_complete' | 'validation_failed' | 'generating' | 'generated' | 'transmitting' | 'transmitted' | 'acknowledged' | 'completed' | 'failed';
export interface PayrollIntegrationConfig {
    providerName: PayrollProvider;
    providerCode: string;
    displayName?: string;
    integrationType: IntegrationType;
    apiEndpoint?: string;
    apiKey?: string;
    apiSecret?: string;
    sftpHost?: string;
    sftpPort?: number;
    sftpUsername?: string;
    sftpPassword?: string;
    sftpPath?: string;
    companyCode?: string;
    fiscalCode?: string;
    vatNumber?: string;
    inpsCode?: string;
    inailCode?: string;
    exportFormat?: ExportFormat;
    fileEncoding?: string;
    dateFormat?: string;
    decimalSeparator?: string;
    fieldDelimiter?: string;
    includeHeaders?: boolean;
    autoExportEnabled?: boolean;
    exportSchedule?: string;
    exportDayOfMonth?: number;
    exportCutoffDay?: number;
    notificationRecipients?: string[];
    settings?: Record<string, unknown>;
    fieldMappings?: Record<string, unknown>;
}
export interface ExportJobConfig {
    integrationId?: string;
    jobName?: string;
    payPeriodYear: number;
    payPeriodMonth: number;
    exportType: ExportType;
    exportSections?: ExportSection[];
}
export interface ValidationResult {
    isValid: boolean;
    totalEmployees: number;
    validEmployees: number;
    employeesWithErrors: number;
    employeesWithWarnings: number;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    blockedCount: number;
}
export interface ValidationError {
    employeeId: string;
    employeeCode?: string;
    employeeName?: string;
    ruleCode: string;
    ruleName: string;
    field?: string;
    message: string;
    value?: unknown;
    isBlocking: boolean;
}
export interface ValidationWarning {
    employeeId: string;
    employeeCode?: string;
    employeeName?: string;
    ruleCode: string;
    ruleName: string;
    field?: string;
    message: string;
    value?: unknown;
    suggestion?: string;
}
export interface ExportResult {
    jobId: string;
    status: JobStatus;
    fileName: string;
    filePath: string;
    fileSize: number;
    fileHash: string;
    totalEmployees: number;
    exportedEmployees: number;
    errors: number;
    warnings: number;
}
export interface TransmissionResult {
    jobId: string;
    success: boolean;
    transmissionMethod: string;
    transmissionReference?: string;
    providerResponse?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    recordsAccepted?: number;
    recordsRejected?: number;
}
export declare function decrypt(encryptedText: string): string;
export declare class PayrollIntegrationService {
    private tenantId;
    constructor(tenantId: string);
    /**
     * Create a new payroll integration configuration
     */
    createIntegration(config: PayrollIntegrationConfig): Promise<string>;
    /**
     * Get integration configuration
     */
    getIntegration(integrationId: string): Promise<Record<string, unknown> | null>;
    /**
     * List all integrations for tenant
     */
    listIntegrations(): Promise<Record<string, unknown>[]>;
    /**
     * Update integration configuration
     */
    updateIntegration(integrationId: string, updates: Partial<PayrollIntegrationConfig>): Promise<void>;
    /**
     * Test connection to payroll provider
     */
    testConnection(integrationId: string): Promise<{
        success: boolean;
        message: string;
        details?: Record<string, unknown>;
    }>;
    private testApiConnection;
    private testSftpConnection;
    /**
     * Create a new export job
     */
    createExportJob(config: ExportJobConfig, createdBy?: string): Promise<string>;
    /**
     * Get export job details
     */
    getExportJob(jobId: string): Promise<Record<string, unknown> | null>;
    /**
     * List export jobs
     */
    listExportJobs(options: {
        year?: number;
        month?: number;
        status?: JobStatus;
        limit?: number;
        offset?: number;
    }): Promise<{
        jobs: Record<string, unknown>[];
        total: number;
    }>;
    /**
     * Generate export file
     */
    generateExport(jobId: string): Promise<ExportResult>;
    private buildEmployeeExportRecord;
    private formatDate;
    private formatExportData;
    /**
     * Validate export job data
     */
    validateExport(jobId: string): Promise<ValidationResult>;
    private applyValidationRule;
    private detectAnomalies;
    /**
     * Transmit export to payroll provider
     */
    transmitExport(jobId: string, options: {
        confirmTransmission: boolean;
        method?: string;
    }): Promise<TransmissionResult>;
    private transmitViaApi;
    private transmitViaSftp;
    private logTransmission;
    /**
     * Record provider acknowledgment
     */
    recordAcknowledgment(jobId: string, acknowledgment: {
        reference: string;
        recordsAccepted?: number;
        recordsRejected?: number;
        details?: Record<string, unknown>;
    }): Promise<void>;
    /**
     * Mark export as completed
     */
    completeExport(jobId: string): Promise<void>;
    /**
     * Get export history with filtering
     */
    getExportHistory(options: {
        year?: number;
        status?: JobStatus;
        limit?: number;
        offset?: number;
    }): Promise<{
        exports: Record<string, unknown>[];
        total: number;
        summary: Record<string, unknown>;
    }>;
    /**
     * Get export files for a job
     */
    getExportFiles(jobId: string): Promise<Record<string, unknown>[]>;
    /**
     * Get transmission log for a job
     */
    getTransmissionLog(jobId: string): Promise<Record<string, unknown>[]>;
    /**
     * Compare export with previous period
     */
    compareWithPreviousPeriod(jobId: string): Promise<{
        currentPeriod: Record<string, unknown>;
        previousPeriod: Record<string, unknown> | null;
        differences: Record<string, unknown>[];
    }>;
    /**
     * Generate annual summary for CU preparation
     */
    getAnnualSummary(year: number): Promise<{
        year: number;
        totalExports: number;
        totalEmployeesExported: number;
        exportsByMonth: Record<string, unknown>[];
        summary: Record<string, unknown>;
    }>;
    private updateJobStatus;
    /**
     * Get validation rules
     */
    getValidationRules(): Promise<Record<string, unknown>[]>;
    /**
     * Get field mappings
     */
    getFieldMappings(integrationId?: string): Promise<Record<string, unknown>[]>;
    /**
     * Get payroll statistics
     */
    getStatistics(): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=payroll-integration.d.ts.map