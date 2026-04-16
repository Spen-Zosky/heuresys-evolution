import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { pool, withTenantClient } from '../db/pool.js';
import { resolveTenant } from './tenant-resolver.js';
import { logger } from '../lib/logger.js';
const TOOL_ERROR_PREFIX = '[enrichment-mcp] error: ';
function textResult(payload) {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    return { content: [{ type: 'text', text }] };
}
function errorResult(message) {
    return { content: [{ type: 'text', text: `${TOOL_ERROR_PREFIX}${message}` }], isError: true };
}
function requireString(args, key) {
    const v = args[key];
    if (typeof v !== 'string' || v.length === 0) {
        throw new Error(`missing required string argument '${key}'`);
    }
    return v;
}
function optionalString(args, key) {
    const v = args[key];
    if (v === undefined || v === null)
        return undefined;
    if (typeof v !== 'string' || v.length === 0) {
        throw new Error(`argument '${key}' must be a non-empty string when provided`);
    }
    return v;
}
function optionalNumber(args, key, def, min, max) {
    const v = args[key];
    if (v === undefined || v === null)
        return def;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`argument '${key}' must be a number`);
    }
    const n = Math.trunc(v);
    if (n < min || n > max) {
        throw new Error(`argument '${key}' must be between ${min} and ${max}`);
    }
    return n;
}
const VALID_JOB_STATUSES = new Set([
    'pending',
    'discovering',
    'crawling',
    'extracting',
    'resolving',
    'previewing',
    'committed',
    'failed',
    'cached',
    'rolled_back',
]);
const TOOLS = [
    // ---------------------------------------------------------------------------
    // 1) list_descriptors
    // ---------------------------------------------------------------------------
    {
        name: 'list_descriptors',
        description: 'Lists all active enrichment entity descriptors (platform-scoped). Each descriptor defines what entity the engine can enrich, which target table it writes to, and which extraction schema and default merge policy it uses.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => {
            const result = await pool.query(`SELECT d.id, d.entity_name, d.target_table, d.pk_field, d.match_keys,
                d.default_mode, d.is_active,
                s.code AS extraction_schema_code, s.version AS extraction_schema_version,
                mp.code AS default_merge_policy_code
           FROM enrichment_entity_descriptors d
           JOIN enrichment_extraction_schemas s ON s.id = d.extraction_schema_id
           LEFT JOIN enrichment_merge_policies mp ON mp.id = d.default_merge_policy_id
          WHERE d.is_active = true
          ORDER BY d.entity_name ASC`);
            return textResult({ count: result.rows.length, descriptors: result.rows });
        },
    },
    // ---------------------------------------------------------------------------
    // 2) preview_descriptor
    // ---------------------------------------------------------------------------
    {
        name: 'preview_descriptor',
        description: 'Returns the full descriptor + extraction schema + default merge policy for a given entity_name. Use list_descriptors to discover valid entity_name values.',
        inputSchema: {
            type: 'object',
            properties: {
                entity_name: { type: 'string', description: 'The entity name (e.g. "tenant_profile")' },
            },
            required: ['entity_name'],
            additionalProperties: false,
        },
        handler: async (args) => {
            const entityName = requireString(args, 'entity_name');
            const result = await pool.query(`SELECT d.id, d.entity_name, d.target_table, d.pk_field, d.match_keys,
                d.source_strategy_jsonb AS source_strategy,
                d.default_mode, d.is_active,
                s.code AS extraction_schema_code, s.version AS extraction_schema_version,
                s.schema_jsonb AS extraction_schema,
                mp.id AS merge_policy_id, mp.code AS merge_policy_code,
                mp.rules_jsonb AS merge_policy_rules, mp.budget_cap_eur, mp.current_usage_eur
           FROM enrichment_entity_descriptors d
           JOIN enrichment_extraction_schemas s ON s.id = d.extraction_schema_id
           LEFT JOIN enrichment_merge_policies mp ON mp.id = d.default_merge_policy_id
          WHERE d.entity_name = $1 AND d.is_active = true
          ORDER BY d.tenant_id NULLS LAST
          LIMIT 1`, [entityName]);
            if (result.rows.length === 0) {
                return errorResult(`descriptor '${entityName}' not found`);
            }
            return textResult(result.rows[0]);
        },
    },
    // ---------------------------------------------------------------------------
    // 3) list_policies
    // ---------------------------------------------------------------------------
    {
        name: 'list_policies',
        description: 'Returns all active merge policies and trust rules. Platform-scoped rules apply to every tenant; tenant-scoped rules apply only when tenant_code is provided.',
        inputSchema: {
            type: 'object',
            properties: {
                tenant_code: {
                    type: 'string',
                    description: 'Optional tenant code (e.g. "rtl-bank") to include tenant-scoped overrides',
                },
            },
            additionalProperties: false,
        },
        handler: async (args) => {
            const tenantCode = optionalString(args, 'tenant_code');
            let tenantId = null;
            if (tenantCode) {
                const tenant = await resolveTenant(tenantCode);
                tenantId = tenant.id;
            }
            const policiesResult = await pool.query(`SELECT id, tenant_id, code, version, budget_cap_eur, current_usage_eur, is_active, created_at
           FROM enrichment_merge_policies
          WHERE is_active = true
            AND (tenant_id IS NULL ${tenantId ? 'OR tenant_id = $1::uuid' : ''})
          ORDER BY tenant_id NULLS FIRST, code ASC`, tenantId ? [tenantId] : []);
            const trustResult = await pool.query(`SELECT id, tenant_id, source_type, domain_pattern, trust_score, notes
           FROM enrichment_trust_rules
          WHERE tenant_id IS NULL ${tenantId ? 'OR tenant_id = $1::uuid' : ''}
          ORDER BY tenant_id NULLS FIRST, trust_score DESC`, tenantId ? [tenantId] : []);
            return textResult({
                tenant: tenantCode ?? null,
                merge_policies: { count: policiesResult.rows.length, items: policiesResult.rows },
                trust_rules: { count: trustResult.rows.length, items: trustResult.rows },
            });
        },
    },
    // ---------------------------------------------------------------------------
    // 4) get_job_status
    // ---------------------------------------------------------------------------
    {
        name: 'get_job_status',
        description: 'Returns full status of a single enrichment job: row from enrichment_jobs, ordered event timeline, and all candidate facts produced so far. Scoped to the given tenant — cross-tenant lookups return not found.',
        inputSchema: {
            type: 'object',
            properties: {
                tenant_code: { type: 'string', description: 'Tenant code (e.g. "rtl-bank") or tenant UUID' },
                job_id: { type: 'string', description: 'UUID of the enrichment_jobs row' },
            },
            required: ['tenant_code', 'job_id'],
            additionalProperties: false,
        },
        handler: async (args) => {
            const tenantCode = requireString(args, 'tenant_code');
            const jobId = requireString(args, 'job_id');
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
                return errorResult(`job_id '${jobId}' is not a valid UUID`);
            }
            const tenant = await resolveTenant(tenantCode);
            const data = await withTenantClient(tenant.id, async (c) => {
                const jobRow = await c.query(`SELECT j.id, j.tenant_id, j.status, j.mode, j.target_table, j.target_record_id,
                  j.idempotency_key, j.llm_cost_eur, j.error_details, j.created_at, j.completed_at,
                  d.entity_name AS descriptor_name
             FROM enrichment_jobs j
             JOIN enrichment_entity_descriptors d ON d.id = j.descriptor_id
            WHERE j.id = $1::uuid AND j.tenant_id = $2::uuid
            LIMIT 1`, [jobId, tenant.id]);
                if (jobRow.rows.length === 0)
                    return null;
                const events = await c.query(`SELECT event_type, payload_jsonb AS payload, created_at
             FROM enrichment_job_events
            WHERE job_id = $1::uuid AND tenant_id = $2::uuid
            ORDER BY created_at ASC`, [jobId, tenant.id]);
                const candidates = await c.query(`SELECT id, entity_type, entity_anchor, field_name, candidate_value, confidence,
                  extraction_method, llm_provider_code, fact_hash, created_at
             FROM enrichment_candidates
            WHERE job_id = $1::uuid AND tenant_id = $2::uuid
            ORDER BY field_name ASC`, [jobId, tenant.id]);
                return {
                    job: jobRow.rows[0],
                    events: events.rows,
                    candidates: candidates.rows,
                    counts: { events: events.rows.length, candidates: candidates.rows.length },
                };
            });
            if (!data) {
                return errorResult(`job ${jobId} not found for tenant ${tenant.code}`);
            }
            return textResult({ tenant: { id: tenant.id, code: tenant.code }, ...data });
        },
    },
    // ---------------------------------------------------------------------------
    // 5) list_recent_jobs
    // ---------------------------------------------------------------------------
    {
        name: 'list_recent_jobs',
        description: 'Paginated view of recent enrichment jobs for a tenant. Useful for triage: filter by status to find stuck or failed jobs.',
        inputSchema: {
            type: 'object',
            properties: {
                tenant_code: { type: 'string', description: 'Tenant code (e.g. "rtl-bank") or tenant UUID' },
                limit: { type: 'number', description: 'Max rows to return (default 10, max 100)' },
                status: {
                    type: 'string',
                    description: 'Optional status: pending|discovering|crawling|extracting|resolving|previewing|committed|failed|cached|rolled_back',
                },
            },
            required: ['tenant_code'],
            additionalProperties: false,
        },
        handler: async (args) => {
            const tenantCode = requireString(args, 'tenant_code');
            const limit = optionalNumber(args, 'limit', 10, 1, 100);
            const status = optionalString(args, 'status');
            if (status !== undefined && !VALID_JOB_STATUSES.has(status)) {
                return errorResult(`invalid status '${status}' — valid: ${[...VALID_JOB_STATUSES].join(', ')}`);
            }
            const tenant = await resolveTenant(tenantCode);
            const params = [tenant.id];
            let statusClause = '';
            if (status) {
                params.push(status);
                statusClause = ` AND j.status = $${params.length}`;
            }
            params.push(limit);
            const limitIdx = params.length;
            const result = await withTenantClient(tenant.id, (c) => c.query(`SELECT j.id, j.status, j.mode, j.target_record_id,
                  d.entity_name AS descriptor_name,
                  j.idempotency_key, j.llm_cost_eur, j.created_at, j.completed_at
             FROM enrichment_jobs j
             JOIN enrichment_entity_descriptors d ON d.id = j.descriptor_id
            WHERE j.tenant_id = $1::uuid${statusClause}
            ORDER BY j.created_at DESC
            LIMIT $${limitIdx}`, params));
            return textResult({
                tenant: { id: tenant.id, code: tenant.code },
                filter: { status: status ?? 'any', limit },
                count: result.rows.length,
                jobs: result.rows,
            });
        },
    },
];
export const TOOL_NAMES = TOOLS.map((t) => t.name);
export function buildServer() {
    const server = new Server({ name: 'heuresys-enrichment-mcp', version: '0.3.0-fase3' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const name = request.params.name;
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) {
            return errorResult(`unknown tool '${name}' — available: ${TOOL_NAMES.join(', ')}`);
        }
        const args = (request.params.arguments ?? {});
        try {
            return await tool.handler(args);
        }
        catch (err) {
            const message = err.message;
            logger.error({ err, tool: name, args }, '[mcp] tool error');
            return errorResult(message);
        }
    });
    return server;
}
export async function startMcpServer() {
    const server = buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info({ tools: TOOL_NAMES.length, names: TOOL_NAMES }, '[mcp] heuresys-enrichment-mcp connected via stdio');
}
//# sourceMappingURL=server.js.map