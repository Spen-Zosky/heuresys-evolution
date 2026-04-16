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
export type WidgetType = 'kpi' | 'chart' | 'table' | 'metric' | 'list' | 'gauge' | 'heatmap' | 'funnel';
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
        aggregate?: {
            field: string;
            function: string;
        }[];
    };
    api_endpoint?: string;
    static_data?: any;
    refresh_interval?: number;
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
export declare class DashboardWidgetService {
    /**
     * Create a new dashboard
     */
    createDashboard(input: DashboardInput): Promise<Record<string, any> | null>;
    /**
     * Get dashboard by ID
     */
    getDashboard(tenantId: string, dashboardId: string, userId?: string): Promise<Record<string, any> | null>;
    /**
     * List dashboards for a user
     */
    listDashboards(tenantId: string, userId: string, options?: {
        include_public?: boolean;
        search?: string;
        page?: number;
        page_size?: number;
    }): Promise<{
        dashboards: any[];
        total: number;
    }>;
    /**
     * Update dashboard
     */
    updateDashboard(tenantId: string, dashboardId: string, userId: string, updates: Partial<DashboardInput>): Promise<Record<string, any> | null>;
    /**
     * Delete dashboard
     */
    deleteDashboard(tenantId: string, dashboardId: string, userId: string): Promise<boolean>;
    /**
     * Duplicate dashboard
     */
    duplicateDashboard(tenantId: string, dashboardId: string, userId: string, newName: string): Promise<Record<string, any> | null>;
    /**
     * Add widget to dashboard
     */
    addWidget(input: WidgetInput): Promise<Record<string, any> | null>;
    /**
     * Get widgets for a dashboard
     */
    getWidgets(tenantId: string, dashboardId: string): Promise<Record<string, any>[]>;
    /**
     * Update widget
     */
    updateWidget(tenantId: string, widgetId: string, updates: {
        config?: WidgetConfig;
        position?: WidgetPosition;
    }): Promise<Record<string, any> | null>;
    /**
     * Update multiple widget positions (for drag/drop)
     */
    updateWidgetPositions(tenantId: string, dashboardId: string, positions: {
        widget_id: string;
        position: WidgetPosition;
    }[]): Promise<void>;
    /**
     * Delete widget
     */
    deleteWidget(tenantId: string, widgetId: string): Promise<boolean>;
    /**
     * Get widget templates
     */
    getWidgetTemplates(tenantId: string, options?: {
        category?: string;
        type?: WidgetType;
        include_system?: boolean;
    }): Promise<Record<string, any>[]>;
    /**
     * Create custom widget template
     */
    createWidgetTemplate(tenantId: string, input: {
        name: string;
        description?: string;
        category: string;
        default_config: WidgetConfig;
        created_by: string;
    }): Promise<Record<string, any> | null>;
    /**
     * Fetch data for a widget
     */
    fetchWidgetData(tenantId: string, widget: any): Promise<Record<string, any> | null>;
    /**
     * Fetch data from a saved report
     */
    private fetchReportData;
    /**
     * Fetch data from a custom query
     */
    private fetchQueryData;
    /**
     * Fetch data for all widgets in a dashboard
     */
    fetchDashboardData(tenantId: string, dashboardId: string): Promise<Map<string, any>>;
    /**
     * Get popular widgets
     */
    getPopularWidgets(tenantId: string, limit?: number): Promise<Record<string, any>[]>;
    /**
     * Get dashboard statistics
     */
    getDashboardStats(tenantId: string, userId?: string): Promise<Record<string, any> | null>;
}
export declare const dashboardWidgetService: DashboardWidgetService;
//# sourceMappingURL=dashboard-widgets.d.ts.map