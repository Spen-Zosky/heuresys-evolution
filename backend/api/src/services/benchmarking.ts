/**
 * Benchmarking Service — O3.8 Cross-Tenant Benchmarking
 * Aggregates anonymized metrics across tenants sharing the same industry/size profile.
 * Uses admin pool (superuser) for cross-tenant aggregation; NEVER exposes per-tenant rows.
 * Mount point: /api/v1/benchmarking
 */

import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export type BenchmarkPosition = 'above_average' | 'at_average' | 'below_average' | 'no_data';

export interface MetricBenchmark {
  metric: string;
  label: string;
  unit: string;
  industryAvg: number | null;
  peerCount: number;
}

export interface IndustryBenchmarkResult {
  naceCode: string;
  industryName: string | null;
  companySizeCode: string | null;
  metrics: MetricBenchmark[];
}

export interface TenantMetrics {
  avg_employees_per_org_unit: number | null;
  avg_skills_per_employee: number | null;
  process_count: number;
  skill_coverage_pct: number | null;
  avg_kpi_count_per_process: number | null;
}

export interface MetricComparison {
  metric: string;
  label: string;
  unit: string;
  tenantValue: number | null;
  industryAvg: number | null;
  position: BenchmarkPosition;
  peerCount: number;
}

export interface TenantPositionResult {
  tenantId: string;
  tenantName: string;
  naceCode: string | null;
  companySizeCode: string | null;
  metrics: MetricComparison[];
}

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  avg_employees_per_org_unit: { label: 'Dipendenti per Unità Org.', unit: 'persone' },
  avg_skills_per_employee: { label: 'Competenze per Dipendente', unit: 'skill' },
  process_count: { label: 'Processi Aziendali', unit: 'processi' },
  skill_coverage_pct: { label: 'Copertura Competenze', unit: '%' },
  avg_kpi_count_per_process: { label: 'KPI per Processo', unit: 'kpi' },
};

// =============================================================================
// HELPERS
// =============================================================================

function classifyPosition(
  tenantValue: number | null,
  industryAvg: number | null
): BenchmarkPosition {
  if (tenantValue === null || industryAvg === null || industryAvg === 0) return 'no_data';
  const ratio = tenantValue / industryAvg;
  if (ratio >= 1.1) return 'above_average';
  if (ratio <= 0.9) return 'below_average';
  return 'at_average';
}

// =============================================================================
// QUERIES — cross-tenant aggregation via admin pool
// =============================================================================

/**
 * Fetch aggregate metrics for all active tenants grouped by industry profile.
 * Excludes the requesting tenant from peer averages.
 */
