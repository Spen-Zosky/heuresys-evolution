import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/env.js';
export const QUEUE_NAME = 'enrichment-jobs';
export const enrichmentQueue = new Queue(QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
    },
});
export async function enqueueEnrichmentJob(payload) {
    // Use the enrichment_jobs row id as the BullMQ job id so we get at-most-one
    // queued entry per row. Re-enqueuing the same id is a no-op.
    const bullJob = await enrichmentQueue.add('run', payload, { jobId: payload.jobId });
    return bullJob.id ?? payload.jobId;
}
export async function closeQueue() {
    await enrichmentQueue.close();
}
//# sourceMappingURL=queue.js.map