import 'dotenv/config';
export declare const env: {
    port: number;
    databaseUrl: string;
    redisHost: string;
    redisPort: number;
    redisPassword: string | null;
    anthropicApiKey: string | undefined;
    openaiApiKey: string | undefined;
    geminiApiKey: string | undefined;
    logLevel: string;
    nodeEnv: string;
    workerEnabled: boolean;
    firecrawlApiKey: string | undefined;
    firecrawlBaseUrl: string;
    acquisitionBackend: "auto" | "firecrawl" | "plain_fetch";
    firecrawlTimeoutMs: number;
    firecrawlMaxDepth: number;
    firecrawlMaxPages: number;
    defaultLlmProvider: "anthropic" | "openai" | "gemini";
    budgetResetCron: string;
};
export interface RedisConnectionOptions {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
}
/**
 * BullMQ requires `maxRetriesPerRequest: null` on the connection options so
 * long-lived blocking commands (BRPOPLPUSH) do not get cancelled by ioredis.
 */
export declare function getRedisConnection(): RedisConnectionOptions;
export type ProviderName = 'anthropic' | 'openai' | 'gemini';
export interface ProviderStatus {
    name: ProviderName;
    active: boolean;
    reason?: string;
}
export declare function getProviderStatuses(source?: NodeJS.ProcessEnv): ProviderStatus[];
export declare function getActiveProviders(source?: NodeJS.ProcessEnv): ProviderName[];
export declare function logProviderStartup(logger: {
    warn: (msg: string) => void;
    info: (msg: string) => void;
}): void;
//# sourceMappingURL=env.d.ts.map