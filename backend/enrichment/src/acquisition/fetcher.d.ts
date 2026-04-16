export interface FetchResult {
    sourceId: string;
    snapshotId: string;
    markdown: string;
    contentHash: string;
    httpStatus: number;
    bytesSize: number;
    crawlerUsed: string;
    extraPages?: number;
}
type Backend = 'firecrawl' | 'plain_fetch';
export declare function resolveBackend(): Backend;
/**
 * Fetches the seed URL and (in parallel) a curated set of discovery paths
 * (about/contact/chi-siamo/...), persisting each successful hit as a separate
 * enrichment_source + enrichment_source_snapshot row. Returns the primary
 * (seed) snapshot metadata plus the merged markdown from all successful pages
 * for downstream LLM extraction.
 *
 * Discovery pages that 4xx are logged and skipped silently so a single bad
 * path does not block the main flow.
 */
export declare function fetchAndStore(url: string, tenantId: string, jobId: string, requestedSourceType: string, freshnessDays?: number, crawlConfig?: Record<string, unknown>): Promise<FetchResult>;
export {};
//# sourceMappingURL=fetcher.d.ts.map