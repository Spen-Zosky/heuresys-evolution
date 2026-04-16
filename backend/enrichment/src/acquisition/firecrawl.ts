import { env } from '../config/env.js';

export interface FirecrawlScrapeResult {
  markdown: string;
  html: string | null;
  httpStatus: number;
  sourceUrl: string;
  title: string | null;
  language: string | null;
  creditsUsed: number | null;
}

export class FirecrawlError extends Error {
  constructor(
    message: string,
    readonly code: 'missing_key' | 'http_error' | 'api_error' | 'timeout' | 'network',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FirecrawlError';
  }
}

interface FirecrawlScrapeResponse {
  success: boolean;
  error?: string;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      statusCode?: number;
      sourceURL?: string;
      url?: string;
      title?: string;
      language?: string;
      creditsUsed?: number;
    };
  };
}

export async function firecrawlScrape(
  url: string,
  options: { timeoutMs?: number; onlyMainContent?: boolean } = {},
): Promise<FirecrawlScrapeResult> {
  const apiKey = env.firecrawlApiKey;
  if (!apiKey) {
    throw new FirecrawlError('FIRECRAWL_API_KEY not configured', 'missing_key');
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? env.firecrawlTimeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
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
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new FirecrawlError(`Firecrawl scrape timed out after ${timeoutMs}ms`, 'timeout');
    }
    throw new FirecrawlError(`Firecrawl network error: ${(err as Error).message}`, 'network');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new FirecrawlError(
      `Firecrawl HTTP ${response.status}: ${body.slice(0, 200)}`,
      'http_error',
      response.status,
    );
  }

  const json = (await response.json()) as FirecrawlScrapeResponse;
  if (!json.success || !json.data) {
    throw new FirecrawlError(
      `Firecrawl API error: ${json.error ?? 'unknown'}`,
      'api_error',
      response.status,
    );
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
