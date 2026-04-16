// Tests for SEE Fase 7 merge strategies. Pure — no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { decideMerge } = await import('../dist/merge/strategies.js');

function base(overrides = {}) {
  return {
    strategy: 'update_if_empty',
    fieldName: 'legal_name',
    candidateValue: 'Acme S.p.A.',
    currentValue: null,
    confidence: 0.9,
    trustScore: 1.0,
    policyMode: 'merge',
    operatorApproved: false,
    ...overrides,
  };
}

// ---- policy mode gates ----------------------------------------------------

test('observe mode never applies', () => {
  const r = decideMerge(base({ policyMode: 'observe' }));
  assert.equal(r.apply, false);
  assert.match(r.reason, /observe/);
});

test('suggest mode requires operator approval', () => {
  const r = decideMerge(base({ policyMode: 'suggest', operatorApproved: false }));
  assert.equal(r.apply, false);
  assert.match(r.reason, /approval/);
});

test('suggest mode + operator approved + update_if_empty applies', () => {
  const r = decideMerge(base({ policyMode: 'suggest', operatorApproved: true }));
  assert.equal(r.apply, true);
});

// ---- update_if_empty ------------------------------------------------------

test('update_if_empty: applies when current null', () => {
  const r = decideMerge(base({ strategy: 'update_if_empty', currentValue: null }));
  assert.equal(r.apply, true);
});

test('update_if_empty: skips when current set', () => {
  const r = decideMerge(base({ strategy: 'update_if_empty', currentValue: 'Existing' }));
  assert.equal(r.apply, false);
});

test('update_if_empty: skips when current empty string', () => {
  const r = decideMerge(base({ strategy: 'update_if_empty', currentValue: '   ' }));
  assert.equal(r.apply, true);
});

// ---- authoritative_only ---------------------------------------------------

test('authoritative_only: requires high trust', () => {
  const low = decideMerge(base({ strategy: 'authoritative_only', trustScore: 0.5 }));
  assert.equal(low.apply, false);
  assert.match(low.reason, /authoritative/);

  const high = decideMerge(base({ strategy: 'authoritative_only', trustScore: 1.0 }));
  assert.equal(high.apply, true);
});

test('authoritative_only: skips when value matches (no write needed)', () => {
  const r = decideMerge(
    base({
      strategy: 'authoritative_only',
      trustScore: 1.0,
      currentValue: 'acme s.p.a.',
      candidateValue: 'ACME S.p.A.',
    }),
  );
  assert.equal(r.apply, false);
  assert.match(r.reason, /matches/);
});

test('authoritative_only: overrides existing when different and authoritative', () => {
  const r = decideMerge(
    base({
      strategy: 'authoritative_only',
      trustScore: 1.0,
      currentValue: 'old name',
    }),
  );
  assert.equal(r.apply, true);
  assert.match(r.reason, /overrides/);
});

// ---- prefer_latest_high_confidence ----------------------------------------

test('prefer_latest_high_confidence: gates on confidence', () => {
  const low = decideMerge(
    base({ strategy: 'prefer_latest_high_confidence', confidence: 0.5 }),
  );
  assert.equal(low.apply, false);
  assert.match(low.reason, /confidence/);
});

test('prefer_latest_high_confidence: overwrites on high confidence', () => {
  const r = decideMerge(
    base({
      strategy: 'prefer_latest_high_confidence',
      confidence: 0.95,
      currentValue: 'old description',
      candidateValue: 'new description',
    }),
  );
  assert.equal(r.apply, true);
});

// ---- append_observation_not_overwrite ------------------------------------

test('append array strategy: merges unique items', () => {
  const r = decideMerge(
    base({
      strategy: 'append_observation_not_overwrite',
      fieldName: 'sample_activities',
      candidateValue: ['a', 'b', 'c'],
      currentValue: ['b', 'd'],
    }),
  );
  assert.equal(r.apply, true);
  assert.deepEqual(r.newValue, ['b', 'd', 'a', 'c']);
});

test('append array strategy: skips when no new items', () => {
  const r = decideMerge(
    base({
      strategy: 'append_observation_not_overwrite',
      candidateValue: ['a', 'b'],
      currentValue: ['b', 'a'],
    }),
  );
  assert.equal(r.apply, false);
});

// ---- suggest_only --------------------------------------------------------

test('suggest_only always returns apply=false', () => {
  const r = decideMerge(base({ strategy: 'suggest_only' }));
  assert.equal(r.apply, false);
  assert.match(r.reason, /suggest_only/);
});

// ---- empty candidate ------------------------------------------------------

test('empty candidate never applies', () => {
  const r = decideMerge(base({ candidateValue: '' }));
  assert.equal(r.apply, false);
  assert.match(r.reason, /empty/);
});

// ---- unknown strategy -----------------------------------------------------

test('unknown strategy is a no-op', () => {
  const r = decideMerge(base({ strategy: 'unknown' }));
  assert.equal(r.apply, false);
  assert.match(r.reason, /unknown/);
});
