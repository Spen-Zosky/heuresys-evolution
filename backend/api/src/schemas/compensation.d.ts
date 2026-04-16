import { z } from 'zod';
/**
 * POST /payroll/integrations
 */
export declare const createPayrollIntegrationSchema: z.ZodObject<{
    providerName: z.ZodEnum<["zucchetti", "adsystems", "teamsystem", "inaz", "custom"]>;
    providerCode: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
    integrationType: z.ZodEnum<["api", "file", "sftp"]>;
    apiEndpoint: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
    apiSecret: z.ZodOptional<z.ZodString>;
    sftpHost: z.ZodOptional<z.ZodString>;
    sftpPort: z.ZodOptional<z.ZodNumber>;
    sftpUsername: z.ZodOptional<z.ZodString>;
    sftpPassword: z.ZodOptional<z.ZodString>;
    sftpPath: z.ZodOptional<z.ZodString>;
    companyCode: z.ZodOptional<z.ZodString>;
    fiscalCode: z.ZodOptional<z.ZodString>;
    vatNumber: z.ZodOptional<z.ZodString>;
    inpsCode: z.ZodOptional<z.ZodString>;
    inailCode: z.ZodOptional<z.ZodString>;
    exportFormat: z.ZodOptional<z.ZodEnum<["csv", "xml", "json", "fixed_width"]>>;
    fileEncoding: z.ZodOptional<z.ZodString>;
    dateFormat: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    providerName: "custom" | "zucchetti" | "adsystems" | "teamsystem" | "inaz";
    providerCode: string;
    integrationType: "api" | "file" | "sftp";
    displayName?: string | undefined;
    apiEndpoint?: string | undefined;
    apiKey?: string | undefined;
    apiSecret?: string | undefined;
    sftpHost?: string | undefined;
    sftpPort?: number | undefined;
    sftpUsername?: string | undefined;
    sftpPassword?: string | undefined;
    sftpPath?: string | undefined;
    companyCode?: string | undefined;
    fiscalCode?: string | undefined;
    vatNumber?: string | undefined;
    inpsCode?: string | undefined;
    inailCode?: string | undefined;
    exportFormat?: "csv" | "xml" | "json" | "fixed_width" | undefined;
    fileEncoding?: string | undefined;
    dateFormat?: string | undefined;
}, {
    providerName: "custom" | "zucchetti" | "adsystems" | "teamsystem" | "inaz";
    providerCode: string;
    integrationType: "api" | "file" | "sftp";
    displayName?: string | undefined;
    apiEndpoint?: string | undefined;
    apiKey?: string | undefined;
    apiSecret?: string | undefined;
    sftpHost?: string | undefined;
    sftpPort?: number | undefined;
    sftpUsername?: string | undefined;
    sftpPassword?: string | undefined;
    sftpPath?: string | undefined;
    companyCode?: string | undefined;
    fiscalCode?: string | undefined;
    vatNumber?: string | undefined;
    inpsCode?: string | undefined;
    inailCode?: string | undefined;
    exportFormat?: "csv" | "xml" | "json" | "fixed_width" | undefined;
    fileEncoding?: string | undefined;
    dateFormat?: string | undefined;
}>;
/**
 * PATCH /payroll/integrations/:id
 */
