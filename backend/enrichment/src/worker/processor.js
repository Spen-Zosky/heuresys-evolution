import { Worker } from 'bullmq';
import { getRedisConnection } from '../config/env.js';
import { loadDescriptor } from '../db/descriptors.js';
import { runPipeline, markJobFailed } from '../pipeline/run.js';
import { QUEUE_NAME } from '../queue/queue.js';
let worker = null;
export function startWorker(logger) {
    if (worker)
        return worker;
    worker = new Worker(QUEUE_NAME, async (job) => {
        const { jobId, tenantId, entityName, targetRecordId, url, mode } = job.data;
        logger.info(`[worker] processing job=${jobId} tenant=${tenantId} url=${url}`);
        try {
            // Re-load descriptor from DB (workers may run in a different process
            // than the request that enqueued the job).
            const descriptor = await loadDescriptor(entityName);
            const result = await runPipeline(jobId, { tenantId, entityName, targetRecordId, url, mode }, descriptor);
            logger.info(`[worker] job=${jobId} completed candidates=${result.candidates?.length ?? 0}`);
            return result;
        }
        catch (err) {
            const error = err;
            logger.error(`[worker] job=${jobId} failed: ${error.message}`);
            try {
                await markJobFailed(tenantId, jobId, error);
            }
            catch (markErr) {
                logger.error(`[worker] markJobFailed also failed for job=${jobId}: ${markErr.message}`);
            }
            throw err;
        }
    }, {
        connection: getRedisConnection(),
        concurrency: Number(process.env.ENRICHMENT_WORKER_CONCURRENCY ?? '2'),
    });
    worker.on('ready', () => logger.info('[worker] ready'));
    worker.on('error', (err) => logger.error(`[worker] bullmq error: ${err.message}`));
    worker.on('failed', (job, err) => {
        const id = job?.id ?? 'unknown';
        logger.warn(`[worker] job=${id} attempt failed (${job?.attemptsMade}/${job?.opts?.attempts ?? 1}): ${err.message}`);
    });
    return worker;
}
export async function stopWorker() {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
//# sourceMappingURL=processor.js.map