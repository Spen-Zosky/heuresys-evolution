/**
 * Tenant Onboarding API Routes
 * Org prototype generation from NACE + company size using ESCO knowledge graph.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { cachedForTenant, CACHE_TTL } from '../services/cache.js';
import { asyncHandler } from '../errors/middleware.js';
import { validate } from '../middleware/validate.js';
import { Errors } from '../errors/factory.js';
import { getTenantIdOrThrow } from '../middleware/tenantContext.js';

const GeneratePrototypeSchema = z.object({
  nacePrimary: z.string().optional(),
  companySize: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
  countryCode: z.string().optional(),
});

const SetupSchema = z.object({
  nacePrimary: z.string().min(1),
  companySize: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']),
  orgStructureType: z.string().optional(),
});

const router = Router();

// =============================================================================
// D1: POST /generate-prototype
// Generate organizational prototype from NACE + company size
// =============================================================================

router.post(
  '/generate-prototype',
  validate(GeneratePrototypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const { nacePrimary, companySize, countryCode } = req.body || {};

    // Update tenant profile if values provided
    if (nacePrimary || companySize || countryCode) {
      const setClauses: string[] = [];
      const params: (string | null)[] = [];

      if (nacePrimary) {
        // nace_primary migrated to tenant_industry_classifications — upsert there
        await dbClient.query(
          `INSERT INTO tenant_industry_classifications (tenant_id, classification_code, classification_role, is_active)
           VALUES ($1, $2, 'primary', true)
           ON CONFLICT (tenant_id, classification_code) DO UPDATE SET classification_role = 'primary', is_active = true`,
          [tenantId, nacePrimary]
        );
      }
      if (companySize) {
        if (!['MICRO', 'SMALL', 'MEDIUM', 'LARGE'].includes(companySize)) {
          throw Errors.badRequest('companySize must be MICRO, SMALL, MEDIUM, or LARGE');
        }
        params.push(companySize);
        setClauses.push(`company_size = $${params.length}`);
      }
      if (countryCode) {
        params.push(countryCode);
        setClauses.push(`address_country = $${params.length}`);
      }

      if (setClauses.length > 0) {
        params.push(tenantId);
        await dbClient.query(
          `UPDATE tenants SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
          params
        );
      }
    }

    // Check if prototype already exists
    const existing = await dbClient.query(
      `SELECT id, generated_at, departments_generated, positions_generated
       FROM tenant_onboarding_profiles WHERE tenant_id = $1
       ORDER BY generated_at DESC LIMIT 1`,
      [tenantId]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw Errors.conflict('Prototype already generated for this tenant', {
        generatedAt: existing.rows[0]?.generated_at,
        departments: existing.rows[0]?.departments_generated,
        positions: existing.rows[0]?.positions_generated,
      });
    }

    // Verify tenant has NACE configured (now in tenant_industry_classifications)
    const naceCheck = await dbClient.query(
      `SELECT classification_code FROM tenant_industry_classifications
       WHERE tenant_id = $1 AND classification_role = 'primary' AND is_active = true
       LIMIT 1`,
      [tenantId]
    );
    if (naceCheck.rowCount === 0) {
      throw Errors.badRequest(
        'Tenant has no NACE code configured. Provide nacePrimary in request body.'
      );
    }

    // Generate prototype
    const result = await dbClient.query(
      `SELECT fn_generate_org_prototype($1::uuid, false) AS result`,
      [tenantId]
    );

    const prototypeResult = result.rows[0]?.result;

    if (prototypeResult.error) {
      throw Errors.badRequest(prototypeResult.error);
    }

    res.status(201).json({
      success: true,
      data: prototypeResult,
      message: `Prototype generated: ${prototypeResult.summary.departments_generated} departments, ${prototypeResult.summary.positions_generated} positions, ${prototypeResult.summary.skill_requirements_generated} skill requirements`,
    });
  })
);

// =============================================================================
// D1b: POST /setup
// Wizard-driven setup: update tenant profile + trigger blueprint generation
// Unlike /generate-prototype, does not fail if a profile already exists.
// =============================================================================

router.post(
  '/setup',
  validate(SetupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;
    const { nacePrimary, companySize, orgStructureType } = req.body || {};

    // Update tenant profile: company_size on tenants, nace in tenant_industry_classifications
    await dbClient.query(`UPDATE tenants SET company_size = $1 WHERE id = $2`, [
      companySize,
      tenantId,
    ]);
    await dbClient.query(
      `INSERT INTO tenant_industry_classifications (tenant_id, classification_code, classification_role, is_active)
       VALUES ($1, $2, 'primary', true)
       ON CONFLICT (tenant_id, classification_code) DO UPDATE SET classification_role = 'primary', is_active = true`,
      [tenantId, nacePrimary]
    );

    // Optionally store org structure preference in config (non-blocking)
    if (orgStructureType) {
      await dbClient.query(
        `INSERT INTO tenant_onboarding_profiles (tenant_id, prototype_config)
         VALUES ($1, $2::jsonb)
         ON CONFLICT DO NOTHING`,
        [tenantId, JSON.stringify({ orgStructureType })]
      );
    }

    // Trigger blueprint generation
    let blueprintResult: Record<string, unknown> | null = null;
    try {
      const result = await dbClient.query(
        `SELECT fn_generate_org_prototype($1::uuid, true) AS result`,
        [tenantId]
      );
      const raw = result.rows[0]?.result as Record<string, unknown>;
      if (!raw.error) {
        blueprintResult = raw;
      }
    } catch {
      // Blueprint generation is best-effort in wizard flow; tenant profile is saved either way
    }

    const summary = (blueprintResult?.summary ?? null) as Record<string, number> | null;

    res.status(201).json({
      success: true,
      data: {
        nacePrimary,
        companySize,
        orgStructureType: orgStructureType ?? null,
        blueprint: blueprintResult
          ? {
              departmentsGenerated: summary?.departments_generated ?? 0,
              positionsGenerated: summary?.positions_generated ?? 0,
              skillRequirementsGenerated: summary?.skill_requirements_generated ?? 0,
            }
          : null,
      },
      message: blueprintResult
        ? `Setup complete: ${summary?.departments_generated ?? 0} departments, ${summary?.positions_generated ?? 0} positions generated`
        : 'Tenant profile saved. Blueprint generation pending.',
    });
  })
);

// =============================================================================
// D2: GET /status
// Onboarding status for current tenant
// =============================================================================

router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = getTenantIdOrThrow(req);
    const dbClient = req.dbClient!;

    const data = await cachedForTenant(
      tenantId,
      'onboard:status',
      async () => {
        const result = await dbClient.query(
          `SELECT top.*, tic.classification_code AS nace_primary, t.company_size, t.onboarding_completed_at
           FROM tenants t
           LEFT JOIN tenant_industry_classifications tic
             ON tic.tenant_id = t.id AND tic.classification_role = 'primary' AND tic.is_active = true
           LEFT JOIN LATERAL (
             SELECT id, departments_generated, positions_generated,
                    skill_requirements_generated, generated_at, generator_version
             FROM tenant_onboarding_profiles
             WHERE tenant_id = t.id
             ORDER BY generated_at DESC LIMIT 1
           ) top ON true
           WHERE t.id = $1`,
          [tenantId]
        );

        if (result.rowCount === 0) throw Errors.notFound('Tenant', tenantId);

        const row = result.rows[0];
        return {
          completed: row.onboarding_completed_at !== null,
          nacePrimary: row.nace_primary,
          companySize: row.company_size,
          profile: row.id
            ? {
                departmentsGenerated: row.departments_generated,
                positionsGenerated: row.positions_generated,
                skillRequirementsGenerated: row.skill_requirements_generated,
                generatedAt: row.generated_at,
                generatorVersion: row.generator_version,
              }
            : null,
        };
      },
      CACHE_TTL.SHORT
    );

    res.json({ success: true, data });
  })
);

export default router;
