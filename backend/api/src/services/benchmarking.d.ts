/**
 * Benchmarking Service — O3.8 Cross-Tenant Benchmarking
 * Aggregates anonymized metrics across tenants sharing the same industry/size profile.
 * Uses admin pool (superuser) for cross-tenant aggregation; NEVER exposes per-tenant rows.
 * Mount point: /api/v1/benchmarking
 */
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
export declare class BenchmarkingService {
    private tenantId;
    private tenantName;
    constructor(tenantId: string, tenantName: string);
    /**
     * Aggregate industry benchmark for a given NACE code.
     * Excludes the current tenant from the peer average.
     */
    getIndustryBenchmark(naceCode: string): Promise<IndustryBenchmarkResult>;
    /**
     * Position the current tenant against industry peers.
     */
    getTenantComparison(): Promise<TenantPositionResult>;
}
//# sourceMappingURL=benchmarking.d.ts.map