/**
 * Zod Schemas for Reports Routes
 * Covers: report definitions, execution, cloning, preview
 */
import { z } from 'zod';
// =============================================================================
// FIELD/FILTER/SORT SUB-SCHEMAS
// =============================================================================
const reportFieldSchema = z.object({
    name: z.string().trim().max(200),
    source_field: z.string().trim().max(200).optional(),
    alias: z.string().trim().max(200).optional(),
    aggregate: z.string().trim().max(50).optional(),
    format: z.string().trim().max(100).optional(),
});
const reportJoinSchema = z.object({
    table: z.string().trim().max(200),
    type: z.string().trim().max(20).optional(),
    on: z.record(z.unknown()).optional(),
});
const reportFilterSchema = z.object({
    field: z.string().trim().max(200),
    operator: z.string().trim().max(20),
    value: z.unknown(),
});
const reportSortSchema = z.object({
    field: z.string().trim().max(200),
    direction: z.enum(['asc', 'desc']).optional(),
});
const reportGroupBySchema = z.object({
    field: z.string().trim().max(200),
});
// =============================================================================
// REPORT DEFINITIONS
// =============================================================================
export const createReportSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    data_source: z.string().trim().min(1, 'Data source is required').max(100),
    fields: z.array(reportFieldSchema).min(1, 'At least one field is required'),
    calculated_fields: z.array(z.record(z.unknown())).optional().nullable(),
    joins: z.array(reportJoinSchema).optional().nullable(),
    filters: z.array(reportFilterSchema).optional().nullable(),
    sort: z.array(reportSortSchema).optional().nullable(),
    group_by: z.array(reportGroupBySchema).optional().nullable(),
    parameters: z.array(z.record(z.unknown())).optional().nullable(),
    drill_down_config: z.record(z.unknown()).optional().nullable(),
    access_control: z.record(z.unknown()).optional().nullable(),
    is_public: z.boolean().optional(),
    created_by: z.string().trim().max(200).optional(),
});
export const updateReportSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
    data_source: z.string().trim().max(100).optional(),
    fields: z.array(reportFieldSchema).optional(),
    calculated_fields: z.array(z.record(z.unknown())).optional().nullable(),
    joins: z.array(reportJoinSchema).optional().nullable(),
    filters: z.array(reportFilterSchema).optional().nullable(),
    sort: z.array(reportSortSchema).optional().nullable(),
    group_by: z.array(reportGroupBySchema).optional().nullable(),
    parameters: z.array(z.record(z.unknown())).optional().nullable(),
    drill_down_config: z.record(z.unknown()).optional().nullable(),
    access_control: z.record(z.unknown()).optional().nullable(),
    is_public: z.boolean().optional(),
});
// =============================================================================
// REPORT CLONING
// =============================================================================
export const cloneReportSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    created_by: z.string().trim().max(200).optional(),
});
// =============================================================================
// REPORT EXECUTION
// =============================================================================
export const executeReportSchema = z.object({
    parameters: z.record(z.unknown()).optional().nullable(),
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(10000).optional(),
    include_totals: z.boolean().optional(),
});
// =============================================================================
// REPORT PREVIEW
// =============================================================================
export const previewReportSchema = z.object({
    data_source: z.string().trim().min(1, 'Data source is required').max(100),
    fields: z.array(reportFieldSchema).min(1, 'At least one field is required'),
    calculated_fields: z.array(z.record(z.unknown())).optional().nullable(),
    joins: z.array(reportJoinSchema).optional().nullable(),
    filters: z.array(reportFilterSchema).optional().nullable(),
    sort: z.array(reportSortSchema).optional().nullable(),
    group_by: z.array(reportGroupBySchema).optional().nullable(),
    parameters: z.array(z.record(z.unknown())).optional().nullable(),
});
//# sourceMappingURL=reports.js.map