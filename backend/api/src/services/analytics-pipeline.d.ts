/**
 * Real-time Analytics Pipeline Service
 * Epic 7 - Story 7.5: Real-time Analytics Pipeline
 *
 * Features:
 * - Event tracking and ingestion
 * - Real-time metrics calculation
 * - Pre-computed aggregations
 * - Time-series data storage
 * - Dashboard metrics streaming
 */
export type EventCategory = 'user_action' | 'system' | 'performance' | 'hr' | 'recruitment' | 'learning';
export type AggregationPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';
export interface AnalyticsEvent {
    tenant_id: string;
    event_type: string;
    category: EventCategory;
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    session_id?: string;
    data?: Record<string, any>;
    metrics?: Record<string, number>;
    timestamp?: Date;
}
export interface AggregationConfig {
    name: string;
    entity_type: string;
    metric_name: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    period: AggregationPeriod;
    dimensions?: string[];
    filter?: Record<string, any>;
}
export interface MetricQuery {
    metric_name: string;
    entity_type?: string;
    dimensions?: Record<string, string>;
    period: AggregationPeriod;
    start_date: Date;
    end_date: Date;
    compare_previous?: boolean;
}
export interface TimeSeriesPoint {
    timestamp: Date;
    value: number;
    dimensions?: Record<string, string>;
}
export declare class AnalyticsPipelineService {
    /**
     * Track a single analytics event
     */
    trackEvent(event: AnalyticsEvent): Promise<string>;
    /**
     * Track multiple events in batch
     */
    trackEvents(events: AnalyticsEvent[]): Promise<string[]>;
    /**
     * Update real-time aggregations based on event
     */
    private updateRealtimeAggregations;
    /**
     * Get period start time
     */
    private getPeriodStart;
    /**
     * Get time series data for a metric
     */
    getTimeSeries(tenantId: string, query: MetricQuery): Promise<TimeSeriesPoint[]>;
    /**
     * Get current metric value with comparison
     */
    getCurrentMetric(tenantId: string, metricName: string, entityType: string, period: AggregationPeriod): Promise<{
        current: number;
        previous: number;
        change: number;
        changePercent: number;
    }>;
    /**
     * Get previous period start
     */
    private getPreviousPeriodStart;
    /**
     * Get HR dashboard metrics
     */
    getHRDashboardMetrics(tenantId: string): Promise<Record<string, any>>;
    /**
     * Get performance dashboard metrics
     */
    getPerformanceDashboardMetrics(tenantId: string): Promise<Record<string, any>>;
    /**
     * Get recruitment dashboard metrics
     */
    getRecruitmentDashboardMetrics(tenantId: string): Promise<Record<string, any>>;
    /**
     * Get learning dashboard metrics
     */
    getLearningDashboardMetrics(tenantId: string): Promise<Record<string, any>>;
    /**
     * Get recent events
     */
    getRecentEvents(tenantId: string, options?: {
        category?: EventCategory;
        event_type?: string;
        entity_type?: string;
        limit?: number;
    }): Promise<Record<string, any>[]>;
    /**
     * Get event counts by category
     */
    getEventCountsByCategory(tenantId: string, startDate: Date, endDate: Date): Promise<Record<string, any>[]>;
    /**
     * Compute aggregations for a specific period
     */
    computeAggregations(tenantId: string, period: AggregationPeriod, date: Date): Promise<void>;
    /**
     * Get aggregation statistics
     */
    getAggregationStats(tenantId: string): Promise<Record<string, any>>;
    /**
     * Get headcount trend for the last 12 months
     * Returns monthly data with headcount, hires, and attrition
     */
    getHeadcountTrend(tenantId: string): Promise<Record<string, any>[]>;
    /**
     * Get aggregated skill gap summary from skill_gap_analyses table
     * Extracts skill gaps from JSONB and aggregates by skill name
     */
    getSkillGapSummary(tenantId: string): Promise<Record<string, any>[]>;
    /**
     * Get monthly turnover summary with voluntary/involuntary breakdown
     * Returns last 12 months of turnover data for charts
     */
    getTurnoverSummary(tenantId: string): Promise<{
        monthlyData: Array<{
            month: string;
            voluntary: number;
            involuntary: number;
            total: number;
        }>;
        currentRate: number;
        industryBenchmark: number;
    }>;
}
export declare const analyticsPipelineService: AnalyticsPipelineService;
//# sourceMappingURL=analytics-pipeline.d.ts.map