// Tests for the MCP server module — tool list shape + tenant resolver.
// Uses node:test, requires live DB (same as the smoke harness).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_NAMES, buildServer } from '../dist/mcp/server.js';
import { resolveTenant } from '../dist/mcp/tenant-resolver.js';
import { pool } from '../dist/db/pool.js';

test('TOOL_NAMES exports the 5 expected read-only tools in declaration order', () => {
  assert.deepEqual(TOOL_NAMES, [
    'list_descriptors',
    'preview_descriptor',
    'list_policies',
    'get_job_status',
    'list_recent_jobs',
  ]);
});

test('buildServer returns a Server instance without throwing', () => {
  const server = buildServer();
  assert.ok(server, 'server should be non-null');
  assert.equal(typeof server.connect, 'function', 'Server.connect should be a function');
});

test('resolveTenant accepts a valid tenant code', async () => {
  const t = await resolveTenant('rtl-bank');
  assert.equal(t.code, 'rtl-bank');
  assert.match(t.id, /^[0-9a-f-]{36}$/i);
  assert.ok(t.name && t.name.length > 0);
});

test('resolveTenant accepts a valid tenant UUID', async () => {
  const rtl = await resolveTenant('rtl-bank');
  const byId = await resolveTenant(rtl.id);
  assert.equal(byId.code, 'rtl-bank');
  assert.equal(byId.id, rtl.id);
});

test('resolveTenant throws on missing code', async () => {
  await assert.rejects(() => resolveTenant('definitely-does-not-exist'), /not found/);
});

test('resolveTenant rejects empty input', async () => {
  await assert.rejects(() => resolveTenant(''), /required/);
});

test('resolveTenant rejects malformed UUID', async () => {
  // Non-UUID format is treated as a code and fails the code lookup.
  await assert.rejects(() => resolveTenant('not-a-valid-uuid-but-long-enough'), /not found/);
});

test.after(async () => {
  await pool.end();
});
