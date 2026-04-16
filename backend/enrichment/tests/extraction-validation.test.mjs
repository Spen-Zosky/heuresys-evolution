// Tests for SEE Fase 5 step 2: Zod schemas + validateExtractedByEntity.
// Uses node:test (Node >= 20). No network, no LLM calls — pure validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  TenantProfileV1Schema,
  IndustryClassificationEnrichmentV1Schema,
  validateExtractedByEntity,
} = await import('../dist/extraction/schemas.js');

// ---- TenantProfileV1 -------------------------------------------------------

test('TenantProfileV1: accepts fully populated valid record', () => {
  const input = {
    legal_name: 'Acme S.p.A.',
    website: 'https://acme.example/',
    vat_id: 'IT12345678901',
    country_code: 'IT',
    headquarters_city: 'Milano',
    industry_hint: 'Media',
    description: 'An example company.',
  };
  const parsed = TenantProfileV1Schema.parse(input);
  assert.equal(parsed.legal_name, 'Acme S.p.A.');
  assert.equal(parsed.country_code, 'IT');
  assert.equal(parsed.vat_id, 'IT12345678901');
});

test('TenantProfileV1: uppercases country_code and vat_id', () => {
  const parsed = TenantProfileV1Schema.parse({
    legal_name: 'Lowercase',
    country_code: 'it',
    vat_id: 'it12345678901',
  });
  assert.equal(parsed.country_code, 'IT');
  assert.equal(parsed.vat_id, 'IT12345678901');
});

test('TenantProfileV1: null values allowed per field', () => {
  const parsed = TenantProfileV1Schema.parse({
    legal_name: 'Minimal',
    website: null,
    vat_id: null,
    country_code: null,
  });
  assert.equal(parsed.website, null);
  assert.equal(parsed.vat_id, null);
});

test('TenantProfileV1: rejects invalid URL', () => {
  assert.throws(() =>
    TenantProfileV1Schema.parse({ legal_name: 'X', website: 'not-a-url' }),
  );
});

test('TenantProfileV1: rejects malformed country_code', () => {
  assert.throws(() =>
    TenantProfileV1Schema.parse({ legal_name: 'X', country_code: 'ITA' }),
  );
});

test('TenantProfileV1: rejects malformed vat_id', () => {
  assert.throws(() =>
    TenantProfileV1Schema.parse({ legal_name: 'X', vat_id: '12345' }),
  );
});

test('TenantProfileV1: rejects description over 1000 chars', () => {
  assert.throws(() =>
    TenantProfileV1Schema.parse({
      legal_name: 'X',
      description: 'a'.repeat(1001),
    }),
  );
});

test('TenantProfileV1: rejects unknown extra keys (.strict)', () => {
  assert.throws(() =>
    TenantProfileV1Schema.parse({ legal_name: 'X', foo_bar: 'extra' }),
  );
});

// ---- IndustryClassificationEnrichmentV1 ------------------------------------

test('Industry: accepts minimal record', () => {
  const parsed = IndustryClassificationEnrichmentV1Schema.parse({
    code: '64.19',
    name_it: 'Altri istituti di credito',
  });
  assert.equal(parsed.code, '64.19');
});

test('Industry: sample_activities array is bounded', () => {
  assert.throws(() =>
    IndustryClassificationEnrichmentV1Schema.parse({
      code: 'A',
      sample_activities: new Array(21).fill('x'),
    }),
  );
});

// ---- Registry dispatcher ---------------------------------------------------

test('validateExtractedByEntity: tenant_profile happy path', () => {
  const out = validateExtractedByEntity('tenant_profile', {
    legal_name: 'Heuresys',
    country_code: 'it',
    website: 'https://heuresys.com',
  });
  assert.equal(out.country_code, 'IT');
});

test('validateExtractedByEntity: unknown entity passes through unchanged', () => {
  const raw = { anything: 'goes', even_bad_types: 42 };
  const out = validateExtractedByEntity('no_such_entity', raw);
  assert.deepEqual(out, raw);
});

test('validateExtractedByEntity: throws ZodError on invalid record', () => {
  assert.throws(
    () =>
      validateExtractedByEntity('tenant_profile', {
        legal_name: 'X',
        website: 'not-a-url',
      }),
    (err) => err.name === 'ZodError',
  );
});
