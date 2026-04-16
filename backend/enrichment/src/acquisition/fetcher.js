import { createHash } from 'node:crypto';
import TurndownService from 'turndown';
import { env } from '../config/env.js';
import { withTenantClient } from '../db/pool.js';
import { getTrustScoreForSourceType } from '../db/trust-rules.js';
import { logger } from '../lib/logger.js';
import { findFreshSnapshot, logFreshnessHit } from './freshness.js';
import { firecrawlScrape, FirecrawlError } from './firecrawl.js';
import { firecrawlCrawlStart, firecrawlCrawlPoll, FirecrawlCrawlError, } from './firecrawl-crawl.js';
import { classifySourceUrl } from './verification.js';
const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
});
/**
 * Discovery paths tried in parallel for multi-page acquisition of company profiles.
 * Kept short on purpose to bound Firecrawl credit usage per job.
 */
const DISCOVERY_PATHS = [
    '/about',
    '/about-us',
    '/chi-siamo',
    '/company',
    '/azienda',
    '/contact',
    '/contacts',
    '/contatti',
];
function canonicalizeUrl(url) {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
}
function sha256(input) {
    return createHash('sha256').update(input, 'utf8').digest('hex');
}
export function resolveBackend() {
    const configured = env.acquisitionBackend;
    if (configured === 'firecrawl')
        return 'firecrawl';
    if (configured === 'plain_fetch')
        return 'plain_fetch';
    return env.firecrawlApiKey ? 'firecrawl' : 'plain_fetch';
}
async function acquireViaFirecrawl(url) {
    const result = await firecrawlScrape(url);
    return {
        markdown: result.markdown,
        httpStatus: result.httpStatus,
        bytesSize: Buffer.byteLength(result.markdown, 'utf8'),
        contentLength: (result.html ?? result.markdown).length,
        crawlerUsed: 'firecrawl',
        language: result.language ?? 'en',
        title: result.title,
    };
}
async function acquireViaPlainFetch(url) {
    const response = await fetch(url, {
        headers: {
            'user-agent': 'Mozilla/5.0 (compatible; HeuresysEnrichmentBot/0.1; +https://heuresys.com)',
            accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
    });
    const html = await response.text();
    const markdown = turndown.turndown(html);
    return {
        markdown,
        httpStatus: response.status,
        bytesSize: Buffer.byteLength(markdown, 'utf8'),
        contentLength: html.length,
        crawlerUsed: 'plain_fetch',
        language: 'en',
        title: null,
    };
}
async function acquireOne(url, preferred) {
    try {
        return preferred === 'firecrawl'
            ? await acquireViaFirecrawl(url)
            : await acquireViaPlainFetch(url);
    }
    catch (err) {
        if (preferred === 'firecrawl' && err instanceof FirecrawlError && err.code !== 'missing_key') {
            logger.warn({ err: { code: err.code, message: err.message, status: err.status }, url }, 'firecrawl acquisition failed, falling back to plain_fetch');
            return acquireViaPlainFetch(url);
        }
        throw err;
    }
}
function buildDiscoveryUrls(seedUrl) {
    const base = new URL(seedUrl);
    return DISCOVERY_PATHS.map((path) => {
        const u = new URL(seedUrl);
        u.pathname = path;
        u.search = '';
        u.hash = '';
        return u.toString();
    }).filter((u) => u !== base.toString());
}
async function persistSnapshot(client, tenantId, jobId, rawUrl, canonical, sourceType, trustScore, payload) {
    const contentHash = sha256(payload.markdown);
    const sourceRes = await client.query(`INSERT INTO enrichment_sources
       (tenant_id, job_id, url, canonical_url, source_type, discovered_via,
        trust_score, relevance_score, language)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`, [
        tenantId,
        jobId,
        rawUrl,
        canonical,
        sourceType,
        payload.crawlerUsed,
        trustScore,
        0.5,
        payload.language,
    ]);
    const sourceId = sourceRes.rows[0].id;
    const snapshotRes = await client.query(`INSERT INTO enrichment_source_snapshots
       (tenant_id, source_id, content_hash, content_text, content_markdown,
        content_metadata_jsonb, crawler_used, http_status, bytes_size)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_id, source_id, content_hash) DO UPDATE
       SET retrieved_at = NOW()
     RETURNING id`, [
        tenantId,
        sourceId,
        contentHash,
        null,
        payload.markdown,
        JSON.stringify({
            content_length: payload.contentLength,
            title: payload.title,
            backend: payload.crawlerUsed,
        }),
        payload.crawlerUsed,
        payload.httpStatus,
        payload.bytesSize,
    ]);
    return { sourceId, snapshotId: snapshotRes.rows[0].id, contentHash };
}
/**
 * Handles the L2 freshness cache hit path: creates a NEW enrichment_sources
 * row linked to the current jobId so lineage is preserved, but reuses the
 * existing snapshot (no new enrichment_source_snapshots insert, no HTTP
 * call, no Firecrawl credit spent).
 */
async function reuseFreshSnapshot(tenantId, jobId, rawUrl, canonical, sourceType, trustScore, fresh) {
    return withTenantClient(tenantId, async (client) => {
        const sourceRes = await client.query(`INSERT INTO enrichment_sources
         (tenant_id, job_id, url, canonical_url, source_type, discovered_via,
          trust_score, relevance_score, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`, [
            tenantId,
            jobId,
            rawUrl,
            canonical,
            sourceType,
            'l2_cache',
            trustScore,
            0.5,
            fresh.language,
        ]);
        return {
            sourceId: sourceRes.rows[0].id,
            snapshotId: fresh.snapshotId,
            markdown: `# PAGE: ${canonical}\n\n${fresh.markdown}`,
            contentHash: '',
            httpStatus: fresh.httpStatus,
            bytesSize: fresh.bytesSize,
            crawlerUsed: `${fresh.crawlerUsed} (L2 cache, ${fresh.ageHours}h old)`,
            extraPages: 0,
        };
    });
}
/**
 * Acquire multiple pages via Firecrawl's async crawl API.
 * Maps the DB `crawl_config` JSONB (snake_case) to the SDK's CrawlOptions (camelCase).
 * Returns one AcquisitionPayload per successfully crawled page.
 */
async function acquireViaCrawl(url, crawlConfig) {
    const opts = {};
    if (typeof crawlConfig.max_depth === 'number')
        opts.maxDepth = crawlConfig.max_depth;
    if (typeof crawlConfig.max_pages === 'number')
        opts.limit = crawlConfig.max_pages;
    if (Array.isArray(crawlConfig.include_paths))
        opts.includePaths = crawlConfig.include_paths;
    if (Array.isArray(crawlConfig.exclude_paths))
        opts.excludePaths = crawlConfig.exclude_paths;
    const jobId = await firecrawlCrawlStart(url, opts);
    logger.info({ url, jobId, opts }, 'firecrawl crawl started');
    const result = await firecrawlCrawlPoll(jobId);
    logger.info({ jobId, status: result.status, pages: result.pages.length }, 'firecrawl crawl completed');
    return result.pages
        .filter((p) => p.markdown && p.markdown.length > 0)
        .map((p) => ({
        markdown: p.markdown,
        httpStatus: 200,
        bytesSize: Buffer.byteLength(p.markdown, 'utf8'),
        contentLength: (p.html ?? p.markdown).length,
        crawlerUsed: 'firecrawl_crawl',
        language: p.language ?? 'en',
        title: null,
        pageUrl: p.url,
    }));
}
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
export async function fetchAndStore(url, tenantId, jobId, requestedSourceType, freshnessDays = 7, crawlConfig) {
    const canonical = canonicalizeUrl(url);
    const preferred = resolveBackend();
    // SEE Fase 7.5 — verify the URL actually belongs to this tenant.
    // If requestedSourceType is 'official_website' we require a domain
    // match against tenants.verified_website; otherwise we downgrade the
    // classification to 'unknown' with trust_score=0.10 so downstream
    // merge strategies refuse to auto-apply.
    let sourceType = requestedSourceType;
    if (requestedSourceType === 'official_website') {
        const classification = await classifySourceUrl(tenantId, canonical);
        if (classification.verified) {
            logger.info({ url: canonical, matched: classification.matchedDomain }, 'source verification PASS');
            sourceType = 'official_website';
        }
        else {
            logger.warn({
                url: canonical,
                reason: classification.reason,
                matched: classification.matchedDomain,
            }, 'source verification DOWNGRADE — URL is not the tenant official website');
            sourceType = 'unknown';
        }
    }
    const trustScore = await getTrustScoreForSourceType(sourceType);
    // SEE Fase 6 — L2 freshness check: if we have a recent snapshot for this
    // canonical URL we skip the Firecrawl call entirely. We still link a new
    // enrichment_sources row to the job so lineage is preserved.
    const cachedFresh = await withTenantClient(tenantId, (c) => findFreshSnapshot(c, tenantId, canonical, freshnessDays));
    if (cachedFresh) {
        logFreshnessHit(canonical, cachedFresh);
        return reuseFreshSnapshot(tenantId, jobId, url, canonical, sourceType, trustScore, cachedFresh);
    }
    // SEE Fase 11 — Crawl path: when the descriptor has crawl_config with
    // max_depth > 0 or max_pages > 0, use the async crawl API instead of
    // the single-page scrape + hardcoded discovery paths.
    const useCrawl = crawlConfig &&
        ((typeof crawlConfig.max_depth === 'number' && crawlConfig.max_depth > 0) ||
            (typeof crawlConfig.max_pages === 'number' && crawlConfig.max_pages > 0));
    if (useCrawl) {
        try {
            const crawlPages = await acquireViaCrawl(canonical, crawlConfig);
            if (crawlPages.length === 0) {
                logger.warn({ url: canonical }, 'crawl returned zero pages, falling back to scrape');
            }
            else {
                return withTenantClient(tenantId, async (client) => {
                    const primaryPayload = crawlPages[0];
                    if (!primaryPayload) {
                        throw new Error('crawlPages length > 0 but first element missing');
                    }
                    const primarySaved = await persistSnapshot(client, tenantId, jobId, url, canonical, sourceType, trustScore, primaryPayload);
                    for (let i = 1; i < crawlPages.length; i++) {
                        const page = crawlPages[i];
                        if (!page)
                            continue;
                        const pageRawUrl = page.pageUrl ?? canonical;
                        await persistSnapshot(client, tenantId, jobId, pageRawUrl, pageRawUrl, `${sourceType}_crawl`, Math.max(trustScore - 0.1, 0.1), page);
                    }
                    const mergedMarkdown = crawlPages
                        .map((p) => `# PAGE: ${p.pageUrl ?? canonical}\n\n${p.markdown}`)
                        .join('\n\n---\n\n');
                    return {
                        sourceId: primarySaved.sourceId,
                        snapshotId: primarySaved.snapshotId,
                        markdown: mergedMarkdown,
                        contentHash: primarySaved.contentHash,
                        httpStatus: primaryPayload.httpStatus,
                        bytesSize: Buffer.byteLength(mergedMarkdown, 'utf8'),
                        crawlerUsed: 'firecrawl_crawl',
                        extraPages: crawlPages.length - 1,
                    };
                });
            }
        }
        catch (err) {
            if (err instanceof FirecrawlCrawlError && err.code === 'missing_key') {
                throw err;
            }
            // Crawl failed — log with full context and fall back to scrape + discovery.
            // The fallback is intentional (R026): crawl is best-effort, single-page
            // scrape still produces usable data. The warning includes the error code
            // so operators can diagnose crawl failures in logs.
            const errInfo = err instanceof FirecrawlCrawlError
                ? { code: err.code, message: err.message }
                : { message: err.message };
            logger.warn({ err: errInfo, url: canonical, fallback: 'scrape+discovery' }, 'crawl failed, falling back to single-page scrape + discovery');
        }
    }
    const primary = await acquireOne(canonical, preferred);
    const discoveryUrls = buildDiscoveryUrls(canonical);
    const discoveryResults = await Promise.allSettled(discoveryUrls.map((u) => acquireOne(u, preferred)));
    const successfulDiscovery = [];
    discoveryResults.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value.httpStatus < 400 && r.value.bytesSize > 200) {
            successfulDiscovery.push({ url: discoveryUrls[idx], payload: r.value });
        }
        else if (r.status === 'rejected') {
            logger.debug({ url: discoveryUrls[idx], err: r.reason.message.slice(0, 120) }, 'discovery page skipped');
        }
    });
    logger.info({ seed: canonical, discovered: successfulDiscovery.length, backend: preferred }, 'multi-page acquisition complete');
    return withTenantClient(tenantId, async (client) => {
        const primarySaved = await persistSnapshot(client, tenantId, jobId, url, canonical, sourceType, trustScore, primary);
        for (const disc of successfulDiscovery) {
            await persistSnapshot(client, tenantId, jobId, disc.url, disc.url, `${sourceType}_discovery`, Math.max(trustScore - 0.1, 0.1), disc.payload);
        }
        const mergedMarkdown = [
            `# PAGE: ${canonical}\n\n${primary.markdown}`,
            ...successfulDiscovery.map((d) => `# PAGE: ${d.url}\n\n${d.payload.markdown}`),
        ].join('\n\n---\n\n');
        return {
            sourceId: primarySaved.sourceId,
            snapshotId: primarySaved.snapshotId,
            markdown: mergedMarkdown,
            contentHash: primarySaved.contentHash,
            httpStatus: primary.httpStatus,
            bytesSize: Buffer.byteLength(mergedMarkdown, 'utf8'),
            crawlerUsed: primary.crawlerUsed,
            extraPages: successfulDiscovery.length,
        };
    });
}
//# sourceMappingURL=fetcher.js.map