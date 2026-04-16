import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProviderStatuses, getActiveProviders } from '../dist/config/env.js';

test('getActiveProviders returns empty when no keys present', () => {
  const active = getActiveProviders({});
  assert.deepEqual(active, []);
});

test('getActiveProviders accepts a valid anthropic key', () => {
  const active = getActiveProviders({
    ANTHROPIC_API_KEY: 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890',
  });
  assert.deepEqual(active, ['anthropic']);
});

test('getProviderStatuses flags anthropic placeholder as invalid-prefix', () => {
  const statuses = getProviderStatuses({
    ANTHROPIC_API_KEY: 'your-anthropic-api-key',
  });
  const anth = statuses.find((s) => s.name === 'anthropic');
  assert.equal(anth.active, false);
  assert.match(anth.reason, /invalid-prefix/);
});

test('getProviderStatuses flags short keys as placeholder', () => {
  const statuses = getProviderStatuses({
    OPENAI_API_KEY: 'sk-123', // too short
  });
  const oai = statuses.find((s) => s.name === 'openai');
  assert.equal(oai.active, false);
  assert.match(oai.reason, /too-short/);
});

test('getActiveProviders accepts openai + gemini together', () => {
  const active = getActiveProviders({
    OPENAI_API_KEY: 'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
    GEMINI_API_KEY: 'AIzaSy-abcdefghijklmnopqrstuvwx',
  });
  assert.deepEqual(active.sort(), ['gemini', 'openai']);
});
