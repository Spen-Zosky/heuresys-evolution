#!/usr/bin/env node
// MCP server CLI entrypoint for the Heuresys Enrichment Engine.
//
// Run it either via the compiled artifact:
//   node dist/mcp/cli.js
// or during development via tsx:
//   tsx src/mcp/cli.ts
//
// Stdout is reserved for the JSON-RPC MCP protocol — emit nothing there.
// All diagnostic output goes to stderr via pino (LOG_TO_STDERR=1 set below).
// These env tweaks must happen BEFORE importing other modules so that the
// logger and env singletons pick them up at module load.
process.env.LOG_TO_STDERR = '1';
process.env.ENRICHMENT_WORKER_ENABLED = 'false';
import { pool } from '../db/pool.js';
import { startMcpServer } from './server.js';
import { logger } from '../lib/logger.js';
async function main() {
    try {
        await pool.query('SELECT 1');
        logger.info('[mcp] db connection ok');
        await startMcpServer();
    }
    catch (err) {
        logger.error({ err }, '[mcp] fatal startup error');
        process.exit(1);
    }
}
async function shutdown(signal) {
    logger.info({ signal }, '[mcp] shutting down');
    try {
        await pool.end();
    }
    catch (err) {
        logger.error({ err }, '[mcp] pool.end error');
    }
    process.exit(0);
}
process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void shutdown('SIGINT');
});
void main();
//# sourceMappingURL=cli.js.map