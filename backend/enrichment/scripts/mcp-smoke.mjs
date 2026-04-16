#!/usr/bin/env node
// Raw JSON-RPC smoke test for the Heuresys Enrichment MCP server.
// Spawns `node dist/mcp/cli.js`, performs the initialize handshake, then
// calls tools/list and a sample tools/call. Prints a concise summary and
// exits non-zero on any mismatch.
//
// Usage:
//   DATABASE_URL=... node scripts/mcp-smoke.mjs
//   DATABASE_URL=... TENANT_CODE=rtl-bank node scripts/mcp-smoke.mjs
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const CLI = resolve(process.cwd(), 'dist/mcp/cli.js');
const TENANT_CODE = process.env.TENANT_CODE ?? 'rtl-bank';

function fail(msg, extra) {
  console.error(`FAIL: ${msg}`);
  if (extra !== undefined) console.error(JSON.stringify(extra, null, 2));
  process.exit(1);
}

function send(child, payload) {
  child.stdin.write(JSON.stringify(payload) + '\n');
}

async function main() {
  const env = { ...process.env, NODE_ENV: 'test' };
  const child = spawn(process.execPath, [CLI], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env,
  });

  const replies = new Map(); // id -> resolve
  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      console.error(`garbled stdout: ${line}`);
      return;
    }
    if (msg.id !== undefined && replies.has(msg.id)) {
      replies.get(msg.id)(msg);
      replies.delete(msg.id);
    }
  });

  let nextId = 1;
  function rpc(method, params) {
    const id = nextId++;
    return new Promise((resolveP, rejectP) => {
      replies.set(id, resolveP);
      send(child, { jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (replies.has(id)) {
          replies.delete(id);
          rejectP(new Error(`timeout on method ${method}`));
        }
      }, 10_000);
    });
  }

  // 1. initialize
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-smoke', version: '0.1.0' },
  });
  if (init.error) fail('initialize error', init);
  if (!init.result?.serverInfo) fail('no serverInfo', init);
  console.log(`initialize ok: ${init.result.serverInfo.name} v${init.result.serverInfo.version}`);

  // After initialize, the client must send the initialized notification.
  send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });

  // 2. tools/list
  const list = await rpc('tools/list', {});
  if (list.error) fail('tools/list error', list);
  const names = list.result.tools.map((t) => t.name);
  const expected = ['list_descriptors', 'preview_descriptor', 'list_policies', 'get_job_status', 'list_recent_jobs'];
  for (const e of expected) {
    if (!names.includes(e)) fail(`missing tool ${e}`, names);
  }
  console.log(`tools/list ok: ${names.join(', ')}`);

  // 3. tools/call list_descriptors
  const call1 = await rpc('tools/call', {
    name: 'list_descriptors',
    arguments: {},
  });
  if (call1.error) fail('list_descriptors call error', call1);
  if (call1.result?.isError) fail('list_descriptors returned isError', call1.result);
  const c1Text = call1.result?.content?.[0]?.text;
  if (!c1Text) fail('list_descriptors empty content', call1.result);
  const parsed1 = JSON.parse(c1Text);
  if (typeof parsed1.count !== 'number') fail('list_descriptors: no count', parsed1);
  console.log(`list_descriptors ok: count=${parsed1.count}`);

  // 4. tools/call list_recent_jobs (tenant-scoped)
  const call2 = await rpc('tools/call', {
    name: 'list_recent_jobs',
    arguments: { tenant_code: TENANT_CODE, limit: 5 },
  });
  if (call2.error) fail('list_recent_jobs call error', call2);
  if (call2.result?.isError) fail('list_recent_jobs returned isError', call2.result);
  const parsed2 = JSON.parse(call2.result.content[0].text);
  if (parsed2.tenant?.code !== TENANT_CODE) fail('unexpected tenant in response', parsed2);
  console.log(`list_recent_jobs ok: tenant=${parsed2.tenant.code} count=${parsed2.count}`);

  // 5. tools/call with bad tenant
  const call3 = await rpc('tools/call', {
    name: 'list_recent_jobs',
    arguments: { tenant_code: 'definitely-does-not-exist' },
  });
  if (!call3.result?.isError) fail('expected isError for bad tenant', call3.result);
  console.log(`bad tenant correctly returned isError: ${call3.result.content[0].text.slice(0, 80)}...`);

  child.kill('SIGTERM');
  console.log('ALL PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error('smoke crashed:', err);
  process.exit(2);
});
