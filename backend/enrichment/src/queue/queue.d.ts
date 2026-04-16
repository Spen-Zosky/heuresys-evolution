import { Queue } from 'bullmq';
export declare const QUEUE_NAME = "enrichment-jobs";
export interface EnrichmentQueuePayload {
    jobId: string;
    tenantId: string;
    entityName: string;
    targetRecordId: string;
    url: string;
    mode?: 'suggest' | 'merge' | 'observe';
}
export declare const enrichmentQueue: Queue<EnrichmentQueuePayload, any, string, EnrichmentQueuePayload, any, string>;
export declare function enqueueEnrichmentJob(payload: EnrichmentQueuePayload): Promise<string>;
export declare function closeQueue(): Promise<void>;
//# sourceMappingURL=queue.d.ts.map