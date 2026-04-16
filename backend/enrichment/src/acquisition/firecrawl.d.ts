export interface FirecrawlScrapeResult {
    markdown: string;
    html: string | null;
    httpStatus: number;
    sourceUrl: string;
    title: string | null;
    language: string | null;
    creditsUsed: number | null;
}
export declare class FirecrawlError extends Error {
    readonly code: 'missing_key' | 'http_error' | 'api_error' | 'timeout' | 'network';
    readonly status?: number | undefined;
    constructor(message: string, code: 'missing_key' | 'http_error' | 'api_error' | 'timeout' | 'network', status?: number | undefined);
}
export declare function firecrawlScrape(url: string, options?: {
    timeoutMs?: number;
    onlyMainContent?: boolean;
}): Promise<FirecrawlScrapeResult>;
//# sourceMappingURL=firecrawl.d.ts.map