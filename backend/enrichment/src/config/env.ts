import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional('ENRICHMENT_PORT', '8020')),
  databaseUrl: required('DATABASE_URL'),
  redisHost: optional('REDIS_HOST', 'localhost'),
  redisPort: Number(optional('REDIS_PORT', '6380')),
  redisPassword: process.env.REDIS_PASSWORD ?? null,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  logLevel: optional('LOG_LEVEL', 'info'),
  nodeEnv: optional('NODE_ENV', 'development'),
  workerEnabled: (process.env.ENRICHMENT_WORKER_ENABLED ?? 'true') !== 'false',
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  firecrawlBaseUrl: optional('FIRECRAWL_BASE_URL', 'https://api.firecrawl.dev'),
  acquisitionBackend: optional('ACQUISITION_BACKEND', 'auto') as 'auto' | 'firecrawl' | 'plain_fetch',
  firecrawlTimeoutMs: Number(optional('FIRECRAWL_TIMEOUT_MS', '30000')),
  firecrawlMaxDepth: Number(optional('FIRECRAWL_MAX_DEPTH', '2')),
  firecrawlMaxPages: Number(optional('FIRECRAWL_MAX_PAGES', '10')),
  defaultLlmProvider: optional('DEFAULT_LLM_PROVIDER', 'anthropic') as 'anthropic' | 'openai' | 'gemini',
  budgetResetCron: optional('ENRICHMENT_BUDGET_RESET_CRON', '0 * * * *'),
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
export function getRedisConnection(): RedisConnectionOptions {
  const opts: RedisConnectionOptions = {
    host: env.redisHost,
    port: env.redisPort,
    maxRetriesPerRequest: null,
  };
  if (env.redisPassword) {
    opts.password = env.redisPassword;
  }
  return opts;
}

export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export interface ProviderStatus {
  name: ProviderName;
  active: boolean;
  reason?: string;
}

const PROVIDER_PREFIXES: Record<ProviderName, string> = {
  anthropic: 'sk-ant-',
  openai: 'sk-',
  gemini: '',
};

export function getProviderStatuses(source: NodeJS.ProcessEnv = process.env): ProviderStatus[] {
  const checks: Array<{ name: ProviderName; envKey: string }> = [
    { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
    { name: 'openai', envKey: 'OPENAI_API_KEY' },
    { name: 'gemini', envKey: 'GEMINI_API_KEY' },
  ];

  return checks.map(({ name, envKey }) => {
    const raw = source[envKey];
    if (!raw || raw.trim().length === 0) {
      return { name, active: false, reason: 'missing' };
    }
    const prefix = PROVIDER_PREFIXES[name];
    if (prefix && !raw.startsWith(prefix)) {
      return { name, active: false, reason: `invalid-prefix (expected ${prefix}*)` };
    }
    if (raw.length < 20) {
      return { name, active: false, reason: 'too-short (likely placeholder)' };
    }
    return { name, active: true };
  });
}

export function getActiveProviders(source: NodeJS.ProcessEnv = process.env): ProviderName[] {
  return getProviderStatuses(source)
    .filter((p) => p.active)
    .map((p) => p.name);
}

export function logProviderStartup(logger: { warn: (msg: string) => void; info: (msg: string) => void }): void {
  const statuses = getProviderStatuses();
  const active = statuses.filter((s) => s.active).map((s) => s.name);
  const inactive = statuses.filter((s) => !s.active);

  if (active.length === 0) {
    logger.warn('[env] NO LLM PROVIDERS ACTIVE — extraction will fail. Configure at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY.');
  } else {
    logger.info(`[env] active LLM providers: ${active.join(', ')}`);
  }

  for (const s of inactive) {
    logger.warn(`[env] provider ${s.name} INACTIVE: ${s.reason}`);
  }
}
