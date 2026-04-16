// Tests for acquisition backend resolution + Firecrawl adapter.
// Uses node:test (Node >= 20) with global fetch stubbing — no framework deps.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Env must be set BEFORE importing compiled modules that read env at load time.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/test';
process.env.FIRECRAWL_API_KEY = 'fc-test-key-for-unit-tests-only-xxxxxxxxxxxx';
process.env.FIRECRAWL_BASE_URL = 'https://api.firecrawl.test';
process.env.ACQUISITION_BACKEND = 'auto';
process.env.LOG_TO_STDERR = '1';
process.env.ENRICHMENT_WORKER_ENABLED = 'false';

const { firecrawlScrape, FirecrawlError } = await import('../dist/acquisition/firecrawl.js');
const { resolveBackend } = await import('../dist/acquisition/fetcher.js');

const originalFetch = globalThis.fetch;

function stubFetch(impl) {
  globalThis.fetch = impl;
}
after(() => {
  globalThis.fetch = originalFetch;
});

test('resolveBackend: auto picks firecrawl when key present', () => {
  assert.equal(resolveBackend(), 'firecrawl');
});

test('firecrawlScrape: happy path maps response shape', async () => {
  stubFetch(async (url, init) => {
    assert.equal(url, 'https://api.firecrawl.test/v1/scrape');
    assert.equal(init.method, 'POST');
    assert.match(init.headers.authorization, /^Bearer fc-test-/);
    const body = JSON.parse(init.body);
    assert.equal(body.url, 'https://example.com/');
    assert.deepEqual(body.formats, ['markdown', 'html']);
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: '# Example\n\nContent here',
          html: '<h1>Example</h1>',
          metadata: {
            statusCode: 200,
            sourceURL: 'https://example.com/',
            title: 'Example',
            language: 'en',
            creditsUsed: 1,
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });

  const result = await firecrawlScrape('https://example.com/');
  assert.equal(result.markdown, '# Example\n\nContent here');
  assert.equal(result.httpStatus, 200);
  assert.equal(result.title, 'Example');
  assert.equal(result.language, 'en');
  assert.equal(result.creditsUsed, 1);
});

test('firecrawlScrape: http error raises FirecrawlError', async () => {
  stubFetch(async () =>
    new Response('Rate limited', { status: 429 }),
  );
  await assert.rejects(
    () => firecrawlScrape('https://example.com/'),
    (err) => err instanceof FirecrawlError && err.code === 'http_error' && err.status === 429,
  );
});

test('firecrawlScrape: api-level failure raises api_error', async () => {
  stubFetch(async () =>
    new Response(JSON.stringify({ success: false, error: 'bad url' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  await assert.rejects(
    () => firecrawlScrape('https://example.com/'),
    (err) => err instanceof FirecrawlError && err.code === 'api_error',
  );
});

test('firecrawlScrape: empty markdown raises api_error', async () => {
  stubFetch(async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: { markdown: '', metadata: { statusCode: 200 } },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
  await assert.rejects(
    () => firecrawlScrape('https://example.com/'),
    (err) => err instanceof FirecrawlError && err.code === 'api_error',
  );
});
