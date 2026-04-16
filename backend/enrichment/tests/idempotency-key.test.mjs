import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeIdempotencyKey } from '../dist/db/jobs.js';

const base = {
  tenantId: '0c54b84a-db6e-4da4-bc91-af5d480d524e',
  descriptorId: '33333333-0000-4000-8000-000000000001',
  targetTable: 'public.tenants',
  targetPkField: 'id',
  targetRecordId: '0c54b84a-db6e-4da4-bc91-af5d480d524e',
  semanticScope: { seed_url: 'https://rtl.it/' },
  policyId: '22222222-0000-4000-8000-000000000001',
  mode: 'suggest',
  freshnessDays: 7,
};

test('computeIdempotencyKey is deterministic for identical input', () => {
  const a = computeIdempotencyKey(base);
  const b = computeIdempotencyKey({ ...base, semanticScope: { seed_url: 'https://rtl.it/' } });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('computeIdempotencyKey is insensitive to JSON key order in semanticScope', () => {
  const a = computeIdempotencyKey({
    ...base,
    semanticScope: { a: 1, b: 2, c: { d: 4, e: 5 } },
  });
  const b = computeIdempotencyKey({
    ...base,
    semanticScope: { c: { e: 5, d: 4 }, b: 2, a: 1 },
  });
  assert.equal(a, b, 'stableStringify should canonicalize key order');
});

test('computeIdempotencyKey changes with targetRecordId', () => {
  const a = computeIdempotencyKey(base);
  const b = computeIdempotencyKey({ ...base, targetRecordId: 'different-id' });
  assert.notEqual(a, b);
});

test('computeIdempotencyKey changes with policyId', () => {
  const a = computeIdempotencyKey(base);
  const b = computeIdempotencyKey({ ...base, policyId: '22222222-0000-4000-8000-999999999999' });
  assert.notEqual(a, b);
});

test('computeIdempotencyKey changes with freshnessDays', () => {
  const a = computeIdempotencyKey(base);
  const b = computeIdempotencyKey({ ...base, freshnessDays: 30 });
  assert.notEqual(a, b);
});

test('computeIdempotencyKey changes with extraction schema version', () => {
  const a = computeIdempotencyKey(base, 1);
  const b = computeIdempotencyKey(base, 2);
  assert.notEqual(a, b);
});

test('computeIdempotencyKey does NOT depend on tenantId alone', () => {
  // tenantId is not part of the hash input — the row-level UNIQUE(tenant_id, key)
  // is what isolates tenants. Proving this documents the contract.
  const a = computeIdempotencyKey(base);
  const b = computeIdempotencyKey({ ...base, tenantId: '00000000-0000-0000-0000-000000000000' });
  assert.equal(a, b);
});
