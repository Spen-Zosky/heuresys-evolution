import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Error (reuses same class shape as firecrawl.ts)
// ---------------------------------------------------------------------------

export class FirecrawlCrawlError extends Error {
  constructor(
    message: string,
    readonly code: 'missing_key' | 'http_error' | 'api_error' | 'timeout' | 'network' | 'poll_exhausted',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FirecrawlCrawlError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TRANSIENT_STATUS_CODES = new Set([429, 502, 503, 504]);

function isTransient(status: number): boolean {
  return TRANSIENT_STATUS_CODES.has(status);
}

/** Hard ceiling on total polling time (5 minutes). */
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// firecrawlCrawlStart — POST /v1/crawl
// ---------------------------------------------------------------------------

interface CrawlStartResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Kick off an async crawl job via Firecrawl `/v1/crawl`.
 * Returns the crawl job ID that can be polled with `firecrawlCrawlPoll`.
 */
export async function firecrawlCrawlStart(
  url: string,
  opts: CrawlOptions = {},
): Promise<string> {
  const apiKey = env.firecrawlApiKey;
  if (!apiKey) {
    throw new FirecrawlCrawlError('FIRECRAWL_API_KEY not configured', 'missing_key');
  }

  const body: Record<string, unknown> = { url };
  if (opts.maxDepth !== undefined) body.maxDepth = opts.maxDepth;
  if (opts.limit !== undefined) body.limit = opts.limit;
  if (opts.includePaths?.length) body.includePaths = opts.includePaths;
  if (opts.excludePaths?.length) body.excludePaths = opts.excludePaths;

  const controller = new AbortController();
  const timeoutMs = env.firecrawlTimeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${env.firecrawlBaseUrl}/v1/crawl`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new FirecrawlCrawlError(`Firecrawl crawl start timed out after ${timeoutMs}ms`, 'timeout');
    }
    throw new FirecrawlCrawlError(`Firecrawl network error: ${(err as Error).message}`, 'network');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new FirecrawlCrawlError(
      `Firecrawl HTTP ${response.status}: ${text.slice(0, 200)}`,
      'http_error',
      response.status,
    );
  }

  const json = (await response.json()) as CrawlStartResponse;
  if (!json.success || !json.id) {
    throw new FirecrawlCrawlError(
      `Firecrawl crawl start failed: ${json.error ?? 'no job id returned'}`,
      'api_error',
      response.status,
    );
  }

  return json.id;
}

// ---------------------------------------------------------------------------
// firecrawlCrawlPoll — GET /v1/crawl/:jobId  (exponential backoff)
// ---------------------------------------------------------------------------

interface CrawlPollResponse {
  status: 'completed' | 'failed' | 'scraping';
  data?: Array<{
    url?: string;
    markdown?: string;
    html?: string;
    metadata?: { sourceURL?: string; url?: string };
  }>;
  error?: string;
}

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
export async function firecrawlCrawlPoll(jobId: string): Promise<CrawlResult> {
  const apiKey = env.firecrawlApiKey;
  if (!apiKey) {
    throw new FirecrawlCrawlError('FIRECRAWL_API_KEY not configured', 'missing_key');
  }

  const baseUrl = env.firecrawlBaseUrl;
  const pollUrl = `${baseUrl}/v1/crawl/${encodeURIComponent(jobId)}`;

  const maxPolls = 20;
  const initialDelayMs = 3_000;
  const maxDelayMs = 30_000;
  const maxConsecutiveTransient = 3;

  const startTime = Date.now();
  let delay = initialDelayMs;
  let consecutiveTransient = 0;

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    // Hard timeout guard
    if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
      throw new FirecrawlCrawlError(
        `Crawl polling exceeded hard timeout of ${MAX_POLL_DURATION_MS / 1000}s`,
        'timeout',
      );
    }

    // Wait before polling (skip delay on first attempt)
    if (attempt > 0) {
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }

    let response: Response;
    try {
      response = await fetch(pollUrl, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
    } catch (err) {
      // Network errors count as transient
      consecutiveTransient++;
      if (consecutiveTransient >= maxConsecutiveTransient) {
        throw new FirecrawlCrawlError(
          `Firecrawl network error after ${maxConsecutiveTransient} retries: ${(err as Error).message}`,
          'network',
        );
      }
      continue;
    }

    // Handle HTTP-level errors
    if (!response.ok) {
      if (isTransient(response.status)) {
        consecutiveTransient++;
        if (consecutiveTransient >= maxConsecutiveTransient) {
          const text = await response.text().catch(() => '');
          throw new FirecrawlCrawlError(
            `Firecrawl transient HTTP ${response.status} after ${maxConsecutiveTransient} retries: ${text.slice(0, 200)}`,
            'http_error',
            response.status,
          );
        }
        continue;
      }

      // Non-transient 4xx — throw immediately
      const text = await response.text().catch(() => '');
      throw new FirecrawlCrawlError(
        `Firecrawl HTTP ${response.status}: ${text.slice(0, 200)}`,
        'http_error',
        response.status,
      );
    }

    // Successful HTTP response — reset transient counter
    consecutiveTransient = 0;

    const json = (await response.json()) as CrawlPollResponse;

    if (json.status === 'completed') {
      const pages: CrawlPage[] = (json.data ?? []).map((d) => ({
        url: d.metadata?.sourceURL ?? d.metadata?.url ?? d.url ?? '',
        markdown: d.markdown ?? '',
        html: d.html,
      }));
      return { status: 'completed', pages };
    }

    if (json.status === 'failed') {
      throw new FirecrawlCrawlError(
        `Crawl job ${jobId} failed: ${json.error ?? 'unknown'}`,
        'api_error',
      );
    }

    // status === 'scraping' — keep polling
  }

  throw new FirecrawlCrawlError(
    `Crawl job ${jobId} did not complete after ${maxPolls} polls`,
    'poll_exhausted',
  );
}

// ---------------------------------------------------------------------------
// sleep helper (no external deps)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
