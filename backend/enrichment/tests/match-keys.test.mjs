// Tests for SEE Fase 6 match-keys resolver. Pure — no DB, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { resolveMatchKey, deriveWebsiteDomain } = await import('../dist/resolution/match-keys.js');

// ---- deriveWebsiteDomain --------------------------------------------------

test('deriveWebsiteDomain: strips protocol + www + trailing slash', () => {
  assert.equal(deriveWebsiteDomain('https://www.rtl.it/'), 'rtl.it');
  assert.equal(deriveWebsiteDomain('http://rtl.it/about'), 'rtl.it');
});

test('deriveWebsiteDomain: accepts bare host without protocol', () => {
  assert.equal(deriveWebsiteDomain('rtl.it'), 'rtl.it');
  assert.equal(deriveWebsiteDomain('www.acme.example.com'), 'acme.example.com');
});

test('deriveWebsiteDomain: returns null on garbage', () => {
  assert.equal(deriveWebsiteDomain(null), null);
  assert.equal(deriveWebsiteDomain(undefined), null);
  assert.equal(deriveWebsiteDomain(''), null);
  assert.equal(deriveWebsiteDomain(42), null);
});

test('deriveWebsiteDomain: lowercases host', () => {
  assert.equal(deriveWebsiteDomain('https://WWW.ACME.COM'), 'acme.com');
});

// ---- resolveMatchKey ------------------------------------------------------

const tenantKeys = ['vat_id', 'website_domain', 'legal_name'];

test('resolveMatchKey: vat_id wins when present', () => {
  const r = resolveMatchKey(
    tenantKeys,
    { vat_id: 'IT12345678901', website: 'https://acme.com', legal_name: 'Acme' },
    'fallback',
  );
  assert.equal(r.matchedVia, 'vat_id');
  assert.equal(r.entityAnchor, 'vat_id:IT12345678901');
  assert.equal(r.strength, 0.95);
});

test('resolveMatchKey: falls through to website_domain when vat_id missing', () => {
  const r = resolveMatchKey(
    tenantKeys,
    { vat_id: null, website: 'https://WWW.ACME.COM', legal_name: 'Acme' },
    'fallback',
  );
  assert.equal(r.matchedVia, 'website_domain');
  assert.equal(r.entityAnchor, 'website_domain:acme.com');
  assert.ok(r.strength < 0.95 && r.strength >= 0.8);
});

test('resolveMatchKey: falls through to legal_name as last resort', () => {
  const r = resolveMatchKey(
    tenantKeys,
    { vat_id: null, website: null, legal_name: 'Acme S.p.A.' },
    'fallback',
  );
  assert.equal(r.matchedVia, 'legal_name');
  assert.equal(r.entityAnchor, 'legal_name:acme s.p.a.');
});

test('resolveMatchKey: returns fallback target_record_id when nothing matches', () => {
  const r = resolveMatchKey(tenantKeys, { vat_id: '', website: '' }, 'target-uuid-1');
  assert.equal(r.matchedVia, null);
  assert.equal(r.entityAnchor, 'target-uuid-1');
  assert.equal(r.strength, 0.5);
});

test('resolveMatchKey: uppercases vat, lowercases legal_name (deterministic)', () => {
  const a = resolveMatchKey(tenantKeys, { vat_id: 'it12345678901' }, 'fb');
  const b = resolveMatchKey(tenantKeys, { vat_id: 'IT12345678901' }, 'fb');
  assert.equal(a.entityAnchor, b.entityAnchor);
  assert.equal(a.entityAnchor, 'vat_id:IT12345678901');
});

test('resolveMatchKey: industry classification (single match_key)', () => {
  const r = resolveMatchKey(['code'], { code: '64.19', name_it: 'Banche' }, 'fb');
  assert.equal(r.matchedVia, 'code');
  assert.equal(r.entityAnchor, 'code:64.19');
  assert.equal(r.strength, 0.95);
});
