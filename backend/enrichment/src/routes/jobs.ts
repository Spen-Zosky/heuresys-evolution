import { Router, type Request, type Response } from 'express';
import { updateJobStatus, recordJobEvent } from '../db/jobs.js';
import { pool, withTenantClient, assertTenantId } from '../db/pool.js';
import { commitJob } from '../merge/apply.js';
import { rollbackJob } from '../merge/rollback.js';
import { createJobRow } from '../pipeline/run.js';
import { enqueueEnrichmentJob } from '../queue/queue.js';

export const jobsRouter: Router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveTenantId(req: Request): string {
  const header = req.header('x-tenant-id');
  const body = (req.body as { tenant_id?: unknown } | undefined)?.tenant_id;
  const candidate = typeof header === 'string' && header.length > 0 ? header : typeof body === 'string' ? body : null;
  if (!candidate) {
    throw createError(400, 'MISSING_TENANT', 'x-tenant-id header or body.tenant_id is required');
  }
  try {
    assertTenantId(candidate);
  } catch (err) {
    throw createError(400, 'INVALID_TENANT', (err as Error).message);
  }
  return candidate;
}

interface HttpError extends Error {
  statusCode: number;
  code: string;
}

function createError(statusCode: number, code: string, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof Error) {
    const httpErr = err as Partial<HttpError>;
    const statusCode = typeof httpErr.statusCode === 'number' ? httpErr.statusCode : 500;
    const code = typeof httpErr.code === 'string' ? httpErr.code : 'INTERNAL_ERROR';
    res.status(statusCode).json({ success: false, error: { code, message: err.message } });
    return;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'unknown error' } });
}

interface CreateJobBody {
  entity_name: string;
  target_record_id: string;
  url: string;
  mode?: 'suggest' | 'merge' | 'observe';
}

function parseCreateBody(body: unknown): CreateJobBody {
  if (!body || typeof body !== 'object') {
    throw createError(400, 'INVALID_BODY', 'request body must be JSON object');
  }
  const b = body as Record<string, unknown>;
  if (typeof b.entity_name !== 'string' || b.entity_name.length === 0) {
    throw createError(400, 'INVALID_ENTITY_NAME', 'entity_name is required');
  }
  if (typeof b.target_record_id !== 'string' || b.target_record_id.length === 0) {
    throw createError(400, 'INVALID_TARGET', 'target_record_id is required');
  }
  if (typeof b.url !== 'string' || !/^https?:\/\//.test(b.url)) {
    throw createError(400, 'INVALID_URL', 'url must start with http:// or https://');
  }
  const mode = b.mode;
  if (mode !== undefined && mode !== 'suggest' && mode !== 'merge' && mode !== 'observe') {
    throw createError(400, 'INVALID_MODE', "mode must be 'suggest' | 'merge' | 'observe'");
  }
  return { entity_name: b.entity_name, target_record_id: b.target_record_id, url: b.url, mode: mode as CreateJobBody['mode'] };
}

export async function createJobHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = resolveTenantId(req);
    const body = parseCreateBody(req.body);

    // Reserve the job row synchronously (enables idempotency check).
    const { jobId, cached } = await createJobRow({
      tenantId,
      entityName: body.entity_name,
      targetRecordId: body.target_record_id,
      url: body.url,
      mode: body.mode,
    });

    if (cached) {
      await withTenantClient(tenantId, (c) => updateJobStatus(jobId, 'cached', undefined, c));
      res.status(200).json({ success: true, data: { jobId, cached: true, message: 'idempotency hit' } });
      return;
    }

    // Enqueue for async processing by the BullMQ worker.
    await enqueueEnrichmentJob({
      jobId,
      tenantId,
      entityName: body.entity_name,
      targetRecordId: body.target_record_id,
      url: body.url,
      mode: body.mode,
    });
    await withTenantClient(tenantId, (c) =>
      recordJobEvent(jobId, tenantId, 'job.queued', { queue: 'enrichment-jobs' }, c),
    );

    res.status(202).json({
      success: true,
      data: { jobId, cached: false, status: 'queued', pollUrl: `/api/v1/jobs/${jobId}` },
    });
  } catch (err) {
    sendError(res, err);
  }
}

jobsRouter.post('/', createJobHandler);

