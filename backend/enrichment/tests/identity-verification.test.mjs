// Tests for SEE Fase 7.5 extended — strong identity pre-flight.
// Pure — no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { verifyEntityIdentity } = await import('../dist/merge/identity-verification.js');

const tenant = {
  tenantTaxId: 'IT12345678901',
  tenantVerifiedWebsite: 'acme.com',
  tenantName: 'Acme S.p.A.',
};

// ---- happy path ----------------------------------------------------------

test('pre-flight PASS when extracted values align with tenant identity', () => {
  const r = verifyEntityIdentity({
    extractedValues: {
      vat_id: 'IT12345678901',
      website: 'https://www.acme.com/about',
      legal_name: 'ACME S.p.A.',
    },
    ...tenant,
  });
  assert.equal(r.verified, true);
  assert.equal(r.blocks.length, 0);
});

test('pre-flight PASS tolerates vat formatting (dots, spaces, case)', () => {
  const r = verifyEntityIdentity({
    extractedValues: { vat_id: 'it 1234 5678 901' },
    ...tenant,
  });
  assert.equal(r.verified, true);
});

test('pre-flight PASS tolerates www + case + path in website', () => {
  const r = verifyEntityIdentity({
    extractedValues: { website: 'HTTP://WWW.ACME.COM/contacts' },
    ...tenant,
  });
  assert.equal(r.verified, true);
});

test('pre-flight PASS when only non-identity fields extracted', () => {
  const r = verifyEntityIdentity({
    extractedValues: { description: 'anything', industry_hint: 'x' },
    ...tenant,
  });
  assert.equal(r.verified, true);
});

test('pre-flight PASS when tenant identity columns are NULL', () => {
  const r = verifyEntityIdentity({
    extractedValues: { vat_id: 'ZZ999', website: 'https://foo.bar/', legal_name: 'Foo' },
    tenantTaxId: null,
    tenantVerifiedWebsite: null,
    tenantName: null,
  });
  assert.equal(r.verified, true);
});

// ---- vat_id strict --------------------------------------------------------

test('pre-flight BLOCK on vat_id mismatch', () => {
  const r = verifyEntityIdentity({
    extractedValues: { vat_id: 'IT99999999999' },
    ...tenant,
  });
  assert.equal(r.verified, false);
  assert.equal(r.blocks[0].field, 'vat_id');
  assert.match(r.summary, /vat_id/);
});

// ---- website_domain strict ------------------------------------------------

test('pre-flight BLOCK on website domain mismatch', () => {
  const r = verifyEntityIdentity({
    extractedValues: { website: 'https://www.rtl.it/' },
    ...tenant,
  });
  assert.equal(r.verified, false);
  assert.equal(r.blocks[0].field, 'website');
  assert.match(r.summary, /website/);
});

// ---- legal_name zero overlap --------------------------------------------

test('pre-flight BLOCK on legal_name with zero token overlap', () => {
  const r = verifyEntityIdentity({
    extractedValues: { legal_name: 'Banca Popolare' },
    ...tenant,
  });
  assert.equal(r.verified, false);
  assert.equal(r.blocks[0].field, 'legal_name');
});

test('pre-flight ALLOWS legal_name with partial overlap', () => {
  const r = verifyEntityIdentity({
    extractedValues: { legal_name: 'Acme Holding' },
    ...tenant,
  });
  assert.equal(r.verified, true);
});

test('pre-flight strips legal-form suffixes when comparing name', () => {
  const r = verifyEntityIdentity({
    extractedValues: { legal_name: 'Acme Holding Limited' },
    tenantTaxId: null,
    tenantVerifiedWebsite: null,
    tenantName: 'Acme Holding S.r.l.',
  });
  assert.equal(r.verified, true);
});

// ---- aggregated failures --------------------------------------------------

test('pre-flight reports MULTIPLE blocks when several identities mismatch', () => {
  const r = verifyEntityIdentity({
    extractedValues: {
      vat_id: 'IT99999999999',
      website: 'https://www.rtl.it/',
      legal_name: 'RTL 102.5',
    },
    ...tenant,
  });
  assert.equal(r.verified, false);
  assert.equal(r.blocks.length, 3);
  const fields = r.blocks.map((b) => b.field).sort();
  assert.deepEqual(fields, ['legal_name', 'vat_id', 'website']);
});

// ---- the original bug, pre-flight layer behaviour ------------------------

test('pre-flight PASSES RTL Bank vs RTL 102.5 (single shared token); gate 2 catches it', () => {
  // With verified_website=NULL and tax_id=NULL, the pre-flight has
  // almost nothing to check. "RTL 102.5" vs "RTL Bank" normalises to
  // ["rtl","102"] vs ["rtl","bank"] — one shared >=3-char token, so the
  // zero-overlap rule does NOT fire. The downstream checkEntityMismatch
  // gate (threshold 0.6) is what blocks this case — intentional
  // defense-in-depth split.
  const r = verifyEntityIdentity({
    extractedValues: {
      website: 'https://www.rtl.it/',
      legal_name: 'RTL 102.5',
      country_code: 'IT',
      industry_hint: 'Radio Broadcasting',
    },
    tenantTaxId: null,
    tenantVerifiedWebsite: null,
    tenantName: 'RTL Bank',
  });
  assert.equal(r.verified, true);
});

test('pre-flight BLOCKS rtl.it when tenant has verified_website=rtl-bank.example', () => {
  // When onboarding has captured the real verified domain, Gate 1 of
  // the pre-flight fires immediately: rtl.it != rtl-bank.example.
  const r = verifyEntityIdentity({
    extractedValues: {
      website: 'https://www.rtl.it/',
      legal_name: 'RTL 102.5',
    },
    tenantTaxId: null,
    tenantVerifiedWebsite: 'rtl-bank.example',
    tenantName: 'RTL Bank',
  });
  assert.equal(r.verified, false);
  assert.ok(
    r.blocks.some((b) => b.field === 'website'),
    'expected website block',
  );
});
