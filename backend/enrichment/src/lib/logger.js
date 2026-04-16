import { pino, destination } from 'pino';
import { env } from '../config/env.js';
// When running as an MCP server, stdout is reserved for the JSON-RPC protocol.
// Set LOG_TO_STDERR=1 (done by the MCP entrypoint) to redirect all pino output
// to file descriptor 2.
const toStderr = process.env.LOG_TO_STDERR === '1';
export const logger = pino({
    name: 'enrichment-engine',
    level: env.logLevel,
    base: {
        service: 'enrichment-engine',
        env: env.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label }),
    },
}, toStderr ? destination(2) : destination(1));
export function childLogger(bindings) {
    return logger.child(bindings);
}
//# sourceMappingURL=logger.js.map