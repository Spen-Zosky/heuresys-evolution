import { Worker } from 'bullmq';
import { type PipelineResult } from '../pipeline/run.js';
import { type EnrichmentQueuePayload } from '../queue/queue.js';
export declare function startWorker(logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
}): Worker<EnrichmentQueuePayload, PipelineResult>;
export declare function stopWorker(): Promise<void>;
//# sourceMappingURL=processor.d.ts.map