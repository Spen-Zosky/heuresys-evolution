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

import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { reportBuilderService } from './report-builder.js';
import { escapeILIKE } from '../utils/sql-safety.js';
import { logger } from '../config/logger.js';

// ============================================================================
// Types
// ============================================================================

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
  delimiter?: string; // For CSV
  sheet_name?: string; // For Excel
  pretty_print?: boolean; // For JSON
  root_element?: string; // For XML
  page_size?: 'A4' | 'letter' | 'legal'; // For PDF
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

// ============================================================================
// Data Export Service
// ============================================================================

export class DataExportService {
  // ==========================================================================
  // Export Configurations
  // ==========================================================================

  /**
   * Create export configuration
   */
  async createConfig(input: ExportConfigInput): Promise<Record<string, any>> {
    const id = uuidv4();

    const query = `
      INSERT INTO export_configurations (
        id, tenant_id, name, description, data_source,
        report_id, table_name, query, options, is_default, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      input.tenant_id,
      input.name,
      input.description || null,
      input.data_source,
      input.report_id || null,
      input.table_name || null,
      input.query || null,
      JSON.stringify(input.options),
      input.is_default || false,
      input.created_by,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get export configuration
   */
  async getConfig(tenantId: string, configId: string): Promise<Record<string, any>> {
    const query = `
      SELECT * FROM export_configurations
      WHERE id = $1 AND tenant_id = $2
    `;
    const result = await pool.query(query, [configId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * List export configurations
   */
  async listConfigs(
    tenantId: string,
    options?: {
      data_source?: string;
      search?: string;
    }
  ): Promise<Record<string, any>[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.data_source) {
      conditions.push(`data_source = $${paramIndex++}`);
      params.push(options.data_source);
    }

    if (options?.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${escapeILIKE(options.search)}%`);
    }

    const query = `
      SELECT * FROM export_configurations
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_default DESC, name
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Update export configuration
   */
  async updateConfig(
    tenantId: string,
    configId: string,
    updates: Partial<ExportConfigInput>
  ): Promise<Record<string, any>> {
    const setClauses: string[] = [];
    const params: unknown[] = [configId, tenantId];
    let paramIndex = 3;

    const allowedFields = ['name', 'description', 'options', 'is_default'];

    for (const field of allowedFields) {
      if (updates[field as keyof ExportConfigInput] !== undefined) {
        const value = updates[field as keyof ExportConfigInput];
        setClauses.push(`${field} = $${paramIndex++}`);
        params.push(field === 'options' ? JSON.stringify(value) : value);
      }
    }

    if (setClauses.length === 0) {
      return this.getConfig(tenantId, configId);
    }

    setClauses.push('updated_at = NOW()');

    const query = `
      UPDATE export_configurations SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Delete export configuration
   */
  async deleteConfig(tenantId: string, configId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM export_configurations WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [configId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==========================================================================
  // Export Jobs
  // ==========================================================================

  /**
   * Create and start export job
   */
  async createExportJob(input: ExportJobInput): Promise<Record<string, any>> {
    const id = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const query = `
      INSERT INTO export_jobs (
        id, tenant_id, config_id, type, source_id,
        file_format, options, parameters, filters,
        status, expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      input.tenant_id,
      input.config_id || null,
      input.type,
      input.source_id || null,
      input.options.format,
      JSON.stringify(input.options),
      JSON.stringify(input.parameters || {}),
      JSON.stringify(input.filters || []),
      expiresAt,
      input.created_by,
    ];

    const result = await pool.query(query, values);
    const job = result.rows[0];

    // Start processing (in production, this would be queued)
    this.processExportJob(id, input).catch((err) => {
      logger.error(`Export job ${id} failed:`, err);
    });

    return job;
  }

  /**
   * Process export job
   */
  private async processExportJob(jobId: string, input: ExportJobInput): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to processing
      await pool.query(
        `UPDATE export_jobs SET status = 'processing', started_at = NOW() WHERE id = $1`,
        [jobId]
      );

      // Fetch data based on type
      let data: Record<string, any>[];

      switch (input.type) {
        case 'report':
          if (!input.source_id) {
            throw new Error('source_id (report_id) is required for report exports');
          }
          const reportResult = await reportBuilderService.executeReport(
            input.tenant_id,
            input.source_id,
            {
              parameters: input.parameters || {},
              page: 1,
              page_size: input.options.max_rows || 50000,
            }
          );
          data = reportResult.data;
          break;

        case 'table':
          data = await this.fetchTableData(input.tenant_id, input.source_id!, input.options);
          break;

        case 'dashboard':
          // Export all widgets data from a dashboard
          data = await this.fetchDashboardData(input.tenant_id, input.source_id!);
          break;

        case 'custom':
          // Custom data passed in parameters
          data = input.parameters?.data || [];
          break;

        default:
          throw new Error(`Unknown export type: ${input.type}`);
      }

      // Transform data
      const transformedData = this.transformData(data, input.options);

      // Generate export content
      const { content, fileExtension } = await this.generateExport(transformedData, input.options);

      // In production, would upload to object storage and get URL
      // For now, store metadata
      const filePath = `/exports/${jobId}.${fileExtension}`;
      const fileSize = Buffer.byteLength(content, 'utf8');

      // Update job as completed
      await pool.query(
        `
        UPDATE export_jobs SET
          status = 'completed',
          file_path = $1,
          file_size = $2,
          row_count = $3,
          completed_at = NOW()
        WHERE id = $4
      `,
        [filePath, fileSize, data.length, jobId]
      );

      logger.info(`Export job ${jobId} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await pool.query(
        `
        UPDATE export_jobs SET
          status = 'failed',
          error_message = $1,
          completed_at = NOW()
        WHERE id = $2
      `,
        [errorMessage, jobId]
      );

      throw error;
    }
  }

  /**
   * Fetch data from a table
   */
  private async fetchTableData(
    tenantId: string,
    tableName: string,
    options: ExportOptions
  ): Promise<Record<string, any>[]> {
    // Validate table name
    const allowedTables = new Set([
      'employees',
      'departments',
      'goals',
      'performance_reviews',
      'courses',
      'enrollments',
      'requisitions',
      'candidates',
      'check_ins',
    ]);

    if (!allowedTables.has(tableName)) {
      throw new Error(`Table '${tableName}' is not allowed for export`);
    }

    const maxRows = options.max_rows || 50000;

    const query = `
      SELECT * FROM ${tableName}
      WHERE tenant_id = $1
      LIMIT $2
    `;

    const result = await pool.query(query, [tenantId, maxRows]);
    return result.rows;
  }

  /**
   * Fetch dashboard data
   */
  private async fetchDashboardData(
    tenantId: string,
    dashboardId: string
  ): Promise<Record<string, any>[]> {
    const query = `
      SELECT dw.id, dw.config
      FROM dashboard_widgets dw
      WHERE dw.dashboard_id = $1 AND dw.tenant_id = $2
    `;

    const result = await pool.query(query, [dashboardId, tenantId]);
    return result.rows.map((w) => ({
      widget_id: w.id,
      config: w.config,
    }));
  }

  /**
   * Transform data based on column configs
   */
  private transformData(
    data: Record<string, any>[],
    options: ExportOptions
  ): Record<string, unknown>[] {
    if (!options.columns || options.columns.length === 0) {
      return data;
    }

    return data.map((row) => {
      const transformed: Record<string, any> = {};

      for (const col of options.columns!) {
        let value = row[col.field];

        // Apply transformations
        if (col.transform && value !== null && value !== undefined) {
          switch (col.transform) {
            case 'uppercase':
              value = String(value).toUpperCase();
              break;
            case 'lowercase':
              value = String(value).toLowerCase();
              break;
            case 'capitalize':
              value = String(value).charAt(0).toUpperCase() + String(value).slice(1);
              break;
            case 'date':
              if (col.date_format) {
                value = this.formatDate(value, col.date_format);
              }
              break;
            case 'currency':
              const symbol = col.currency_symbol || '$';
              value = `${symbol}${Number(value).toFixed(2)}`;
              break;
            case 'number':
              if (col.number_format) {
                value = this.formatNumber(value, col.number_format);
              }
              break;
            case 'boolean':
              value = value ? 'Yes' : 'No';
              break;
          }
        }

        transformed[col.header || col.field] = value;
      }

      return transformed;
    });
  }

  /**
   * Format date value
   */
  private formatDate(value: any, format: string): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    // Simple format replacements
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes);
  }

  /**
   * Format number value
   */
  private formatNumber(value: any, format: string): string {
    const num = Number(value);
    if (isNaN(num)) return String(value);

    if (format === 'integer') {
      return Math.round(num).toLocaleString();
    }

    const decimals = format.includes('.') ? (format.split('.')[1]?.length ?? 2) : 2;
    return num.toFixed(decimals);
  }

  /**
   * Generate export content in specified format
   */
  private async generateExport(
    data: Record<string, any>[],
    options: ExportOptions
  ): Promise<{ content: string; mimeType: string; fileExtension: string }> {
    switch (options.format) {
      case 'csv':
        return this.generateCSV(data, options);
      case 'json':
        return this.generateJSON(data, options);
      case 'xml':
        return this.generateXML(data, options);
      case 'excel':
        return this.generateExcelCSV(data, options); // Simplified - CSV with Excel-compatible encoding
      case 'pdf':
        return this.generatePDFText(data, options); // Simplified - would use PDF library in production
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Generate CSV export
   */
  private generateCSV(
    data: Record<string, any>[],
    options: ExportOptions
  ): { content: string; mimeType: string; fileExtension: string } {
    if (data.length === 0) {
      return { content: '', mimeType: 'text/csv', fileExtension: 'csv' };
    }

    const delimiter = options.delimiter || ',';
    const lines: string[] = [];

    // Headers
    if (options.include_headers !== false && data.length > 0) {
      const headers = Object.keys(data[0]!);
      lines.push(headers.map((h) => this.escapeCSV(h, delimiter)).join(delimiter));
    }

    // Data rows
    for (const row of data) {
      const values = Object.values(row).map((v) => this.escapeCSV(v, delimiter));
      lines.push(values.join(delimiter));
    }

    // Add metadata if requested
    if (options.include_timestamp) {
      lines.push('');
      lines.push(`Generated: ${new Date().toISOString()}`);
    }

    return {
      content: lines.join('\n'),
      mimeType: 'text/csv',
      fileExtension: 'csv',
    };
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: any, delimiter: string): string {
    if (value === null || value === undefined) return '';

    const str = String(value);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Generate JSON export
   */
  private generateJSON(
    data: Record<string, any>[],
    options: ExportOptions
  ): { content: string; mimeType: string; fileExtension: string } {
    const wrapper: Record<string, any> = {
      data,
      metadata: {
        row_count: data.length,
        generated_at: new Date().toISOString(),
      },
    };

    if (options.title) {
      wrapper.metadata.title = options.title;
    }

    const content = options.pretty_print
      ? JSON.stringify(wrapper, null, 2)
      : JSON.stringify(wrapper);

    return {
      content,
      mimeType: 'application/json',
      fileExtension: 'json',
    };
  }

  /**
   * Generate XML export
   */
  private generateXML(
    data: Record<string, any>[],
    options: ExportOptions
  ): { content: string; mimeType: string; fileExtension: string } {
    const rootElement = options.root_element || 'export';
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];

    lines.push(`<${rootElement}>`);

    if (options.title) {
      lines.push(`  <title>${this.escapeXML(options.title)}</title>`);
    }

    lines.push('  <records>');

    for (const row of data) {
      lines.push('    <record>');
      for (const [key, value] of Object.entries(row)) {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
        lines.push(`      <${safeKey}>${this.escapeXML(value)}</${safeKey}>`);
      }
      lines.push('    </record>');
    }

    lines.push('  </records>');

    if (options.include_timestamp) {
      lines.push(`  <generated_at>${new Date().toISOString()}</generated_at>`);
    }

    lines.push(`</${rootElement}>`);

    return {
      content: lines.join('\n'),
      mimeType: 'application/xml',
      fileExtension: 'xml',
    };
  }

  /**
   * Escape XML value
   */
  private escapeXML(value: unknown): string {
    if (value === null || value === undefined) return '';

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate Excel-compatible CSV
   */
  private generateExcelCSV(
    data: Record<string, any>[],
    options: ExportOptions
  ): { content: string; mimeType: string; fileExtension: string } {
    // Excel-compatible CSV with BOM for UTF-8
    const bom = '\uFEFF';
    const csv = this.generateCSV(data, { ...options, delimiter: ',' });

    return {
      content: bom + csv.content,
      mimeType: 'application/vnd.ms-excel',
      fileExtension: 'csv',
    };
  }

  /**
   * Generate PDF-like text (simplified)
   */
  private generatePDFText(
    data: Record<string, any>[],
    options: ExportOptions
  ): { content: string; mimeType: string; fileExtension: string } {
    // In production, would use a PDF library like pdfkit
    // For now, generate formatted text
    const lines: string[] = [];

    if (options.title) {
      lines.push('='.repeat(60));
      lines.push(options.title.toUpperCase());
      lines.push('='.repeat(60));
      lines.push('');
    }

    if (options.subtitle) {
      lines.push(options.subtitle);
      lines.push('');
    }

    // Table header
    if (data.length > 0) {
      const headers = Object.keys(data[0]!);
      lines.push(headers.join(' | '));
      lines.push('-'.repeat(60));

      // Data rows
      for (const row of data) {
        lines.push(
          Object.values(row)
            .map((v) => String(v ?? ''))
            .join(' | ')
        );
      }
    }

    lines.push('');
    lines.push('-'.repeat(60));
    lines.push(`Total Records: ${data.length}`);

    if (options.include_timestamp) {
      lines.push(`Generated: ${new Date().toISOString()}`);
    }

    if (options.footer) {
      lines.push('');
      lines.push(options.footer);
    }

    return {
      content: lines.join('\n'),
      mimeType: 'text/plain',
      fileExtension: 'txt',
    };
  }

  // ==========================================================================
  // Job Management
  // ==========================================================================

  /**
   * Get export job
   */
  async getJob(tenantId: string, jobId: string): Promise<Record<string, any>> {
    const query = `
      SELECT * FROM export_jobs
      WHERE id = $1 AND tenant_id = $2
    `;
    const result = await pool.query(query, [jobId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * List export jobs
   */
  async listJobs(
    tenantId: string,
    options?: {
      status?: ExportStatus;
      type?: string;
      user_id?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<{ jobs: Record<string, unknown>[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options?.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(options.type);
    }

    if (options?.user_id) {
      conditions.push(`created_by = $${paramIndex++}`);
      params.push(options.user_id);
    }

    const page = options?.page || 1;
    const pageSize = options?.page_size || 20;
    const offset = (page - 1) * pageSize;

    const countQuery = `SELECT COUNT(*) FROM export_jobs WHERE ${conditions.join(' AND ')}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT * FROM export_jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(pageSize, offset);

    const result = await pool.query(query, params);
    return { jobs: result.rows, total };
  }

  /**
   * Cancel export job
   */
  async cancelJob(tenantId: string, jobId: string): Promise<boolean> {
    const result = await pool.query(
      `
      UPDATE export_jobs
      SET status = 'failed', error_message = 'Cancelled by user', completed_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND status IN ('pending', 'processing')
      RETURNING id
    `,
      [jobId, tenantId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Clean up expired jobs
   */
  async cleanupExpiredJobs(): Promise<number> {
    const result = await pool.query(`
      UPDATE export_jobs
      SET status = 'expired'
      WHERE status = 'completed' AND expires_at < NOW()
      RETURNING id
    `);

    return result.rowCount ?? 0;
  }

  /**
   * Get export statistics
   */
  async getExportStats(tenantId: string): Promise<Record<string, any>> {
    const query = `
      SELECT
        COUNT(*) as total_exports,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'processing') as in_progress,
        SUM(file_size) FILTER (WHERE status = 'completed') as total_size_bytes,
        SUM(row_count) FILTER (WHERE status = 'completed') as total_rows_exported
      FROM export_jobs
      WHERE tenant_id = $1
    `;

    const result = await pool.query(query, [tenantId]);
    return result.rows[0];
  }
}

// Export singleton instance
export const dataExportService = new DataExportService();
