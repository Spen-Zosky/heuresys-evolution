// Tests for SEE Fase 7.5 source verification + entity mismatch. Pure — no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { classifySourceUrlPure } = await import('../dist/acquisition/verification.js');
const { checkEntityMismatch, tokenOverlap } = await import('../dist/merge/entity-mismatch.js');

// ---- source verification ---------------------------------------------------

test('verification: PASS when URL domain matches verified_website', () => {
  const r = classifySourceUrlPure('https://www.acme.com/about', 'acme.com');
  assert.equal(r.verified, true);
  assert.equal(r.sourceType, 'official_website');
  assert.equal(r.trustScore, 1.0);
  assert.equal(r.matchedDomain, 'acme.com');
});

test('verification: PASS tolerates www + case + trailing slash', () => {
  const r = classifySourceUrlPure('https://WWW.ACME.com/', 'acme.com');
  assert.equal(r.verified, true);
});

test('verification: DOWNGRADE when domain does not match', () => {
  const r = classifySourceUrlPure('https://www.rtl.it/', 'rtl-bank.example');
  assert.equal(r.verified, false);
  assert.equal(r.sourceType, 'unknown');
  assert.equal(r.trustScore, 0.1);
  assert.match(r.reason, /does not match/);
});

test('verification: DOWNGRADE when verified_website is NULL', () => {
  const r = classifySourceUrlPure('https://www.rtl.it/', null);
  assert.equal(r.verified, false);
  assert.equal(r.sourceType, 'unknown');
  assert.match(r.reason, /not set/);
});

test('verification: DOWNGRADE when URL is not parseable', () => {
  const r = classifySourceUrlPure('not a url', 'acme.com');
  assert.equal(r.verified, false);
  assert.match(r.reason, /derive domain/);
});

// ---- token overlap --------------------------------------------------------

test('tokenOverlap: identical strings are 1.0', () => {
  assert.equal(tokenOverlap('RTL Bank', 'rtl bank'), 1);
});

test('tokenOverlap: completely different strings are 0', () => {
  assert.equal(tokenOverlap('Acme Corporation', 'Zeta Industries'), 0);
});

test('tokenOverlap: RTL Bank vs RTL 102.5 — low overlap (the original bug)', () => {
  const o = tokenOverlap('RTL Bank', 'RTL 102.5');
  // "rtl" is the only common token; smaller set = {rtl,bank} or {rtl,102,5}
  assert.ok(o < 0.6, `expected low overlap, got ${o}`);
});

test('tokenOverlap: empty value returns 1 (no signal)', () => {
  assert.equal(tokenOverlap(null, 'anything'), 1);
  assert.equal(tokenOverlap('', 'anything'), 1);
});

// ---- checkEntityMismatch --------------------------------------------------

const tenantMatchKeys = ['vat_id', 'website_domain', 'legal_name'];

test('entity mismatch: non match-key fields pass through', () => {
  const r = checkEntityMismatch({
    fieldName: 'description',
    candidateValue: 'A completely different company',
    currentValue: 'Original description',
    matchKeyFields: tenantMatchKeys,
  });
  assert.equal(r.mismatch, false);
  assert.match(r.reason, /not a match key/);
});

test('entity mismatch: empty current value is free pass', () => {
  const r = checkEntityMismatch({
    fieldName: 'legal_name',
    candidateValue: 'Acme S.p.A.',
    currentValue: null,
    matchKeyFields: tenantMatchKeys,
  });
  assert.equal(r.mismatch, false);
  assert.match(r.reason, /empty/);
});

test('entity mismatch: BLOCKS RTL 102.5 vs RTL Bank (the original bug)', () => {
  const r = checkEntityMismatch({
    fieldName: 'legal_name',
    candidateValue: 'RTL 102.5',
    currentValue: 'RTL Bank',
    matchKeyFields: tenantMatchKeys,
  });
  assert.equal(r.mismatch, true);
  assert.match(r.reason, /entity_mismatch/);
});

test('entity mismatch: ALLOWS Acme S.p.A. vs ACME S.p.A. (case/punctuation)', () => {
  const r = checkEntityMismatch({
    fieldName: 'legal_name',
    candidateValue: 'Acme S.p.A.',
    currentValue: 'ACME S.p.A.',
    matchKeyFields: tenantMatchKeys,
  });
  assert.equal(r.mismatch, false);
});

test('entity mismatch: ALLOWS "Banca Acme" vs "Banca Acme SpA" (partial match)', () => {
  const r = checkEntityMismatch({
    fieldName: 'legal_name',
    candidateValue: 'Banca Acme',
    currentValue: 'Banca Acme SpA',
    matchKeyFields: tenantMatchKeys,
  });
  assert.equal(r.mismatch, false);
});
