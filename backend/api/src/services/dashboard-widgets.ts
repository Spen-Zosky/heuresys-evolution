/**
 * Dashboard Widget Framework Service
 * Epic 7 - Story 7.2: Dashboard Widget Framework
 *
 * Features:
 * - Dashboard CRUD with user ownership
 * - Widget management with configurable layouts
 * - Widget templates (system and custom)
 * - Dashboard sharing and permissions
 * - Widget data fetching from various sources
 */

import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { reportBuilderService } from './report-builder.js';
import { validateTableName, validateIdentifier, escapeILIKE } from '../utils/sql-safety.js';
import { logger } from '../config/logger.js';

// ============================================================================
// Types
// ============================================================================

export type WidgetType =
  | 'kpi'
  | 'chart'
  | 'table'
  | 'metric'
  | 'list'
  | 'gauge'
  | 'heatmap'
  | 'funnel';
export type ChartType = 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'scatter' | 'radar' | 'treemap';

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetConfig {
  title: string;
  type: WidgetType;
  chart_type?: ChartType;
  data_source: 'report' | 'query' | 'api' | 'static';
  report_id?: string;
  query?: {
    table: string;
    fields: string[];
    filters?: any[];
    group_by?: string[];
    aggregate?: { field: string; function: string }[];
  };
  api_endpoint?: string;
  static_data?: any;
  refresh_interval?: number; // seconds, 0 = no auto-refresh
  visualization?: {
    colors?: string[];
    show_legend?: boolean;
    show_labels?: boolean;
    value_format?: string;
    comparison?: {
      enabled: boolean;
      type: 'previous_period' | 'target' | 'benchmark';
      target_value?: number;
    };
  };
  thresholds?: {
    warning?: number;
    critical?: number;
    success?: number;
  };
  drill_down?: {
    enabled: boolean;
    dashboard_id?: string;
    report_id?: string;
  };
}

export interface DashboardInput {
  tenant_id: string;
  name: string;
  description?: string;
  layout_type?: 'grid' | 'free' | 'fixed';
  is_default?: boolean;
  is_shared?: boolean;
  shared_with?: string[];
  created_by: string;
}

export interface WidgetInput {
  dashboard_id: string;
  tenant_id: string;
  template_id?: string;
  config: WidgetConfig;
  position: WidgetPosition;
  created_by: string;
}

// ============================================================================
// Dashboard Service
// ============================================================================

export class DashboardWidgetService {
  // ==========================================================================
  // Dashboard CRUD
  // ==========================================================================

