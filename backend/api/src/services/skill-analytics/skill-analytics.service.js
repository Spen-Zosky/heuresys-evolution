/**
 * Skill Analytics Service
 * Sprint 2025-04 - S-ONTO-03-09
 *
 * Analytics API for workforce skill insights
 */
export class SkillAnalyticsService {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    // --------------------------------------------------------------------------
    // Skill Coverage Heatmap
    // --------------------------------------------------------------------------
    async getSkillCoverageHeatmap(tenantId, options = {}) {
        let query = `
      WITH dept_employees AS (
        SELECT d.id as org_unit_id, d.name as department_name, COUNT(e.id) as total_employees
        FROM org_units d
        LEFT JOIN employees e ON e.org_unit_id = d.id AND e.is_active = true
        WHERE d.tenant_id = $1
        GROUP BY d.id, d.name
      ),
      skill_coverage AS (
        SELECT
          e.org_unit_id,
          esp.skill_id,
          COALESCE(es.preferred_label_en, 'Unknown') as skill_name,
          COUNT(DISTINCT esp.employee_id) as employee_count,
          AVG(esp.composite_score) as avg_proficiency
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        LEFT JOIN esco_skills es ON es.id = esp.skill_id
        WHERE esp.tenant_id = $1
    `;
        const params = [tenantId];
        let paramIndex = 2;
        if (options.org_unit_ids && options.org_unit_ids.length > 0) {
            query += ` AND e.org_unit_id = ANY($${paramIndex}::uuid[])`;
            params.push(options.org_unit_ids);
            paramIndex++;
        }
        if (options.skill_ids && options.skill_ids.length > 0) {
            query += ` AND esp.skill_id = ANY($${paramIndex}::uuid[])`;
            params.push(options.skill_ids);
            paramIndex++;
        }
        if (options.min_proficiency !== undefined) {
            query += ` AND esp.composite_score >= $${paramIndex}`;
            params.push(options.min_proficiency);
            paramIndex++;
        }
        query += `
        GROUP BY e.org_unit_id, esp.skill_id, es.preferred_label_en
      )
      SELECT
        de.org_unit_id,
        de.department_name,
        sc.skill_id,
        sc.skill_name,
        sc.employee_count,
        ROUND(sc.avg_proficiency::numeric, 2) as avg_proficiency,
        ROUND((sc.employee_count::numeric / NULLIF(de.total_employees, 0) * 100), 1) as coverage_pct
      FROM skill_coverage sc
      JOIN dept_employees de ON de.org_unit_id = sc.org_unit_id
      ORDER BY de.department_name, sc.employee_count DESC
    `;
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // Skill Trends Over Time
    // --------------------------------------------------------------------------
    async getSkillTrends(tenantId, options = { period: 'monthly', lookback_periods: 6 }) {
        const periodFormat = {
            monthly: 'YYYY-MM',
            quarterly: 'YYYY-"Q"Q',
            yearly: 'YYYY',
        };
        const periodIntervalUnit = {
            monthly: 'month',
            quarterly: 'month',
            yearly: 'year',
        };
        const lookbackMonths = options.lookback_periods || 6;
        const intervalMultiplier = options.period === 'quarterly' ? 3 : 1;
        const totalLookback = (lookbackMonths - 1) * intervalMultiplier;
        // date_trunc and to_char arguments come from code-controlled mappings (typed enum),
        // not user input, so string interpolation is safe for those SQL keywords.
        // INTERVAL values are parameterized for defense-in-depth.
        const truncUnit = options.period === 'quarterly' ? 'quarter' : options.period === 'yearly' ? 'year' : 'month';
        let query = `
      WITH periods AS (
        SELECT generate_series(
          date_trunc('${truncUnit}', CURRENT_DATE) - ($2 * INTERVAL '1 ${periodIntervalUnit[options.period]}'),
          date_trunc('${truncUnit}', CURRENT_DATE),
          ($3 * INTERVAL '1 ${periodIntervalUnit[options.period]}')
        ) as period_start
      ),
      skill_data AS (
        SELECT
          esp.skill_id,
          COALESCE(es.preferred_label_en, 'Unknown') as skill_name,
          date_trunc('${truncUnit}', COALESCE(esp.updated_at, esp.created_at)) as period_start,
          COUNT(DISTINCT esp.employee_id) as employee_count,
          AVG(esp.composite_score) as avg_proficiency
        FROM employee_skill_profiles esp
        LEFT JOIN esco_skills es ON es.id = esp.skill_id
        WHERE esp.tenant_id = $1
    `;
        const params = [tenantId, totalLookback, intervalMultiplier];
        let paramIndex = 4;
        if (options.skill_ids && options.skill_ids.length > 0) {
            query += ` AND esp.skill_id = ANY($${paramIndex}::uuid[])`;
            params.push(options.skill_ids);
            paramIndex++;
        }
        query += `
        GROUP BY esp.skill_id, es.preferred_label_en, period_start
      ),
      trend_data AS (
        SELECT
          sd.skill_id,
          sd.skill_name,
          to_char(p.period_start, '${periodFormat[options.period]}') as period,
          COALESCE(sd.employee_count, 0) as employee_count,
          COALESCE(ROUND(sd.avg_proficiency::numeric, 2), 0) as avg_proficiency,
          LAG(sd.employee_count) OVER (PARTITION BY sd.skill_id ORDER BY p.period_start) as prev_count
        FROM periods p
        LEFT JOIN skill_data sd ON sd.period_start = p.period_start
        WHERE sd.skill_id IS NOT NULL
      )
      SELECT
        skill_id,
        skill_name,
        period,
        employee_count,
        avg_proficiency,
        ROUND((employee_count - COALESCE(prev_count, employee_count))::numeric / NULLIF(prev_count, 0) * 100, 1) as change_from_previous
      FROM trend_data
      ORDER BY skill_name, period
    `;
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // Critical Skill Shortages
    // --------------------------------------------------------------------------
    async getCriticalShortages(tenantId, options = {}) {
        let query = `
      WITH required_skills AS (
        -- Skills required by positions (from tenant_job_skills)
        SELECT
          COALESCE(tjs.source_skill_id, es.id) as skill_id,
          COALESCE(es.preferred_label_en, tjs.skill_name_en, tjs.skill_name_it) as skill_name,
          COUNT(DISTINCT e.id) as required_positions,
          array_agg(DISTINCT d.name) FILTER (WHERE d.name IS NOT NULL) as departments_affected
        FROM tenant_job_skills tjs
        JOIN tenant_jobs tj ON tj.id = tjs.tenant_job_id
        LEFT JOIN esco_skills es ON es.uri = tjs.esco_skill_uri OR es.id = tjs.source_skill_id
        LEFT JOIN employees e ON e.position_id = tj.id::text OR e.job_title = tj.title_it OR e.job_title = tj.title_en
        LEFT JOIN org_units d ON d.id = e.org_unit_id
        WHERE tj.tenant_id = $1 AND tjs.is_required = true
    `;
        const params = [tenantId];
        let paramIndex = 2;
        if (options.org_unit_id) {
            query += ` AND e.org_unit_id = $${paramIndex}`;
            params.push(options.org_unit_id);
            paramIndex++;
        }
        query += `
        GROUP BY COALESCE(tjs.source_skill_id, es.id), COALESCE(es.preferred_label_en, tjs.skill_name_en, tjs.skill_name_it)
      ),
      available_skills AS (
        -- Employees with these skills
        SELECT
          esp.skill_id,
          COUNT(DISTINCT esp.employee_id) as available_employees
        FROM employee_skill_profiles esp
        WHERE esp.tenant_id = $1
        AND esp.composite_score >= 3  -- Minimum proficiency level
        GROUP BY esp.skill_id
      )
      SELECT
        rs.skill_id,
        rs.skill_name,
        rs.required_positions::int,
        COALESCE(avs.available_employees, 0)::int as available_employees,
        (rs.required_positions - COALESCE(avs.available_employees, 0))::int as shortage_count,
        CASE
          WHEN rs.required_positions > 0 AND COALESCE(avs.available_employees, 0) = 0 THEN 'critical'
          WHEN (rs.required_positions - COALESCE(avs.available_employees, 0))::numeric / NULLIF(rs.required_positions, 0) > 0.5 THEN 'high'
          WHEN (rs.required_positions - COALESCE(avs.available_employees, 0))::numeric / NULLIF(rs.required_positions, 0) > 0.25 THEN 'medium'
          ELSE 'low'
        END as severity,
        rs.departments_affected
      FROM required_skills rs
      LEFT JOIN available_skills avs ON avs.skill_id = rs.skill_id
      WHERE rs.required_positions > COALESCE(avs.available_employees, 0)
    `;
        if (options.min_shortage !== undefined) {
            query += ` AND (rs.required_positions - COALESCE(avs.available_employees, 0)) >= $${paramIndex}`;
            params.push(options.min_shortage);
            paramIndex++;
        }
        query += ` ORDER BY shortage_count DESC, severity`;
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // KSABA Distribution Analytics
    // --------------------------------------------------------------------------
    async getKSABADistribution(tenantId, options = {}) {
        let whereClause = 'esp.tenant_id = $1';
        const params = [tenantId];
        let paramIndex = 2;
        if (options.org_unit_id) {
            whereClause += ` AND e.org_unit_id = $${paramIndex}`;
            params.push(options.org_unit_id);
            paramIndex++;
        }
        if (options.employee_id) {
            whereClause += ` AND esp.employee_id = $${paramIndex}`;
            params.push(options.employee_id);
            paramIndex++;
        }
        const query = `
      SELECT
        dimension,
        count,
        ROUND(avg_level::numeric, 2) as avg_level,
        employees_with_data
      FROM (
        SELECT 'knowledge' as dimension,
               COUNT(*) FILTER (WHERE knowledge_level > 0) as count,
               AVG(knowledge_level) FILTER (WHERE knowledge_level > 0) as avg_level,
               COUNT(DISTINCT employee_id) FILTER (WHERE knowledge_level > 0) as employees_with_data
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        WHERE ${whereClause}

        UNION ALL

        SELECT 'skill' as dimension,
               COUNT(*) FILTER (WHERE skill_level > 0) as count,
               AVG(skill_level) FILTER (WHERE skill_level > 0) as avg_level,
               COUNT(DISTINCT employee_id) FILTER (WHERE skill_level > 0) as employees_with_data
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        WHERE ${whereClause}

        UNION ALL

        SELECT 'ability' as dimension,
               COUNT(*) FILTER (WHERE ability_level > 0) as count,
               AVG(ability_level) FILTER (WHERE ability_level > 0) as avg_level,
               COUNT(DISTINCT employee_id) FILTER (WHERE ability_level > 0) as employees_with_data
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        WHERE ${whereClause}

        UNION ALL

        SELECT 'behavior' as dimension,
               COUNT(*) FILTER (WHERE behavior_level > 0) as count,
               AVG(behavior_level) FILTER (WHERE behavior_level > 0) as avg_level,
               COUNT(DISTINCT employee_id) FILTER (WHERE behavior_level > 0) as employees_with_data
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        WHERE ${whereClause}

        UNION ALL

        SELECT 'attitude' as dimension,
               COUNT(*) FILTER (WHERE attitude_level > 0) as count,
               AVG(attitude_level) FILTER (WHERE attitude_level > 0) as avg_level,
               COUNT(DISTINCT employee_id) FILTER (WHERE attitude_level > 0) as employees_with_data
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        WHERE ${whereClause}
      ) distributions
      ORDER BY CASE dimension
        WHEN 'knowledge' THEN 1
        WHEN 'skill' THEN 2
        WHEN 'ability' THEN 3
        WHEN 'behavior' THEN 4
        WHEN 'attitude' THEN 5
      END
    `;
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // Emerging Skills (from extraction)
    // --------------------------------------------------------------------------
    async getEmergingSkills(tenantId, options = {}) {
        const lookbackDays = options.lookback_days || 90;
        const minOccurrences = options.min_occurrences || 3;
        const limit = options.limit || 20;
        const query = `
      WITH recent_skills AS (
        -- Get skills from extracted_skills (from job postings)
        SELECT
          LOWER(es.raw_text) as skill_name,
          MIN(es.created_at) as first_seen,
          SUM(es.mention_count) as extraction_count,
          COUNT(DISTINCT jp.id) as job_postings_count,
          array_agg(DISTINCT 'job_posting'::text) as source_types
        FROM extracted_skills es
        LEFT JOIN job_postings_raw jp ON jp.id = es.job_posting_id
        WHERE es.tenant_id = $1
        AND es.created_at >= CURRENT_DATE - ($4 * INTERVAL '1 day')
        GROUP BY LOWER(es.raw_text)
        HAVING SUM(es.mention_count) >= $2
      ),
      historical_counts AS (
        SELECT
          LOWER(raw_text) as skill_name,
          SUM(mention_count) as old_count
        FROM extracted_skills
        WHERE tenant_id = $1
        AND created_at < CURRENT_DATE - ($4 * INTERVAL '1 day')
        AND created_at >= CURRENT_DATE - ($5 * INTERVAL '1 day')
        GROUP BY LOWER(raw_text)
      )
      SELECT
        rs.skill_name,
        rs.first_seen::text,
        rs.extraction_count::int,
        rs.job_postings_count::int as employees_with_skill,
        rs.source_types,
        CASE
          WHEN hc.old_count IS NULL OR hc.old_count = 0 THEN 100.0
          ELSE ROUND((rs.extraction_count - hc.old_count)::numeric / hc.old_count * 100, 1)
        END as growth_rate
      FROM recent_skills rs
      LEFT JOIN historical_counts hc ON hc.skill_name = rs.skill_name
      ORDER BY
        CASE WHEN hc.old_count IS NULL THEN 0 ELSE 1 END,
        growth_rate DESC,
        rs.extraction_count DESC
      LIMIT $3
    `;
        const result = await this.pool.query(query, [
            tenantId,
            minOccurrences,
            limit,
            lookbackDays,
            lookbackDays * 2,
        ]);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // OrgUnit Comparison Metrics
    // --------------------------------------------------------------------------
    async getDepartmentComparison(tenantId, options = {}) {
        let query = `
      WITH dept_skills AS (
        SELECT
          d.id as org_unit_id,
          d.name as department_name,
          COUNT(DISTINCT esp.skill_id) as total_skills,
          AVG(esp.composite_score) as avg_proficiency,
          COUNT(DISTINCT esp.employee_id) as employees_with_skills
        FROM org_units d
        LEFT JOIN employees e ON e.org_unit_id = d.id AND e.is_active = true
        LEFT JOIN employee_skill_profiles esp ON esp.employee_id = e.id
        WHERE d.tenant_id = $1
    `;
        const params = [tenantId];
        let paramIndex = 2;
        if (options.org_unit_ids && options.org_unit_ids.length > 0) {
            query += ` AND d.id = ANY($${paramIndex}::uuid[])`;
            params.push(options.org_unit_ids);
            paramIndex++;
        }
        query += `
        GROUP BY d.id, d.name
      ),
      dept_employees AS (
        SELECT d.id as org_unit_id, COUNT(e.id) as total_employees
        FROM org_units d
        LEFT JOIN employees e ON e.org_unit_id = d.id AND e.is_active = true
        WHERE d.tenant_id = $1
        GROUP BY d.id
      ),
      top_skills AS (
        SELECT
          e.org_unit_id,
          COALESCE(es.preferred_label_en, 'Unknown') as skill_name,
          COUNT(*) as skill_count,
          ROW_NUMBER() OVER (PARTITION BY e.org_unit_id ORDER BY COUNT(*) DESC) as rn
        FROM employee_skill_profiles esp
        JOIN employees e ON e.id = esp.employee_id
        LEFT JOIN esco_skills es ON es.id = esp.skill_id
        WHERE esp.tenant_id = $1
        GROUP BY e.org_unit_id, es.preferred_label_en
      ),
      dept_gaps AS (
        SELECT
          e.org_unit_id,
          COUNT(*) as gap_count
        FROM skill_gap_analyses sga
        JOIN employees e ON e.id = sga.target_entity_id
        WHERE sga.tenant_id = $1
        AND sga.target_entity_type = 'employee'
        AND jsonb_array_length(sga.skill_gaps) > 0
        GROUP BY e.org_unit_id
      )
      SELECT
        ds.org_unit_id,
        ds.department_name,
        ds.total_skills::int,
        ROUND(ds.avg_proficiency::numeric, 2) as avg_proficiency,
        ROUND((ds.employees_with_skills::numeric / NULLIF(de.total_employees, 0) * 100), 1) as skill_coverage_pct,
        COALESCE(
          (SELECT json_agg(json_build_object('skill_name', skill_name, 'count', skill_count))
           FROM top_skills ts
           WHERE ts.org_unit_id = ds.org_unit_id AND ts.rn <= 5),
          '[]'::json
        ) as top_skills,
        COALESCE(dg.gap_count, 0)::int as gap_count
      FROM dept_skills ds
      JOIN dept_employees de ON de.org_unit_id = ds.org_unit_id
      LEFT JOIN dept_gaps dg ON dg.org_unit_id = ds.org_unit_id
      ORDER BY ds.department_name
    `;
        const result = await this.pool.query(query, params);
        return result.rows;
    }
    // --------------------------------------------------------------------------
    // Summary Statistics
    // --------------------------------------------------------------------------
    async getSummaryStats(tenantId) {
        const query = `
      SELECT
        (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND is_active = true) as total_employees,
        (SELECT COUNT(DISTINCT employee_id) FROM employee_skill_profiles WHERE tenant_id = $1) as employees_with_profiles,
        (SELECT COUNT(DISTINCT skill_id) FROM employee_skill_profiles WHERE tenant_id = $1) as total_skills_tracked,
        (SELECT ROUND(AVG(composite_score)::numeric, 2) FROM employee_skill_profiles WHERE tenant_id = $1) as avg_proficiency,
        (SELECT COUNT(*) FROM (
          SELECT 1
          FROM tenant_job_skills tjs
          JOIN tenant_jobs tj ON tj.id = tjs.tenant_job_id
          WHERE tj.tenant_id = $1 AND tjs.is_required = true
          AND NOT EXISTS (
            SELECT 1 FROM employee_skill_profiles esp
            WHERE esp.skill_id = tjs.source_skill_id AND esp.composite_score >= 3
          )
          LIMIT 50
        ) shortages) as critical_shortages,
        (SELECT COUNT(*) FROM org_units WHERE tenant_id = $1) as departments
    `;
        const result = await this.pool.query(query, [tenantId]);
        return result.rows[0];
    }
}
export default SkillAnalyticsService;
//# sourceMappingURL=skill-analytics.service.js.map