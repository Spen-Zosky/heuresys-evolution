import { z } from 'zod';
// =============================================================================
// PAYROLL INTEGRATION SCHEMAS
// =============================================================================
/**
 * POST /payroll/integrations
 */
export const createPayrollIntegrationSchema = z.object({
    providerName: z.enum(['zucchetti', 'adsystems', 'teamsystem', 'inaz', 'custom'], {
        required_error: 'providerName is required',
    }),
    providerCode: z.string().trim().min(1, 'providerCode is required').max(50),
    displayName: z.string().trim().max(200).optional(),
    integrationType: z.enum(['api', 'file', 'sftp'], {
        required_error: 'integrationType is required',
    }),
    apiEndpoint: z.string().trim().url('Invalid API endpoint URL').max(2000).optional(),
    apiKey: z.string().trim().max(500).optional(),
    apiSecret: z.string().trim().max(500).optional(),
    sftpHost: z.string().trim().max(500).optional(),
    sftpPort: z.number().int().min(1).max(65535).optional(),
    sftpUsername: z.string().trim().max(200).optional(),
    sftpPassword: z.string().trim().max(500).optional(),
    sftpPath: z.string().trim().max(1000).optional(),
    companyCode: z.string().trim().max(50).optional(),
    fiscalCode: z.string().trim().max(20).optional(),
    vatNumber: z.string().trim().max(20).optional(),
    inpsCode: z.string().trim().max(20).optional(),
    inailCode: z.string().trim().max(20).optional(),
    exportFormat: z.enum(['csv', 'xml', 'json', 'fixed_width']).optional(),
    fileEncoding: z.string().trim().max(50).optional(),
    dateFormat: z.string().trim().max(50).optional(),
});
/**
 * PATCH /payroll/integrations/:id
 */
export const updatePayrollIntegrationSchema = createPayrollIntegrationSchema.partial();
/**
 * POST /payroll/jobs
 */
export const createExportJobSchema = z.object({
    integrationId: z.string().uuid('Invalid integration ID').optional(),
    jobName: z.string().trim().max(200).optional(),
    payPeriodYear: z
        .number()
        .int()
        .min(2020, 'Year must be 2020 or later')
        .max(2100, 'Year must be 2100 or earlier'),
    payPeriodMonth: z
        .number()
        .int()
        .min(1, 'Month must be between 1 and 12')
        .max(12, 'Month must be between 1 and 12'),
    exportType: z.enum(['full', 'delta', 'correction', 'annual'], {
        required_error: 'exportType is required',
    }),
    exportSections: z
        .array(z.enum(['anagrafica', 'presenze', 'straordinari', 'variazioni', 'assenze']))
        .optional(),
});
/**
 * POST /payroll/jobs/:id/transmit
 */
export const transmitExportSchema = z.object({
    confirmTransmission: z.literal(true, {
        errorMap: () => ({
            message: 'Explicit transmission confirmation is required (confirmTransmission: true)',
        }),
    }),
    method: z.enum(['api', 'sftp', 'file']).optional(),
});
/**
 * POST /payroll/jobs/:id/acknowledge
 */
export const acknowledgeExportSchema = z.object({
    reference: z.string().trim().min(1, 'reference is required').max(500),
    recordsAccepted: z.number().int().min(0).optional(),
    recordsRejected: z.number().int().min(0).optional(),
    details: z.string().trim().max(5000).optional(),
});
//# sourceMappingURL=compensation.js.map