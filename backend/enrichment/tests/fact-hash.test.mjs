// Tests for computeFactHash. Uses node:test (Node >= 20) — no framework deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFactHash } from '../dist/db/candidates.js';

const base = {
  entityType: 'tenant_profile',
  entityAnchor: 'abc-123',
  fieldName: 'legal_name',
  candidateValue: 'Acme S.p.A.',
  sourceUrl: 'https://acme.example/',
};

test('computeFactHash is deterministic for identical input', () => {
  const a = computeFactHash(base);
  const b = computeFactHash({ ...base });
  assert.equal(a, b);
  assert.equal(a.length, 64); // sha256 hex
});

test('computeFactHash canonicalizes string values (trim + lowercase)', () => {
  const a = computeFactHash(base);
  const b = computeFactHash({ ...base, candidateValue: '  Acme S.p.A.  ' });
  const c = computeFactHash({ ...base, candidateValue: 'ACME S.P.A.' });
  assert.equal(a, b, 'whitespace should be trimmed');
  assert.equal(a, c, 'case should be folded to lower');
});

test('computeFactHash differs when fieldName differs', () => {
  const a = computeFactHash(base);
  const b = computeFactHash({ ...base, fieldName: 'description' });
  assert.notEqual(a, b);
});

test('computeFactHash differs when sourceUrl differs', () => {
  const a = computeFactHash(base);
  const b = computeFactHash({ ...base, sourceUrl: 'https://other.example/' });
  assert.notEqual(a, b);
});

test('computeFactHash handles null entityAnchor', () => {
  const a = computeFactHash({ ...base, entityAnchor: null });
  const b = computeFactHash({ ...base, entityAnchor: null });
  assert.equal(a, b);
  assert.notEqual(a, computeFactHash(base));
});

test('computeFactHash handles object candidateValue via JSON', () => {
  const hash = computeFactHash({ ...base, candidateValue: { foo: 'bar', n: 1 } });
  assert.equal(hash.length, 64);
});