async function fetchPeerMetrics(
  naceCode: string,
  excludeTenantId: string
): Promise<{
  metrics: Record<string, number | null>;
  peerCount: number;
  industryName: string | null;
  companySizeCode: string | null;
}> {
  const result = await pool.query(
    `
    WITH peer_tenants AS (
      SELECT t.id AS tenant_id, t.company_size AS company_size_code, ip.name AS industry_name
      FROM tenants t
      JOIN industry_profiles ip ON ip.id = t.industry_profile_id
      WHERE ip.nace_class_code = $1
        AND t.id != $2
        AND t.status = 'active'
    ),
    org_metrics AS (
      SELECT ou.tenant_id,
             COUNT(DISTINCT ou.id)::numeric AS org_unit_count,
             COUNT(DISTINCT e.id)::numeric AS employee_count
      FROM org_units ou
      LEFT JOIN employees e ON e.org_unit_id = ou.id AND e.tenant_id = ou.tenant_id
      WHERE ou.tenant_id IN (SELECT tenant_id FROM peer_tenants)
      GROUP BY ou.tenant_id
    ),
    skill_metrics AS (
      SELECT es.tenant_id,
             COUNT(DISTINCT es.employee_id)::numeric AS employees_with_skills,
             COUNT(es.id)::numeric AS total_skill_assignments
      FROM employee_skills es
      WHERE es.tenant_id IN (SELECT tenant_id FROM peer_tenants)
      GROUP BY es.tenant_id
    ),
    employee_totals AS (
      SELECT e.tenant_id, COUNT(DISTINCT e.id)::numeric AS total_employees
      FROM employees e
      WHERE e.tenant_id IN (SELECT tenant_id FROM peer_tenants)
      GROUP BY e.tenant_id
    ),
    process_metrics AS (
      SELECT t.tenant_id AS tenant_id,
             COUNT(DISTINCT bp.id)::numeric AS proc_count,
             COALESCE(AVG(kpi_counts.kpi_count), 0) AS avg_kpis
      FROM peer_tenants t
      LEFT JOIN industry_profiles ip ON ip.id = (
        SELECT industry_profile_id FROM tenants WHERE id = t.tenant_id LIMIT 1
      )
      LEFT JOIN business_processes bp ON bp.profile_id = ip.id
      LEFT JOIN (
        SELECT process_id, COUNT(*)::numeric AS kpi_count
        FROM process_kpis
        GROUP BY process_id
      ) kpi_counts ON kpi_counts.process_id = bp.id
      GROUP BY t.tenant_id
    )
    SELECT
      COUNT(DISTINCT pt.tenant_id) AS peer_count,
      MAX(pt.industry_name) AS industry_name,
      MAX(pt.company_size_code) AS company_size_code,
      AVG(CASE WHEN om.org_unit_count > 0 THEN om.employee_count / om.org_unit_count END) AS avg_employees_per_org_unit,
      AVG(CASE WHEN et.total_employees > 0 THEN sm.total_skill_assignments / et.total_employees END) AS avg_skills_per_employee,
      AVG(pm.proc_count) AS process_count,
      AVG(CASE WHEN et.total_employees > 0 THEN (sm.employees_with_skills / et.total_employees) * 100 END) AS skill_coverage_pct,
      AVG(NULLIF(pm.avg_kpis, 0)) AS avg_kpi_count_per_process
    FROM peer_tenants pt
    LEFT JOIN org_metrics om ON om.tenant_id = pt.tenant_id
    LEFT JOIN skill_metrics sm ON sm.tenant_id = pt.tenant_id
    LEFT JOIN employee_totals et ON et.tenant_id = pt.tenant_id
    LEFT JOIN process_metrics pm ON pm.tenant_id = pt.tenant_id
    `,
    [naceCode, excludeTenantId]
  );

  const row = result.rows[0];
  return {
    peerCount: parseInt(row.peer_count ?? '0', 10),
    industryName: row.industry_name ?? null,
    companySizeCode: row.company_size_code ?? null,
    metrics: {
      avg_employees_per_org_unit:
        row.avg_employees_per_org_unit != null ? parseFloat(row.avg_employees_per_org_unit) : null,
      avg_skills_per_employee:
        row.avg_skills_per_employee != null ? parseFloat(row.avg_skills_per_employee) : null,
      process_count: row.process_count != null ? parseFloat(row.process_count) : null,
      skill_coverage_pct:
        row.skill_coverage_pct != null ? parseFloat(row.skill_coverage_pct) : null,
      avg_kpi_count_per_process:
        row.avg_kpi_count_per_process != null ? parseFloat(row.avg_kpi_count_per_process) : null,
    },
  };
}

/**
 * Fetch metrics for a single tenant (using admin pool).
 */
