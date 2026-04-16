import express from 'express';
import { env, logProviderStartup, getActiveProviders } from './config/env.js';
import { pool } from './db/pool.js';
import { jobsRouter } from './routes/jobs.js';
import { metricsRouter } from './routes/metrics.js';
import { startWorker, stopWorker } from './worker/processor.js';
import { startBudgetResetScheduler, stopBudgetResetScheduler } from './worker/budget-reset.js';
import { closeQueue } from './queue/queue.js';
import { logger } from './lib/logger.js';
const bootLogger = {
    info: (msg) => logger.info(msg),
    warn: (msg) => logger.warn(msg),
    error: (msg) => logger.error(msg),
};
logProviderStartup(bootLogger);
const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            success: true,
            data: {
                status: 'ok',
                service: 'enrichment-engine',
                version: '0.2.0-fase2',
                providers: getActiveProviders(),
                workerEnabled: env.workerEnabled,
            },
        });
    }
    catch {
        res.status(503).json({
            success: false,
            error: { code: 'DB_UNAVAILABLE', message: 'Database not reachable' },
        });
    }
});
app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/metrics', metricsRouter);
const server = app.listen(env.port, () => {
    bootLogger.info(`[enrichment-engine] listening on :${env.port}`);
});
if (env.workerEnabled) {
    startWorker(bootLogger);
    void startBudgetResetScheduler();
    bootLogger.info('[enrichment-engine] embedded worker + budget-reset scheduler enabled');
}
else {
    bootLogger.info('[enrichment-engine] embedded worker DISABLED (ENRICHMENT_WORKER_ENABLED=false)');
}
async function gracefulShutdown(signal) {
    bootLogger.info(`[enrichment-engine] ${signal} received — shutting down`);
    server.close();
    try {
        await stopBudgetResetScheduler();
        await stopWorker();
        await closeQueue();
        await pool.end();
    }
    catch (err) {
        bootLogger.error(`[enrichment-engine] shutdown error: ${err.message}`);
    }
    process.exit(0);
}
process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
});
//# sourceMappingURL=index.js.map