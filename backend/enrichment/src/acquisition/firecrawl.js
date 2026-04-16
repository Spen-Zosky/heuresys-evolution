import { env } from '../config/env.js';
export class FirecrawlError extends Error {
    code;
    status;
    constructor(message, code, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'FirecrawlError';
    }
}
export async function firecrawlScrape(url, options = {}) {
    const apiKey = env.firecrawlApiKey;
    if (!apiKey) {
        throw new FirecrawlError('FIRECRAWL_API_KEY not configured', 'missing_key');
    }
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? env.firecrawlTimeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await fetch(`${env.firecrawlBaseUrl}/v1/scrape`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${apiKey}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                url,
                formats: ['markdown', 'html'],
                onlyMainContent: options.onlyMainContent ?? true,
            }),
            signal: controller.signal,
        });
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new FirecrawlError(`Firecrawl scrape timed out after ${timeoutMs}ms`, 'timeout');
        }
        throw new FirecrawlError(`Firecrawl network error: ${err.message}`, 'network');
    }
    finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new FirecrawlError(`Firecrawl HTTP ${response.status}: ${body.slice(0, 200)}`, 'http_error', response.status);
    }
    const json = (await response.json());
    if (!json.success || !json.data) {
        throw new FirecrawlError(`Firecrawl API error: ${json.error ?? 'unknown'}`, 'api_error', response.status);
    }
    const data = json.data;
    const metadata = data.metadata ?? {};
    const markdown = data.markdown ?? '';
    if (markdown.length === 0) {
        throw new FirecrawlError('Firecrawl returned empty markdown', 'api_error', response.status);
    }
    return {
        markdown,
        html: data.html ?? null,
        httpStatus: metadata.statusCode ?? response.status,
        sourceUrl: metadata.sourceURL ?? metadata.url ?? url,
        title: metadata.title ?? null,
        language: metadata.language ?? null,
        creditsUsed: metadata.creditsUsed ?? null,
    };
}
//# sourceMappingURL=firecrawl.js.map