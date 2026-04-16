export interface CrawlOptions {
    maxDepth?: number;
    limit?: number;
    includePaths?: string[];
    excludePaths?: string[];
}
export interface CrawlPage {
    url: string;
    markdown: string;
    html?: string;
    /** Language detected by Firecrawl (e.g. 'en', 'it') — may not always be present. */
    language?: string;
}
export interface CrawlResult {
    status: 'completed' | 'failed' | 'scraping';
    pages: CrawlPage[];
}
export declare class FirecrawlCrawlError extends Error {
    readonly code: 'missing_key' | 'http_error' | 'api_error' | 'timeout' | 'network' | 'poll_exhausted';
    readonly status?: number | undefined;
    constructor(message: string, code: 'missing_key' | 'http_error' | 'api_error' | 'timeout' | 'network' | 'poll_exhausted', status?: number | undefined);
}
/**
 * Kick off an async crawl job via Firecrawl `/v1/crawl`.
 * Returns the crawl job ID that can be polled with `firecrawlCrawlPoll`.
 */
export declare function firecrawlCrawlStart(url: string, opts?: CrawlOptions): Promise<string>;
/**
 * Poll a Firecrawl crawl job until it completes or fails.
 *
 * - Exponential backoff: initial 3 s, max 30 s, up to 20 polls.
 * - Hard timeout: 5 minutes total polling time.
 * - Transient HTTP errors (429, 502, 503, 504) are retried up to 3
 *   consecutive times before throwing.
 * - 4xx client errors (other than 429) throw immediately.
 * - Does NOT hold a database connection — caller is responsible for
 *   acquiring connections only after this resolves.
 */
export declare function firecrawlCrawlPoll(jobId: string): Promise<CrawlResult>;
//# sourceMappingURL=firecrawl-crawl.d.ts.map