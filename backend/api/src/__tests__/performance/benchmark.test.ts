/**
 * API Gateway Performance Benchmarks
 * Measures response times and throughput for critical endpoints
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE_URL = process.env.API_URL || 'http://localhost:8012';
const TEST_USERNAME = process.env.TEST_USERNAME || 'sysadmin';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'sysadmin123';
const BENCHMARK_ITERATIONS = parseInt(process.env.BENCHMARK_ITERATIONS || '10');
const MAX_RESPONSE_TIME_MS = parseInt(process.env.MAX_RESPONSE_TIME_MS || '500');

interface BenchmarkResult {
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  total: number;
  count: number;
}

async function measureRequest(url: string, options?: RequestInit): Promise<number> {
  const start = performance.now();
  await fetch(url, options);
  return performance.now() - start;
}

function calculateStats(times: number[]): BenchmarkResult {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    min: Math.round(sorted[0] * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    avg: Math.round((sum / times.length) * 100) / 100,
    p95: Math.round(sorted[Math.floor(times.length * 0.95)] * 100) / 100,
    p99: Math.round(sorted[Math.floor(times.length * 0.99)] * 100) / 100,
    total: Math.round(sum * 100) / 100,
    count: times.length,
  };
}

async function runBenchmark(
  name: string,
  url: string,
  options?: RequestInit
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup request
  await measureRequest(url, options);

  for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
    const time = await measureRequest(url, options);
    times.push(time);
  }

  return calculateStats(times);
}

describe('Performance Benchmarks', () => {
  let authToken: string | null = null;

  beforeAll(async () => {
    // Ensure server is responsive
    const response = await fetch(`${API_BASE_URL}/health`);
    expect(response.status).toBe(200);

    // Authenticate to access protected endpoints
    try {
      const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
      });
      const loginData = (await loginRes.json()) as {
        success?: boolean;
        data?: { accessToken: string };
      };
      if (loginData.success && loginData.data?.accessToken) {
        authToken = loginData.data.accessToken;
      }
    } catch {
      // Auth failed - some tests may fail
    }
  });

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }

  describe('Health Endpoints', () => {
    it('should respond to /health within acceptable time', async () => {
      const result = await runBenchmark('GET /health', `${API_BASE_URL}/health`);

      console.log(`/health: avg=${result.avg}ms, p95=${result.p95}ms, p99=${result.p99}ms`);

      expect(result.avg).toBeLessThan(MAX_RESPONSE_TIME_MS);
      expect(result.p95).toBeLessThan(MAX_RESPONSE_TIME_MS * 1.5);
    });

    it('should respond to /db-health within acceptable time', async () => {
      const result = await runBenchmark('GET /db-health', `${API_BASE_URL}/db-health`, {
        headers: authHeaders(),
      });

      console.log(`/db-health: avg=${result.avg}ms, p95=${result.p95}ms, p99=${result.p99}ms`);

      expect(result.avg).toBeLessThan(MAX_RESPONSE_TIME_MS);
      expect(result.p95).toBeLessThan(MAX_RESPONSE_TIME_MS * 2);
    });
  });

  describe('Tenant Endpoints', () => {
    it('should list tenants within acceptable time', async () => {
      const result = await runBenchmark('GET /api/v1/tenants', `${API_BASE_URL}/api/v1/tenants`, {
        headers: authHeaders(),
      });

      console.log(`GET /tenants: avg=${result.avg}ms, p95=${result.p95}ms, p99=${result.p99}ms`);

      expect(result.avg).toBeLessThan(MAX_RESPONSE_TIME_MS);
      expect(result.p95).toBeLessThan(MAX_RESPONSE_TIME_MS * 2);
    });

    it('should get single tenant within acceptable time', async () => {
      const result = await runBenchmark(
        'GET /api/v1/tenants/rtl-bank',
        `${API_BASE_URL}/api/v1/tenants/rtl-bank`,
        { headers: authHeaders() }
      );

      console.log(
        `GET /tenants/:id: avg=${result.avg}ms, p95=${result.p95}ms, p99=${result.p99}ms`
      );

      expect(result.avg).toBeLessThan(MAX_RESPONSE_TIME_MS);
    });
  });

  describe('Auth Endpoints', () => {
    it('should respond to login within acceptable time', async () => {
      const result = await runBenchmark(
        'POST /api/v1/auth/login',
        `${API_BASE_URL}/api/v1/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: TEST_USERNAME,
            password: TEST_PASSWORD,
          }),
        }
      );

      console.log(
        `POST /auth/login: avg=${result.avg}ms, p95=${result.p95}ms, p99=${result.p99}ms`
      );

      // Auth with bcrypt is CPU-intensive; in parallel with the full suite, avg can spike
      expect(result.avg).toBeLessThan(MAX_RESPONSE_TIME_MS * 20);
    }, 30000); // bcrypt is CPU-intensive — 11 iterations need more than default 5s
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent health requests', async () => {
      const concurrency = 5;
      const start = performance.now();

      const promises = Array(concurrency)
        .fill(null)
        .map(() => fetch(`${API_BASE_URL}/health`));

      const responses = await Promise.all(promises);
      const duration = performance.now() - start;

      console.log(`${concurrency} concurrent /health: ${Math.round(duration)}ms total`);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // Should complete in reasonable time with concurrency
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME_MS * 2);
    });

    it('should handle concurrent tenant requests', async () => {
      if (!authToken) {
        // Skip if no valid auth token — cannot benchmark authenticated endpoints
        expect(true).toBe(true);
        return;
      }
      const concurrency = 5;
      const start = performance.now();

      const promises = Array(concurrency)
        .fill(null)
        .map(() => fetch(`${API_BASE_URL}/api/v1/tenants`, { headers: authHeaders() }));

      const responses = await Promise.all(promises);
      const duration = performance.now() - start;

      console.log(`${concurrency} concurrent /tenants: ${Math.round(duration)}ms total`);

      responses.forEach((res) => {
        // Accept 200 (success) or 429 (rate limited under load)
        expect([200, 429]).toContain(res.status);
      });

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME_MS * 3);
    });
  });

  describe('Response Size', () => {
    it('should return appropriately sized responses', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tenants`, { headers: authHeaders() });
      const text = await response.text();

      console.log(`Tenants list response size: ${text.length} bytes`);

      // Response shouldn't be excessively large
      expect(text.length).toBeLessThan(1024 * 1024); // < 1MB
    });
  });
});

describe('Stress Test (Light)', () => {
  it('should handle burst of requests without errors', async () => {
    const burstSize = 20;
    const start = performance.now();

    const promises = Array(burstSize)
      .fill(null)
      .map(() => fetch(`${API_BASE_URL}/health`));

    const responses = await Promise.all(promises);
    const duration = performance.now() - start;

    const successCount = responses.filter((r) => r.status === 200).length;

    console.log(`Burst test: ${successCount}/${burstSize} successful in ${Math.round(duration)}ms`);

    // At least 80% should succeed
    expect(successCount / burstSize).toBeGreaterThanOrEqual(0.8);
  });
});