  /**
   * Create a new dashboard
   */
  async createDashboard(input: DashboardInput): Promise<Record<string, any> | null> {
    const id = uuidv4();

    // If setting as default, unset other defaults for user
    if (input.is_default) {
      await pool.query(
        `UPDATE dashboards SET is_default = false WHERE tenant_id = $1 AND created_by = $2`,
        [input.tenant_id, input.created_by]
      );
    }

    const query = `
      INSERT INTO dashboards (
        id, tenant_id, name, description, layout_type,
        is_default, is_shared, shared_with, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      id,
      input.tenant_id,
      input.name,
      input.description || null,
      input.layout_type || 'grid',
      input.is_default || false,
      input.is_shared || false,
      JSON.stringify(input.shared_with || []),
      input.created_by,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(
    tenantId: string,
    dashboardId: string,
    userId?: string
  ): Promise<Record<string, any> | null> {
    const query = `
      SELECT d.*,
        (SELECT COUNT(*) FROM dashboard_widgets WHERE dashboard_id = d.id) as widget_count
      FROM dashboards d
      WHERE d.id = $1 AND d.tenant_id = $2
        AND (d.is_shared = true OR d.created_by = $3 OR $3 = ANY(d.shared_with::text[]))
    `;

    const result = await pool.query(query, [dashboardId, tenantId, userId || '']);
    return result.rows[0] || null;
  }

  /**
   * List dashboards for a user
   */
  async listDashboards(
    tenantId: string,
    userId: string,
    options?: {
      include_public?: boolean;
      search?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<{ dashboards: any[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    // User can see: own dashboards, public dashboards, shared dashboards
    const accessCondition = `(created_by = $${paramIndex} OR is_shared = true OR $${paramIndex} = ANY(shared_with::text[]))`;
    conditions.push(accessCondition);
    params.push(userId);
    paramIndex++;

    if (options?.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${escapeILIKE(options.search)}%`);
      paramIndex++;
    }

    const page = options?.page || 1;
    const pageSize = options?.page_size || 20;
    const offset = (page - 1) * pageSize;

    // Count
    const countQuery = `SELECT COUNT(*) FROM dashboards WHERE ${conditions.join(' AND ')}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // List
    const query = `
      SELECT d.*,
        (SELECT COUNT(*) FROM dashboard_widgets WHERE dashboard_id = d.id) as widget_count
      FROM dashboards d
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.is_default DESC, d.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(pageSize, offset);

    const result = await pool.query(query, params);
    return { dashboards: result.rows, total };
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    tenantId: string,
    dashboardId: string,
    userId: string,
    updates: Partial<DashboardInput>
  ): Promise<Record<string, any> | null> {
    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM dashboards WHERE id = $1 AND tenant_id = $2 AND created_by = $3',
      [dashboardId, tenantId, userId]
    );

    if (existing.rows.length === 0) {
      return null;
    }

    // If setting as default, unset others
    if (updates.is_default) {
      await pool.query(
        `UPDATE dashboards SET is_default = false WHERE tenant_id = $1 AND created_by = $2 AND id != $3`,
        [tenantId, userId, dashboardId]
      );
    }

    const setClauses: string[] = [];
    const params: unknown[] = [dashboardId, tenantId];
    let paramIndex = 3;

    const allowedFields = [
      'name',
      'description',
      'layout_type',
      'is_default',
      'is_shared',
      'shared_with',
    ];

    for (const field of allowedFields) {
      if (updates[field as keyof DashboardInput] !== undefined) {
        const value = updates[field as keyof DashboardInput];
        setClauses.push(`${field} = $${paramIndex++}`);
        params.push(field === 'shared_with' ? JSON.stringify(value) : value);
      }
    }

    if (setClauses.length === 0) {
      return this.getDashboard(tenantId, dashboardId, userId);
    }

    setClauses.push('updated_at = NOW()');

    const query = `
      UPDATE dashboards SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(tenantId: string, dashboardId: string, userId: string): Promise<boolean> {
    // Delete widgets first
    await pool.query('DELETE FROM dashboard_widgets WHERE dashboard_id = $1 AND tenant_id = $2', [
      dashboardId,
      tenantId,
    ]);

    const result = await pool.query(
      'DELETE FROM dashboards WHERE id = $1 AND tenant_id = $2 AND created_by = $3 RETURNING id',
      [dashboardId, tenantId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Duplicate dashboard
   */
  async duplicateDashboard(
    tenantId: string,
    dashboardId: string,
    userId: string,
    newName: string
  ): Promise<Record<string, any> | null> {
    const original = await this.getDashboard(tenantId, dashboardId, userId);
    if (!original) {
      throw new Error('Dashboard not found');
    }

    // Create new dashboard
    const newDashboard = await this.createDashboard({
      tenant_id: tenantId,
      name: newName,
      description: `Copy of ${original.name}`,
      layout_type: original.layout_type,
      is_default: false,
      is_shared: false,
      created_by: userId,
    });
    if (!newDashboard) {
      throw new Error('Failed to create dashboard copy');
    }

    // Copy widgets
    const widgets = await this.getWidgets(tenantId, dashboardId);
    for (const widget of widgets) {
      await this.addWidget({
        dashboard_id: newDashboard.id,
        tenant_id: tenantId,
        template_id: widget.template_id,
        config: widget.config,
        position: widget.position,
        created_by: userId,
      });
    }

    return newDashboard;
  }

  // ==========================================================================
  // Widget CRUD
  // ==========================================================================

  /**
   * Add widget to dashboard
   */
  async addWidget(input: WidgetInput): Promise<Record<string, any> | null> {
    const id = uuidv4();

    const query = `
      INSERT INTO dashboard_widgets (
        id, dashboard_id, tenant_id, template_id, config, position, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id,
      input.dashboard_id,
      input.tenant_id,
      input.template_id || null,
      JSON.stringify(input.config),
      JSON.stringify(input.position),
      input.created_by,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get widgets for a dashboard
   */
  async getWidgets(tenantId: string, dashboardId: string): Promise<Record<string, any>[]> {
    const query = `
      SELECT dw.*, wt.name as template_name, wt.category as template_category
      FROM dashboard_widgets dw
      LEFT JOIN widget_templates wt ON dw.template_id = wt.id
      WHERE dw.dashboard_id = $1 AND dw.tenant_id = $2
      ORDER BY (dw.position->>'y')::int, (dw.position->>'x')::int
    `;

    const result = await pool.query(query, [dashboardId, tenantId]);
    return result.rows;
  }

  /**
   * Update widget
   */
  async updateWidget(
    tenantId: string,
    widgetId: string,
    updates: { config?: WidgetConfig; position?: WidgetPosition }
  ): Promise<Record<string, any> | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [widgetId, tenantId];
    let paramIndex = 3;

    if (updates.config) {
      setClauses.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(updates.config));
    }

    if (updates.position) {
      setClauses.push(`position = $${paramIndex++}`);
      params.push(JSON.stringify(updates.position));
    }

    if (setClauses.length === 0) {
      return null;
    }

    setClauses.push('updated_at = NOW()');

    const query = `
      UPDATE dashboard_widgets SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Update multiple widget positions (for drag/drop)
   */
  async updateWidgetPositions(
    tenantId: string,
    dashboardId: string,
    positions: { widget_id: string; position: WidgetPosition }[]
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of positions) {
        await client.query(
          `UPDATE dashboard_widgets SET position = $1, updated_at = NOW()
           WHERE id = $2 AND dashboard_id = $3 AND tenant_id = $4`,
          [JSON.stringify(item.position), item.widget_id, dashboardId, tenantId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete widget
   */
  async deleteWidget(tenantId: string, widgetId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM dashboard_widgets WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [widgetId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==========================================================================
  // Widget Templates
  // ==========================================================================

  /**
   * Get widget templates
   */
  async getWidgetTemplates(
    tenantId: string,
    options?: {
      category?: string;
      type?: WidgetType;
      include_system?: boolean;
    }
  ): Promise<Record<string, any>[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // System templates OR tenant-specific
    if (options?.include_system !== false) {
      conditions.push(`(is_system = true OR tenant_id = $${paramIndex})`);
    } else {
      conditions.push(`tenant_id = $${paramIndex}`);
    }
    params.push(tenantId);
    paramIndex++;

    if (options?.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(options.category);
    }

    if (options?.type) {
      conditions.push(`default_config->>'type' = $${paramIndex++}`);
      params.push(options.type);
    }

    const query = `
      SELECT * FROM widget_templates
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_system DESC, category, name
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create custom widget template
   */
  async createWidgetTemplate(
    tenantId: string,
    input: {
      name: string;
      description?: string;
      category: string;
      default_config: WidgetConfig;
      created_by: string;
    }
  ): Promise<Record<string, any> | null> {
    const id = uuidv4();

    const query = `
      INSERT INTO widget_templates (
        id, tenant_id, name, description, category, default_config, is_system, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, false, $7)
      RETURNING *
    `;

    const values = [
      id,
      tenantId,
      input.name,
      input.description || null,
      input.category,
      JSON.stringify(input.default_config),
      input.created_by,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // ==========================================================================
  // Widget Data Fetching
  // ==========================================================================

  /**
   * Fetch data for a widget
   */
  async fetchWidgetData(tenantId: string, widget: any): Promise<Record<string, any> | null> {
    const config = widget.config as WidgetConfig;

    switch (config.data_source) {
      case 'report':
        return this.fetchReportData(tenantId, config.report_id!);

      case 'query':
        return this.fetchQueryData(tenantId, config.query!);

      case 'static':
        return config.static_data || {};

      case 'api':
        // API data would be fetched client-side
        return { api_endpoint: config.api_endpoint };

      default:
        throw new Error(`Unknown data source: ${config.data_source}`);
    }
  }

  /**
   * Fetch data from a saved report
   */
  private async fetchReportData(
    tenantId: string,
    reportId: string
  ): Promise<Record<string, any> | null> {
    try {
      const result = await reportBuilderService.executeReport(tenantId, reportId, {
        page: 1,
        page_size: 1000, // Widget data limit
      });
      return {
        data: result.data,
        metadata: result.metadata,
      };
    } catch (error) {
      logger.error({ err: error }, 'Error fetching report data:');
      return { error: 'Failed to fetch report data', data: [] };
    }
  }

  /**
   * Fetch data from a custom query
   */
  private async fetchQueryData(
    tenantId: string,
    queryConfig: WidgetConfig['query']
  ): Promise<Record<string, any> | null> {
    if (!queryConfig) {
      return { data: [] };
    }

    // Validate table name against centralized allowlist
    const validatedTable = validateTableName(queryConfig.table, 'DashboardWidget.fetchQueryData');

    // Build simple query - validate all field identifiers
    const fields = queryConfig.fields.map((f) => {
      return validateIdentifier(
        f.replace(/[^a-zA-Z0-9_]/g, ''),
        'DashboardWidget.fetchQueryData.fields'
      );
    });

    let selectClause: string;
    if (queryConfig.aggregate && queryConfig.aggregate.length > 0) {
      const aggFields = queryConfig.aggregate.map((a) => {
        const field = validateIdentifier(
          a.field.replace(/[^a-zA-Z0-9_]/g, ''),
          'DashboardWidget.fetchQueryData.aggregate.field'
        );
        const func = a.function.toUpperCase();
        if (!['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(func)) {
          throw new Error('Invalid aggregate function');
        }
        return `${func}(${field}) as ${field}_${func.toLowerCase()}`;
      });
      const groupFields =
        queryConfig.group_by?.map((f) =>
          validateIdentifier(
            f.replace(/[^a-zA-Z0-9_]/g, ''),
            'DashboardWidget.fetchQueryData.group_by'
          )
        ) || [];
      selectClause = [...groupFields, ...aggFields].join(', ');
    } else {
      selectClause = fields.join(', ');
    }

    let query = `SELECT ${selectClause} FROM ${validatedTable} WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    // Add group by
    if (queryConfig.group_by && queryConfig.group_by.length > 0) {
      const groupBy = queryConfig.group_by
        .map((f) =>
          validateIdentifier(
            f.replace(/[^a-zA-Z0-9_]/g, ''),
            'DashboardWidget.fetchQueryData.group_by'
          )
        )
        .join(', ');
      query += ` GROUP BY ${groupBy}`;
    }

    query += ' LIMIT 1000';

    const result = await pool.query(query, params);
    return { data: result.rows };
  }

  /**
   * Fetch data for all widgets in a dashboard
   */
  async fetchDashboardData(tenantId: string, dashboardId: string): Promise<Map<string, any>> {
    const widgets = await this.getWidgets(tenantId, dashboardId);
    const dataMap = new Map<string, any>();

    await Promise.all(
      widgets.map(async (widget) => {
        try {
          const data = await this.fetchWidgetData(tenantId, widget);
          dataMap.set(widget.id, data);
        } catch (error) {
          logger.error(`Error fetching data for widget ${widget.id}:${error}`);
          dataMap.set(widget.id, { error: 'Failed to fetch data' });
        }
      })
    );

    return dataMap;
  }

  // ==========================================================================
  // Dashboard Analytics
  // ==========================================================================

  /**
   * Get popular widgets
   */
  async getPopularWidgets(tenantId: string, limit: number = 10): Promise<Record<string, any>[]> {
    const query = `
      SELECT
        template_id,
        wt.name as template_name,
        wt.category,
        COUNT(*) as usage_count
      FROM dashboard_widgets dw
      JOIN widget_templates wt ON dw.template_id = wt.id
      WHERE dw.tenant_id = $1 AND dw.template_id IS NOT NULL
      GROUP BY template_id, wt.name, wt.category
      ORDER BY usage_count DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [tenantId, limit]);
    return result.rows;
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: string, userId?: string): Promise<Record<string, any> | null> {
    const query = `
      SELECT
        COUNT(*) as total_dashboards,
        COUNT(*) FILTER (WHERE is_shared = true) as public_dashboards,
        COUNT(*) FILTER (WHERE is_default = true) as default_dashboards
      FROM dashboards
      WHERE tenant_id = $1 ${userId ? 'AND created_by = $2' : ''}
    `;

    const params = userId ? [tenantId, userId] : [tenantId];
    const result = await pool.query(query, params);

    // Widget stats
    const widgetQuery = `
      SELECT COUNT(*) as total_widgets
      FROM dashboard_widgets
      WHERE tenant_id = $1
    `;
    const widgetResult = await pool.query(widgetQuery, [tenantId]);

    return {
      ...result.rows[0],
      ...widgetResult.rows[0],
    };
  }
}

// Export singleton instance
export const dashboardWidgetService = new DashboardWidgetService();
