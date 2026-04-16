import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection, env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'enrichment-budget-reset';

interface BudgetResetResult {
  resetCount: number;
  policies: Array<{ id: string; code: string; previousUsageEur: number }>;
}

let queue: Queue | null = null;
let worker: Worker<void, BudgetResetResult> | null = null;

export async function startBudgetResetScheduler(): Promise<void> {
  if (worker) return;

  const connection = getRedisConnection();

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  // Add repeatable job based on cron expression
  await queue.upsertJobScheduler(
    'budget-reset-scheduler',
    { pattern: env.budgetResetCron },
    { name: 'budget-reset' },
  );

  worker = new Worker<void, BudgetResetResult>(
    QUEUE_NAME,
    async (_job: Job<void>) => {
      logger.info('[budget-reset] starting scheduled budget reset check');
      try {
        const result = await pool.query<{
          id: string;
          code: string;
          previous_usage: string;
        }>(
          `UPDATE enrichment_merge_policies
              SET current_usage_eur = 0,
                  budget_reset_at = NOW()
            WHERE is_active = true
              AND current_usage_eur > 0
              AND budget_reset_at + budget_reset_interval <= NOW()
          RETURNING id, code, current_usage_eur::text AS previous_usage`,
        );

        const policies = result.rows.map((row) => ({
          id: row.id,
          code: row.code,
          previousUsageEur: Number(row.previous_usage),
        }));

        for (const p of policies) {
          logger.info(
            { policyId: p.id, code: p.code, previousUsageEur: p.previousUsageEur },
            `[budget-reset] reset policy ${p.code} (was €${p.previousUsageEur.toFixed(4)})`,
          );
        }

        if (policies.length === 0) {
          logger.info('[budget-reset] no policies needed reset');
        } else {
          logger.info(`[budget-reset] reset ${policies.length} policy budget(s)`);
        }

        return { resetCount: policies.length, policies };
      } catch (err) {
        const error = err as Error;
        logger.error(
          { err: error.message, stack: error.stack },
          `[budget-reset] failed: ${error.message}`,
        );
        throw err;
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('ready', () => logger.info('[budget-reset] worker ready'));
  worker.on('error', (err) => logger.error(`[budget-reset] bullmq error: ${err.message}`));
  worker.on('failed', (job, err) => {
    const id = job?.id ?? 'unknown';
    logger.error(
      { jobId: id, attempts: job?.attemptsMade, error: err.message },
      `[budget-reset] job=${id} failed (${job?.attemptsMade}/${job?.opts?.attempts ?? 1}): ${err.message}`,
    );
  });

  logger.info(`[budget-reset] scheduler started with cron="${env.budgetResetCron}"`);
}

export async function stopBudgetResetScheduler(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
