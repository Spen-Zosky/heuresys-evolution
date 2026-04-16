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
import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
// ============================================================================
// Analytics Pipeline Service
// ============================================================================
export class AnalyticsPipelineService {
    // ==========================================================================
    // Event Ingestion
    // ==========================================================================
    /**
     * Track a single analytics event
     */
    async trackEvent(event) {
        const id = uuidv4();
        const timestamp = event.timestamp || new Date();
        const query = `
      INSERT INTO analytics_events (
        id, tenant_id, event_type, category, entity_type, entity_id,
        user_id, session_id, data, metrics, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;
        const values = [
            id,
            event.tenant_id,
            event.event_type,
            event.category,
            event.entity_type || null,
            event.entity_id || null,
            event.user_id || null,
            event.session_id || null,
            JSON.stringify(event.data || {}),
            JSON.stringify(event.metrics || {}),
            timestamp,
        ];
        await pool.query(query, values);
        // Trigger real-time aggregation updates
        this.updateRealtimeAggregations(event).catch((err) => {
            logger.error({ err: err }, 'Failed to update real-time aggregations:');
        });
        return id;
    }
    /**
     * Track multiple events in batch
     */
    async trackEvents(events) {
        const ids = [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const event of events) {
                const id = uuidv4();
                ids.push(id);
                await client.query(`
          INSERT INTO analytics_events (
            id, tenant_id, event_type, category, entity_type, entity_id,
            user_id, session_id, data, metrics, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
                    id,
                    event.tenant_id,
                    event.event_type,
                    event.category,
                    event.entity_type || null,
                    event.entity_id || null,
                    event.user_id || null,
                    event.session_id || null,
                    JSON.stringify(event.data || {}),
                    JSON.stringify(event.metrics || {}),
                    event.timestamp || new Date(),
                ]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        return ids;
    }
    // ==========================================================================
    // Real-time Aggregations
    // ==========================================================================
    /**
     * Update real-time aggregations based on event
     */
    async updateRealtimeAggregations(event) {
        const now = new Date();
        const periods = ['hourly', 'daily'];
        for (const period of periods) {
            const periodStart = this.getPeriodStart(now, period);
            await pool.query(`
        INSERT INTO analytics_aggregations (
          id, tenant_id, metric_name, dimension, dimension_value, period_type, period_start,
          metadata, value_sum, value_count, computed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 1, 1, NOW()
        )
        ON CONFLICT (tenant_id, metric_name, dimension, dimension_value, period_type, period_start)
        DO UPDATE SET
          value_sum = analytics_aggregations.value_sum + 1,
          value_count = analytics_aggregations.value_count + 1,
          computed_at = NOW()
      `, [
                uuidv4(),
                event.tenant_id,
                `${event.category}_${event.event_type}`,
                event.entity_type || 'general',
                event.category,
                period,
                periodStart,
                JSON.stringify({ category: event.category }),
            ]);
        }
    }
    /**
     * Get period start time
     */
    getPeriodStart(date, period) {
        const start = new Date(date);
        switch (period) {
            case 'hourly':
                start.setMinutes(0, 0, 0);
                break;
            case 'daily':
                start.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                const day = start.getDay();
                start.setDate(start.getDate() - day);
                start.setHours(0, 0, 0, 0);
                break;
            case 'monthly':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                break;
        }
        return start;
    }
    // ==========================================================================
    // Metric Queries
    // ==========================================================================
    /**
     * Get time series data for a metric
     */
    async getTimeSeries(tenantId, query) {
        const conditions = [
            'tenant_id = $1',
            'metric_name = $2',
            'period_type = $3',
            'period_start >= $4',
            'period_start <= $5',
        ];
        const params = [
            tenantId,
            query.metric_name,
            query.period,
            query.start_date,
            query.end_date,
        ];
        let paramIndex = 6;
        if (query.entity_type) {
            conditions.push(`dimension = $${paramIndex++}`);
            params.push(query.entity_type);
        }
        if (query.dimensions) {
            for (const [key, value] of Object.entries(query.dimensions)) {
                conditions.push(`metadata->>'${key}' = $${paramIndex++}`);
                params.push(value);
            }
        }
        const result = await pool.query(`
      SELECT period_start as timestamp, value_sum, metadata
      FROM analytics_aggregations
      WHERE ${conditions.join(' AND ')}
      ORDER BY period_start
    `, params);
        return result.rows.map((row) => ({
            timestamp: row.timestamp,
            value: parseFloat(row.value_sum),
            dimensions: row.metadata,
        }));
    }
    /**
     * Get current metric value with comparison
     */
    async getCurrentMetric(tenantId, metricName, entityType, period) {
        const now = new Date();
        const currentPeriodStart = this.getPeriodStart(now, period);
        const previousPeriodStart = this.getPreviousPeriodStart(currentPeriodStart, period);
        // Current period
        const currentResult = await pool.query(`
      SELECT COALESCE(SUM(value_sum), 0) as value
      FROM analytics_aggregations
      WHERE tenant_id = $1 AND metric_name = $2 AND dimension = $3
        AND period_type = $4 AND period_start = $5
    `, [tenantId, metricName, entityType, period, currentPeriodStart]);
        // Previous period
        const previousResult = await pool.query(`
      SELECT COALESCE(SUM(value_sum), 0) as value
      FROM analytics_aggregations
      WHERE tenant_id = $1 AND metric_name = $2 AND dimension = $3
        AND period_type = $4 AND period_start = $5
    `, [tenantId, metricName, entityType, period, previousPeriodStart]);
        const current = parseFloat(currentResult.rows[0].value);
        const previous = parseFloat(previousResult.rows[0].value);
        const change = current - previous;
        const changePercent = previous > 0 ? (change / previous) * 100 : 0;
        return { current, previous, change, changePercent };
    }
    /**
     * Get previous period start
     */
    getPreviousPeriodStart(currentStart, period) {
        const previous = new Date(currentStart);
        switch (period) {
            case 'hourly':
                previous.setHours(previous.getHours() - 1);
                break;
            case 'daily':
                previous.setDate(previous.getDate() - 1);
                break;
            case 'weekly':
                previous.setDate(previous.getDate() - 7);
                break;
            case 'monthly':
                previous.setMonth(previous.getMonth() - 1);
                break;
        }
        return previous;
    }
    // ==========================================================================
    // Dashboard Metrics
    // ==========================================================================
    /**
     * Get HR dashboard metrics
     */
    async getHRDashboardMetrics(tenantId) {
        // Headcount
        const headcountResult = await pool.query(`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE hire_date > NOW() - INTERVAL '30 days') as new_hires,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 days' AND is_active = false) as terminations
      FROM employees WHERE tenant_id = $1
    `, [tenantId]);
        // OrgUnit distribution
        const deptResult = await pool.query(`
      SELECT d.name, COUNT(e.id) as count
      FROM employees e
      JOIN org_units d ON e.org_unit_id = d.id
      WHERE e.tenant_id = $1 AND e.is_active = true
      GROUP BY d.name
      ORDER BY count DESC
      LIMIT 10
    `, [tenantId]);
        // Tenure distribution
        const tenureResult = await pool.query(`
      WITH tenure_bands AS (
        SELECT
          CASE
            WHEN EXTRACT(YEAR FROM AGE(NOW(), hire_date)) < 1 THEN '< 1 year'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), hire_date)) < 3 THEN '1-3 years'
            WHEN EXTRACT(YEAR FROM AGE(NOW(), hire_date)) < 5 THEN '3-5 years'
            ELSE '5+ years'
          END as tenure_band,
          CASE
            WHEN EXTRACT(YEAR FROM AGE(NOW(), hire_date)) < 1 THEN 1
            WHEN EXTRACT(YEAR FROM AGE(NOW(), hire_date)) < 3 THEN 2
            WHEN EXTRACT(YEAR FROM AGE(NOW(), hire_date)) < 5 THEN 3
            ELSE 4
          END as sort_order
        FROM employees
        WHERE tenant_id = $1 AND is_active = true AND hire_date IS NOT NULL
      )
      SELECT tenure_band, COUNT(*) as count
      FROM tenure_bands
      GROUP BY tenure_band, sort_order
      ORDER BY sort_order
    `, [tenantId]);
        return {
            headcount: headcountResult.rows[0],
            department_distribution: deptResult.rows,
            tenure_distribution: tenureResult.rows,
            generated_at: new Date().toISOString(),
        };
    }
    /**
     * Get performance dashboard metrics
     */
    async getPerformanceDashboardMetrics(tenantId) {
        // Goals overview
        const goalsResult = await pool.query(`
      SELECT
        COUNT(*) as total_goals,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'not_started') as not_started,
        ROUND(AVG(progress_percent), 2) as avg_progress
      FROM goals
      WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    `, [tenantId]);
        // Review completion
        const reviewsResult = await pool.query(`
      SELECT
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        ROUND(AVG(overall_rating), 2) as avg_rating
      FROM performance_reviews
      WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    `, [tenantId]);
        // Check-in frequency
        const checkInsResult = await pool.query(`
      SELECT
        DATE_TRUNC('week', scheduled_date) as week,
        COUNT(*) as count
      FROM check_ins
      WHERE tenant_id = $1 AND scheduled_date > NOW() - INTERVAL '12 weeks'
      GROUP BY week
      ORDER BY week
    `, [tenantId]);
        return {
            goals: goalsResult.rows[0],
            reviews: reviewsResult.rows[0],
            check_ins_trend: checkInsResult.rows,
            generated_at: new Date().toISOString(),
        };
    }
    /**
     * Get recruitment dashboard metrics
     */
    async getRecruitmentDashboardMetrics(tenantId) {
        // Pipeline overview
        const pipelineResult = await pool.query(`
      SELECT
        COUNT(*) as total_candidates,
        COUNT(*) FILTER (WHERE stage = 'new') as new,
        COUNT(*) FILTER (WHERE stage = 'screening') as screening,
        COUNT(*) FILTER (WHERE stage = 'interview') as interview,
        COUNT(*) FILTER (WHERE stage = 'offer') as offer,
        COUNT(*) FILTER (WHERE stage = 'hired') as hired,
        COUNT(*) FILTER (WHERE stage = 'rejected') as rejected
      FROM recruiting_candidates
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '90 days'
    `, [tenantId]);
        // Open requisitions
        const requisitionsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        ROUND(AVG(EXTRACT(DAY FROM NOW() - created_at))) as avg_days_open
      FROM recruiting_requisitions
      WHERE tenant_id = $1 AND status IN ('open', 'in_progress')
    `, [tenantId]);
        // Source effectiveness
        const sourceResult = await pool.query(`
      SELECT
        source,
        COUNT(*) as candidates,
        COUNT(*) FILTER (WHERE stage = 'hired') as hired
      FROM recruiting_candidates
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '180 days'
      GROUP BY source
      ORDER BY candidates DESC
      LIMIT 5
    `, [tenantId]);
        return {
            pipeline: pipelineResult.rows[0],
            requisitions: requisitionsResult.rows[0],
            source_effectiveness: sourceResult.rows,
            generated_at: new Date().toISOString(),
        };
    }
    /**
     * Get learning dashboard metrics
     */
    async getLearningDashboardMetrics(tenantId) {
        // Enrollment overview
        const enrollmentResult = await pool.query(`
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(*) FILTER (WHERE ce.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE ce.status = 'in_progress') as in_progress,
        ROUND(AVG(ce.progress_percent), 2) as avg_progress
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      WHERE c.tenant_id = $1 AND EXTRACT(YEAR FROM ce.enrolled_at) = EXTRACT(YEAR FROM NOW())
    `, [tenantId]);
        // Popular courses
        const coursesResult = await pool.query(`
      SELECT c.title, COUNT(ce.id) as enrollments,
        ROUND(AVG(ce.progress_percent), 2) as avg_progress
      FROM courses c
      JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE c.tenant_id = $1
      GROUP BY c.id, c.title
      ORDER BY enrollments DESC
      LIMIT 5
    `, [tenantId]);
        // Certifications (count by is_active status since no expiry tracking at certification level)
        const certsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as valid,
        0 as expiring_soon
      FROM certifications
      WHERE tenant_id = $1
    `, [tenantId]);
        return {
            enrollments: enrollmentResult.rows[0],
            popular_courses: coursesResult.rows,
            certifications: certsResult.rows[0],
            generated_at: new Date().toISOString(),
        };
    }
    // ==========================================================================
    // Event Queries
    // ==========================================================================
    /**
     * Get recent events
     */
    async getRecentEvents(tenantId, options) {
        const conditions = ['tenant_id = $1'];
        const params = [tenantId];
        let paramIndex = 2;
        if (options?.category) {
            conditions.push(`category = $${paramIndex++}`);
            params.push(options.category);
        }
        if (options?.event_type) {
            conditions.push(`event_type = $${paramIndex++}`);
            params.push(options.event_type);
        }
        if (options?.entity_type) {
            conditions.push(`entity_type = $${paramIndex++}`);
            params.push(options.entity_type);
        }
        const limit = Math.min(options?.limit || 100, 5000);
        const result = await pool.query(`
      SELECT id, tenant_id, event_type, category, entity_type, entity_id,
             user_id, session_id, data, metrics, occurred_at
      FROM analytics_events
      WHERE ${conditions.join(' AND ')}
      ORDER BY occurred_at DESC
      LIMIT $${paramIndex}
    `, [...params, limit]);
        return result.rows;
    }
    /**
     * Get event counts by category
     */
    async getEventCountsByCategory(tenantId, startDate, endDate) {
        const result = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM analytics_events
      WHERE tenant_id = $1 AND occurred_at >= $2 AND occurred_at <= $3
      GROUP BY category
      ORDER BY count DESC
    `, [tenantId, startDate, endDate]);
        return result.rows;
    }
    // ==========================================================================
    // Aggregation Management
    // ==========================================================================
    /**
     * Compute aggregations for a specific period
     */
    async computeAggregations(tenantId, period, date) {
        const periodStart = this.getPeriodStart(date, period);
        let periodEnd;
        switch (period) {
            case 'hourly':
                periodEnd = new Date(periodStart);
                periodEnd.setHours(periodEnd.getHours() + 1);
                break;
            case 'daily':
                periodEnd = new Date(periodStart);
                periodEnd.setDate(periodEnd.getDate() + 1);
                break;
            case 'weekly':
                periodEnd = new Date(periodStart);
                periodEnd.setDate(periodEnd.getDate() + 7);
                break;
            case 'monthly':
                periodEnd = new Date(periodStart);
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                break;
        }
        // Compute aggregations from events
        const result = await pool.query(`
      SELECT
        category || '_' || event_type as metric_name,
        COALESCE(entity_type, 'general') as dimension,
        category as dimension_value,
        COUNT(*) as value,
        jsonb_build_object('category', category) as metadata
      FROM analytics_events
      WHERE tenant_id = $1 AND occurred_at >= $2 AND occurred_at < $3
      GROUP BY category, event_type, entity_type
    `, [tenantId, periodStart, periodEnd]);
        // Insert aggregations
        for (const row of result.rows) {
            await pool.query(`
        INSERT INTO analytics_aggregations (
          id, tenant_id, metric_name, dimension, dimension_value, period_type, period_start,
          metadata, value_sum, value_count, computed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NOW())
        ON CONFLICT (tenant_id, metric_name, dimension, dimension_value, period_type, period_start)
        DO UPDATE SET value_sum = $9, value_count = $9, computed_at = NOW()
      `, [
                uuidv4(),
                tenantId,
                row.metric_name,
                row.dimension,
                row.dimension_value,
                period,
                periodStart,
                row.metadata,
                row.value,
            ]);
        }
    }
    /**
     * Get aggregation statistics
     */
    async getAggregationStats(tenantId) {
        const result = await pool.query(`
      SELECT
        period_type,
        COUNT(*) as aggregation_count,
        MIN(period_start) as earliest,
        MAX(period_start) as latest
      FROM analytics_aggregations
      WHERE tenant_id = $1
      GROUP BY period_type
      ORDER BY period_type
    `, [tenantId]);
        return result.rows;
    }
    /**
     * Get headcount trend for the last 12 months
     * Returns monthly data with headcount, hires, and attrition
     */
    async getHeadcountTrend(tenantId) {
        const result = await pool.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
          date_trunc('month', CURRENT_DATE),
          '1 month'::interval
        ) AS month
      ),
      monthly_hires AS (
        SELECT
          date_trunc('month', hire_date) AS month,
          COUNT(*) AS hires
        FROM employees
        WHERE tenant_id = $1
          AND hire_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY 1
      ),
      monthly_terminations AS (
        SELECT
          date_trunc('month', termination_date) AS month,
          COUNT(*) AS attrition
        FROM employees
        WHERE tenant_id = $1
          AND termination_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY 1
      ),
      headcount_per_month AS (
        SELECT
          m.month,
          (SELECT COUNT(*) FROM employees
           WHERE tenant_id = $1
             AND is_active = true
             AND hire_date <= m.month + INTERVAL '1 month' - INTERVAL '1 day'
             AND (termination_date IS NULL OR termination_date > m.month + INTERVAL '1 month' - INTERVAL '1 day')
          ) AS headcount,
          COALESCE(h.hires, 0) AS hires,
          COALESCE(t.attrition, 0) AS attrition
        FROM months m
        LEFT JOIN monthly_hires h ON m.month = h.month
        LEFT JOIN monthly_terminations t ON m.month = t.month
      )
      SELECT
        TO_CHAR(month, 'Mon') AS month,
        headcount::int,
        hires::int,
        attrition::int
      FROM headcount_per_month
      ORDER BY headcount_per_month.month
    `, [tenantId]);
        // Remove any extra columns that might have leaked through
        return result.rows.map((row) => ({
            month: row.month,
            headcount: row.headcount,
            hires: row.hires,
            attrition: row.attrition,
        }));
    }
    /**
     * Get aggregated skill gap summary from skill_gap_analyses table
     * Extracts skill gaps from JSONB and aggregates by skill name
     */
    async getSkillGapSummary(tenantId) {
        const result = await pool.query(`
      WITH skill_gap_extracted AS (
        SELECT
          (jsonb_array_elements(skill_gaps)->>'skill') as skill_name,
          (jsonb_array_elements(skill_gaps)->>'gap')::int as gap,
          proficiency_score
        FROM skill_gap_analyses
        WHERE tenant_id = $1
          AND skill_gaps IS NOT NULL
          AND jsonb_array_length(skill_gaps) > 0
      ),
      aggregated AS (
        SELECT
          skill_name as skill,
          COUNT(*) as employees_with_gap,
          ROUND(AVG(gap), 0)::int as avg_gap,
          ROUND(AVG(proficiency_score), 0)::int as current,
          -- Target is current + gap
          (ROUND(AVG(proficiency_score), 0) + ROUND(AVG(gap), 0))::int as target
        FROM skill_gap_extracted
        GROUP BY skill_name
      )
      SELECT
        skill,
        current,
        target,
        avg_gap as gap
      FROM aggregated
      ORDER BY employees_with_gap DESC
      LIMIT 10
    `, [tenantId]);
        return result.rows;
    }
    /**
     * Get monthly turnover summary with voluntary/involuntary breakdown
     * Returns last 12 months of turnover data for charts
     */
    async getTurnoverSummary(tenantId) {
        // Get monthly turnover for last 12 months
        const monthlyResult = await pool.query(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', NOW() - INTERVAL '11 months'),
          date_trunc('month', NOW()),
          INTERVAL '1 month'
        ) AS month_start
      ),
      monthly_terminations AS (
        SELECT
          date_trunc('month', termination_date) as term_month,
          CASE
            WHEN termination_reason IN ('resigned', 'voluntary', 'retirement', 'relocation')
            THEN 'voluntary'
            ELSE 'involuntary'
          END as term_type,
          COUNT(*) as term_count
        FROM employees
        WHERE tenant_id = $1
          AND termination_date IS NOT NULL
          AND termination_date >= date_trunc('month', NOW() - INTERVAL '11 months')
          AND termination_date <= NOW()
        GROUP BY date_trunc('month', termination_date), term_type
      ),
      monthly_headcount AS (
        SELECT
          m.month_start,
          (
            SELECT COUNT(*) FROM employees
            WHERE tenant_id = $1
              AND hire_date <= m.month_start + INTERVAL '1 month' - INTERVAL '1 day'
              AND (termination_date IS NULL OR termination_date >= m.month_start)
          ) as headcount
        FROM months m
      )
      SELECT
        to_char(m.month_start, 'Mon') as month,
        COALESCE(SUM(CASE WHEN mt.term_type = 'voluntary' THEN mt.term_count ELSE 0 END), 0) as voluntary_count,
        COALESCE(SUM(CASE WHEN mt.term_type = 'involuntary' THEN mt.term_count ELSE 0 END), 0) as involuntary_count,
        mh.headcount,
        -- Calculate turnover rate as percentage of headcount
        CASE
          WHEN mh.headcount > 0 THEN
            ROUND(COALESCE(SUM(CASE WHEN mt.term_type = 'voluntary' THEN mt.term_count ELSE 0 END), 0)::numeric * 100.0 / mh.headcount, 2)
          ELSE 0
        END as voluntary_rate,
        CASE
          WHEN mh.headcount > 0 THEN
            ROUND(COALESCE(SUM(CASE WHEN mt.term_type = 'involuntary' THEN mt.term_count ELSE 0 END), 0)::numeric * 100.0 / mh.headcount, 2)
          ELSE 0
        END as involuntary_rate
      FROM months m
      LEFT JOIN monthly_terminations mt ON mt.term_month = m.month_start
      LEFT JOIN monthly_headcount mh ON mh.month_start = m.month_start
      GROUP BY m.month_start, mh.headcount
      ORDER BY m.month_start
    `, [tenantId]);
        // Calculate current annual turnover rate (YTD)
        const ytdResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE termination_date IS NOT NULL AND termination_date >= date_trunc('year', NOW())) as ytd_terminations,
        COUNT(*) as total_employees,
        COUNT(*) FILTER (WHERE employment_status = 'active') as active_employees
      FROM employees
      WHERE tenant_id = $1
    `, [tenantId]);
        const ytdData = ytdResult.rows[0];
        const currentRate = ytdData.active_employees > 0
            ? Math.round((ytdData.ytd_terminations / ytdData.active_employees) * 100 * 10) / 10
            : 0;
        // Industry benchmark (typical HR benchmark)
        const industryBenchmark = 12.5;
        // Format monthly data for chart
        const monthlyData = monthlyResult.rows.map((row) => ({
            month: row.month,
            voluntary: parseFloat(row.voluntary_rate) || 0,
            involuntary: parseFloat(row.involuntary_rate) || 0,
            total: (parseFloat(row.voluntary_rate) || 0) + (parseFloat(row.involuntary_rate) || 0),
        }));
        return {
            monthlyData,
            currentRate,
            industryBenchmark,
        };
    }
}
// Export singleton instance
export const analyticsPipelineService = new AnalyticsPipelineService();
//# sourceMappingURL=analytics-pipeline.js.map