async function fetchTenantMetrics(tenantId: string): Promise<TenantMetrics> {
  const result = await pool.query(
    `
    WITH org_metrics AS (
      SELECT COUNT(DISTINCT ou.id)::numeric AS org_unit_count,
             COUNT(DISTINCT e.id)::numeric AS employee_count
      FROM org_units ou
      LEFT JOIN employees e ON e.org_unit_id = ou.id AND e.tenant_id = $1
      WHERE ou.tenant_id = $1
    ),
    skill_metrics AS (
      SELECT COUNT(DISTINCT es.employee_id)::numeric AS employees_with_skills,
             COUNT(es.id)::numeric AS total_skill_assignments
      FROM employee_skills es
      WHERE es.tenant_id = $1
    ),
    employee_totals AS (
      SELECT COUNT(DISTINCT e.id)::numeric AS total_employees
      FROM employees e
      WHERE e.tenant_id = $1
    ),
    process_metrics AS (
      SELECT COUNT(DISTINCT bp.id)::numeric AS proc_count,
             COALESCE(AVG(kpi_counts.kpi_count), 0) AS avg_kpis
      FROM tenants t
      JOIN industry_profiles ip ON ip.id = t.industry_profile_id
      LEFT JOIN business_processes bp ON bp.profile_id = ip.id
      LEFT JOIN (
        SELECT process_id, COUNT(*)::numeric AS kpi_count
        FROM process_kpis
        GROUP BY process_id
      ) kpi_counts ON kpi_counts.process_id = bp.id
      WHERE t.id = $1
    )
    SELECT
      CASE WHEN om.org_unit_count > 0 THEN om.employee_count / om.org_unit_count END AS avg_employees_per_org_unit,
      CASE WHEN et.total_employees > 0 THEN sm.total_skill_assignments / et.total_employees END AS avg_skills_per_employee,
      pm.proc_count AS process_count,
      CASE WHEN et.total_employees > 0 THEN (sm.employees_with_skills / et.total_employees) * 100 END AS skill_coverage_pct,
      NULLIF(pm.avg_kpis, 0) AS avg_kpi_count_per_process
    FROM org_metrics om, skill_metrics sm, employee_totals et, process_metrics pm
    `,
    [tenantId]
  );

  const row = result.rows[0] ?? {};
  return {
    avg_employees_per_org_unit:
      row.avg_employees_per_org_unit != null ? parseFloat(row.avg_employees_per_org_unit) : null,
    avg_skills_per_employee:
      row.avg_skills_per_employee != null ? parseFloat(row.avg_skills_per_employee) : null,
    process_count: row.process_count != null ? parseInt(row.process_count, 10) : 0,
    skill_coverage_pct: row.skill_coverage_pct != null ? parseFloat(row.skill_coverage_pct) : null,
    avg_kpi_count_per_process:
      row.avg_kpi_count_per_process != null ? parseFloat(row.avg_kpi_count_per_process) : null,
  };
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class BenchmarkingService {
  private tenantId: string;
  private tenantName: string;

  constructor(tenantId: string, tenantName: string) {
    this.tenantId = tenantId;
    this.tenantName = tenantName;
  }

  /**
   * Aggregate industry benchmark for a given NACE code.
   * Excludes the current tenant from the peer average.
   */
  async getIndustryBenchmark(naceCode: string): Promise<IndustryBenchmarkResult> {
    try {
      const peer = await fetchPeerMetrics(naceCode, this.tenantId);
      const metrics: MetricBenchmark[] = Object.entries(METRIC_LABELS).map(([key, meta]) => ({
        metric: key,
        label: meta.label,
        unit: meta.unit,
        industryAvg: peer.metrics[key] ?? null,
        peerCount: peer.peerCount,
      }));

      return {
        naceCode,
        industryName: peer.industryName,
        companySizeCode: peer.companySizeCode,
        metrics,
      };
    } catch (error) {
      logger.error({ err: error }, 'BenchmarkingService.getIndustryBenchmark failed');
      throw error;
    }
  }

  /**
   * Position the current tenant against industry peers.
   */
  async getTenantComparison(): Promise<TenantPositionResult> {
    try {
      // Get current tenant's industry profile
      const tenantResult = await pool.query(
        `SELECT t.company_size, ip.nace_class_code
         FROM tenants t
         LEFT JOIN industry_profiles ip ON ip.id = t.industry_profile_id
         WHERE t.id = $1`,
        [this.tenantId]
      );

      const tenantRow = tenantResult.rows[0] ?? {};
      const naceCode: string | null = tenantRow.nace_class_code ?? null;

      const [tenantMetrics, peer] = await Promise.all([
        fetchTenantMetrics(this.tenantId),
        naceCode
          ? fetchPeerMetrics(naceCode, this.tenantId)
          : Promise.resolve({
              metrics: {},
              peerCount: 0,
              industryName: null,
              companySizeCode: null,
            }),
      ]);

      const metricsComparison: MetricComparison[] = Object.entries(METRIC_LABELS).map(
        ([key, meta]) => {
          const tenantValue =
            (tenantMetrics as unknown as Record<string, number | null>)[key] ?? null;
          const industryAvg = (peer.metrics as Record<string, number | null>)[key] ?? null;
          return {
            metric: key,
            label: meta.label,
            unit: meta.unit,
            tenantValue,
            industryAvg,
            position: classifyPosition(tenantValue, industryAvg),
            peerCount: peer.peerCount,
          };
        }
      );

      return {
        tenantId: this.tenantId,
        tenantName: this.tenantName,
        naceCode,
        companySizeCode: tenantRow.company_size ?? null,
        metrics: metricsComparison,
      };
    } catch (error) {
      logger.error({ err: error }, 'BenchmarkingService.getTenantComparison failed');
      throw error;
    }
  }
}