export declare const updatePayrollIntegrationSchema: z.ZodObject<{
    providerName: z.ZodOptional<z.ZodEnum<["zucchetti", "adsystems", "teamsystem", "inaz", "custom"]>>;
    providerCode: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    integrationType: z.ZodOptional<z.ZodEnum<["api", "file", "sftp"]>>;
    apiEndpoint: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    apiKey: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    apiSecret: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sftpHost: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sftpPort: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    sftpUsername: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sftpPassword: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sftpPath: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    companyCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fiscalCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    vatNumber: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    inpsCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    inailCode: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    exportFormat: z.ZodOptional<z.ZodOptional<z.ZodEnum<["csv", "xml", "json", "fixed_width"]>>>;
    fileEncoding: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    dateFormat: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    providerName?: "custom" | "zucchetti" | "adsystems" | "teamsystem" | "inaz" | undefined;
    providerCode?: string | undefined;
    displayName?: string | undefined;
    integrationType?: "api" | "file" | "sftp" | undefined;
    apiEndpoint?: string | undefined;
    apiKey?: string | undefined;
    apiSecret?: string | undefined;
    sftpHost?: string | undefined;
    sftpPort?: number | undefined;
    sftpUsername?: string | undefined;
    sftpPassword?: string | undefined;
    sftpPath?: string | undefined;
    companyCode?: string | undefined;
    fiscalCode?: string | undefined;
    vatNumber?: string | undefined;
    inpsCode?: string | undefined;
    inailCode?: string | undefined;
    exportFormat?: "csv" | "xml" | "json" | "fixed_width" | undefined;
    fileEncoding?: string | undefined;
    dateFormat?: string | undefined;
}, {
    providerName?: "custom" | "zucchetti" | "adsystems" | "teamsystem" | "inaz" | undefined;
    providerCode?: string | undefined;
    displayName?: string | undefined;
    integrationType?: "api" | "file" | "sftp" | undefined;
    apiEndpoint?: string | undefined;
    apiKey?: string | undefined;
    apiSecret?: string | undefined;
    sftpHost?: string | undefined;
    sftpPort?: number | undefined;
    sftpUsername?: string | undefined;
    sftpPassword?: string | undefined;
    sftpPath?: string | undefined;
    companyCode?: string | undefined;
    fiscalCode?: string | undefined;
    vatNumber?: string | undefined;
    inpsCode?: string | undefined;
    inailCode?: string | undefined;
    exportFormat?: "csv" | "xml" | "json" | "fixed_width" | undefined;
    fileEncoding?: string | undefined;
    dateFormat?: string | undefined;
}>;
/**
 * POST /payroll/jobs
 */
export declare const createExportJobSchema: z.ZodObject<{
    integrationId: z.ZodOptional<z.ZodString>;
    jobName: z.ZodOptional<z.ZodString>;
    payPeriodYear: z.ZodNumber;
    payPeriodMonth: z.ZodNumber;
    exportType: z.ZodEnum<["full", "delta", "correction", "annual"]>;
    exportSections: z.ZodOptional<z.ZodArray<z.ZodEnum<["anagrafica", "presenze", "straordinari", "variazioni", "assenze"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    payPeriodYear: number;
    payPeriodMonth: number;
    exportType: "full" | "delta" | "correction" | "annual";
    integrationId?: string | undefined;
    jobName?: string | undefined;
    exportSections?: ("anagrafica" | "presenze" | "straordinari" | "variazioni" | "assenze")[] | undefined;
}, {
    payPeriodYear: number;
    payPeriodMonth: number;
    exportType: "full" | "delta" | "correction" | "annual";
    integrationId?: string | undefined;
    jobName?: string | undefined;
    exportSections?: ("anagrafica" | "presenze" | "straordinari" | "variazioni" | "assenze")[] | undefined;
}>;
/**
 * POST /payroll/jobs/:id/transmit
 */
export declare const transmitExportSchema: z.ZodObject<{
    confirmTransmission: z.ZodLiteral<true>;
    method: z.ZodOptional<z.ZodEnum<["api", "sftp", "file"]>>;
}, "strip", z.ZodTypeAny, {
    confirmTransmission: true;
    method?: "api" | "file" | "sftp" | undefined;
}, {
    confirmTransmission: true;
    method?: "api" | "file" | "sftp" | undefined;
}>;
/**
 * POST /payroll/jobs/:id/acknowledge
 */
export declare const acknowledgeExportSchema: z.ZodObject<{
    reference: z.ZodString;
    recordsAccepted: z.ZodOptional<z.ZodNumber>;
    recordsRejected: z.ZodOptional<z.ZodNumber>;
    details: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reference: string;
    recordsAccepted?: number | undefined;
    recordsRejected?: number | undefined;
    details?: string | undefined;
}, {
    reference: string;
    recordsAccepted?: number | undefined;
    recordsRejected?: number | undefined;
    details?: string | undefined;
}>;
//# sourceMappingURL=compensation.d.ts.map