jobsRouter.get('/:id', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      throw createError(400, 'INVALID_ID', 'id must be a UUID');
    }
    const result = await withTenantClient(tenantId, (c) =>
      c.query(
        `SELECT id, tenant_id, descriptor_id, target_table, target_record_id, mode, status,
                idempotency_key, freshness_days, llm_cost_eur, error_details,
                created_at, completed_at
           FROM enrichment_jobs
          WHERE id = $1::uuid AND tenant_id = $2::uuid
          LIMIT 1`,
        [id, tenantId],
      ),
    );
    if (result.rows.length === 0) {
      throw createError(404, 'NOT_FOUND', `job ${id} not found`);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err);
  }
});

jobsRouter.get('/', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;
    const offsetRaw = Number(req.query.offset ?? 0);
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

    const clauses: string[] = ['j.tenant_id = $1::uuid'];
    const params: unknown[] = [tenantId];
    if (status) {
      params.push(status);
      clauses.push(`j.status = $${params.length}`);
    }
    const where = `WHERE ${clauses.join(' AND ')}`;
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const listResult = await withTenantClient(tenantId, (c) =>
      c.query(
        `SELECT j.id, j.status, d.entity_name AS descriptor_name, j.target_record_id, j.mode,
                j.idempotency_key, j.llm_cost_eur, j.created_at, j.completed_at
           FROM enrichment_jobs j
           JOIN enrichment_entity_descriptors d ON d.id = j.descriptor_id
           ${where}
          ORDER BY j.created_at DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params,
      ),
    );
    const countParams = params.slice(0, params.length - 2);
    const countResult = await withTenantClient(tenantId, (c) =>
      c.query(
        `SELECT COUNT(*)::int AS total
           FROM enrichment_jobs j
           ${where}`,
        countParams,
      ),
    );
    res.json({
      success: true,
      data: {
        items: listResult.rows,
        total: countResult.rows[0]?.total ?? 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

jobsRouter.delete('/:id', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      throw createError(400, 'INVALID_ID', 'id must be a UUID');
    }
    const result = await withTenantClient(tenantId, async (c) => {
      const existing = await c.query(
        `SELECT id, status FROM enrichment_jobs
          WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
        [id, tenantId],
      );
      if (existing.rows.length === 0) {
        throw createError(404, 'NOT_FOUND', `job ${id} not found`);
      }
      const current = existing.rows[0].status as string;
      if (['committed', 'failed', 'cached', 'rolled_back'].includes(current)) {
        throw createError(409, 'JOB_TERMINAL', `cannot cancel job in terminal status '${current}'`);
      }
      await updateJobStatus(id, 'rolled_back', { cause: 'user_cancelled' }, c);
      await recordJobEvent(id, tenantId, 'job.cancelled', { previous_status: current }, c);
      return { id, previousStatus: current };
    });
    res.json({ success: true, data: { ...result, status: 'rolled_back' } });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * POST /api/v1/jobs/:id/commit
 * SEE Fase 7 — applies candidates to the target business table.
 *
 * Body (all optional):
 *   - approved_candidate_ids: string[] — explicit operator approval list.
 *     Required when the job's policy mode is 'suggest' (default). Candidates
 *     not in the list are skipped with reason "awaiting approval".
 *   - force_mode: 'merge' | 'suggest' | 'observe' — override the policy
 *     top-level mode for this single commit (e.g. force auto-apply).
 *
 * Returns a per-candidate summary: applied / skipped / unmapped /
 * already_committed + the previous value captured in the L4 ledger.
 */
jobsRouter.post('/:id/commit', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      throw createError(400, 'INVALID_ID', 'id must be a UUID');
    }
    const body = (req.body ?? {}) as {
      approved_candidate_ids?: unknown;
      force_mode?: unknown;
    };
    const approved = Array.isArray(body.approved_candidate_ids)
      ? body.approved_candidate_ids.filter((x): x is string => typeof x === 'string')
      : undefined;
    const forceMode =
      body.force_mode === 'merge' || body.force_mode === 'suggest' || body.force_mode === 'observe'
        ? body.force_mode
        : undefined;

    const result = await commitJob({
      tenantId,
      jobId: id,
      approvedCandidateIds: approved,
      forceMode,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * POST /api/v1/jobs/:id/rollback
 * SEE Fase 7 — reverts every enrichment_writes row for the job, setting
 * each target column back to its previous_value captured at commit time.
 */
jobsRouter.post('/:id/rollback', async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      throw createError(400, 'INVALID_ID', 'id must be a UUID');
    }
    const result = await rollbackJob(tenantId, id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// Expose the pool import to keep tree-shaking honest — pool is used transitively
// by db/*.ts via withTenantClient.
void pool;
