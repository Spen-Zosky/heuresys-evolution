/**
 * Tenant Setup Wizard Routes
 * Multi-step configuration wizard for new tenants
 * Epic: 2 - User Management & Tenant Configuration
 * Story: 2.1 - Tenant Setup Wizard - Organization Configuration
 */

import { Router, Request, Response } from 'express';
import { createAppError } from '../middleware/errorHandler.js';
import { ErrorCodes, CCNL_TYPES, CCNL_LEAVE_DEFAULTS, CCNLType } from '@heuresys/shared';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbpMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  tenantSetupStep1Schema,
  tenantSetupStep2Schema,
  tenantSetupStep3Schema,
  tenantUpdateSettingsSchema,
} from '../schemas/hr-operations-extended.js';
import { asyncHandler } from '../errors/middleware.js';

const router = Router();

// All routes require authentication and TENANT_OWNER role
router.use(authMiddleware);
router.use(requirePermission('PLATFORM', 'VIEW'));

// =============================================================================
// TYPES
// =============================================================================

interface CompanyInfo {
  name: string;
  code?: string;
  taxId?: string;
  addressStreet?: string;
  addressCity?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
  industryType?: string;
  naceCode?: string;
  region?: string;
}

interface CCNLConfig {
  type: CCNLType;
  customRules: boolean;
  leaveRules?: {
    ferie: number;
    rol: number;
    exFestivita: number;
  };
}

interface FiscalConfig {
  startMonth: number;
  payPeriod: 'monthly' | 'biweekly';
  holidayCalendar: 'italian_default' | 'custom';
  customHolidays?: Array<{ date: string; name: string }>;
}

interface TenantSettings {
  ccnl?: CCNLConfig;
  leaveRules?: {
    ferie: number;
    rol: number;
    exFestivita: number;
  };
  fiscalYear?: FiscalConfig;
  holidays?: {
    calendar: string;
    customHolidays: Array<{ date: string; name: string }>;
  };
  sso?: {
    provider: string | null;
    azureAd?: Record<string, unknown>;
    google?: Record<string, unknown>;
  };
  auditLog?: {
    retentionYears: number;
    exportSchedule: 'manual' | 'weekly' | 'monthly';
  };
}

// =============================================================================
// GET /api/v1/tenant-setup/status
// Get current setup wizard status for the authenticated user's tenant
// =============================================================================
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenantId;

    if (!tenantId) {
      throw createAppError('No tenant associated with user', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await dbClient.query(
      `SELECT id, code, name, setup_completed, setup_step, settings,
              tax_id, contact_email, contact_phone,
              address_street, address_city, address_postal_code, address_country,
              description, industry_type, nace_code, region
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    const tenant = result.rows[0];

    res.json({
      success: true,
      data: {
        tenantId: tenant.id,
        tenantCode: tenant.code,
        tenantName: tenant.name,
        setupCompleted: tenant.setup_completed,
        currentStep: tenant.setup_step,
        totalSteps: 3,
        completionPercentage: Math.round((tenant.setup_step / 3) * 100),
        steps: [
          { step: 1, name: 'Company Information', completed: tenant.setup_step >= 1 },
          { step: 2, name: 'CCNL Selection', completed: tenant.setup_step >= 2 },
          { step: 3, name: 'Fiscal Year', completed: tenant.setup_step >= 3 },
        ],
        companyInfo: {
          name: tenant.name,
          code: tenant.code,
          taxId: tenant.tax_id,
          addressStreet: tenant.address_street,
          addressCity: tenant.address_city,
          addressPostalCode: tenant.address_postal_code,
          addressCountry: tenant.address_country,
          contactEmail: tenant.contact_email,
          contactPhone: tenant.contact_phone,
          description: tenant.description,
          industryType: tenant.industry_type,
          naceCode: tenant.nace_code,
          region: tenant.region,
        },
        settings: tenant.settings || {},
      },
    });
  })
);

// =============================================================================
// GET /api/v1/tenant-setup/ccnl-types
// Get available CCNL types with their default leave rules
// =============================================================================
router.get('/ccnl-types', (_req: Request, res: Response) => {
  const ccnlOptions = Object.entries(CCNL_TYPES).map(([key, value]) => {
    const defaults = CCNL_LEAVE_DEFAULTS[value as CCNLType];
    return {
      value,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      defaults: defaults || { ferie: 26, rol: 56, exFestivita: 32 },
    };
  });

  res.json({
    success: true,
    data: ccnlOptions,
  });
});

// =============================================================================
// POST /api/v1/tenant-setup/step/1
// Step 1: Company Information
// =============================================================================
router.post(
  '/step/1',
  validate(tenantSetupStep1Schema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenantId;

    if (!tenantId) {
      throw createAppError('No tenant associated with user', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const {
      name,
      code,
      taxId,
      addressStreet,
      addressCity,
      addressPostalCode,
      addressCountry,
      contactEmail,
      contactPhone,
      description,
      industryType,
      naceCode,
      region,
    } = req.body as CompanyInfo;

    // Validate required fields
    if (!name || name.trim().length < 2) {
      throw createAppError(
        'Company name is required (min 2 characters)',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Validate Italian tax ID format (Partita IVA) if provided
    if (taxId) {
      const taxIdRegex = /^[0-9]{11}$/;
      if (!taxIdRegex.test(taxId)) {
        throw createAppError(
          'Invalid Italian Partita IVA format (11 digits required)',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // Validate email format if provided
    if (contactEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail)) {
        throw createAppError('Invalid email format', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // Update tenant with company info
    const result = await dbClient.query(
      `UPDATE tenants SET
        name = $2,
        code = COALESCE($3, code),
        tax_id = $4,
        address_street = $5,
        address_city = $6,
        address_postal_code = $7,
        address_country = COALESCE($8, 'ITA'),
        contact_email = $9,
        contact_phone = $10,
        description = $11,
        industry_type = $12,
        nace_code = $13,
        region = $14,
        setup_step = GREATEST(setup_step, 1),
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        tenantId,
        name,
        code,
        taxId,
        addressStreet,
        addressCity,
        addressPostalCode,
        addressCountry,
        contactEmail,
        contactPhone,
        description,
        industryType,
        naceCode,
        region,
      ]
    );

    if (result.rows.length === 0) {
      throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      data: {
        message: 'Step 1 completed: Company Information saved',
        currentStep: Math.max(result.rows[0]?.setup_step, 1),
        nextStep: 2,
      },
    });
  })
);

// =============================================================================
// POST /api/v1/tenant-setup/step/2
// Step 2: CCNL Selection
// =============================================================================
router.post(
  '/step/2',
  validate(tenantSetupStep2Schema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenantId;

    if (!tenantId) {
      throw createAppError('No tenant associated with user', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { ccnlType, customRules, leaveRules } = req.body;

    // Validate CCNL type
    if (!ccnlType || !Object.values(CCNL_TYPES).includes(ccnlType)) {
      throw createAppError('Invalid CCNL type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get default leave rules for selected CCNL
    const defaults = CCNL_LEAVE_DEFAULTS[ccnlType as CCNLType];

    // Use custom rules if provided, otherwise use defaults
    const finalLeaveRules =
      customRules && leaveRules
        ? {
            ferie: Math.max(0, Math.min(50, leaveRules.ferie || defaults.ferie)),
            rol: Math.max(0, Math.min(200, leaveRules.rol || defaults.rol)),
            exFestivita: Math.max(0, Math.min(100, leaveRules.exFestivita || defaults.exFestivita)),
          }
        : defaults;

    // Get current settings and merge
    const currentResult = await dbClient.query('SELECT settings FROM tenants WHERE id = $1', [
      tenantId,
    ]);

    const currentSettings: TenantSettings = currentResult.rows[0]?.settings || {};

    const ccnlConfig: CCNLConfig = {
      type: ccnlType,
      customRules: !!customRules,
    };
    if (customRules) {
      ccnlConfig.leaveRules = finalLeaveRules;
    }

    const newSettings: TenantSettings = {
      ...currentSettings,
      ccnl: ccnlConfig,
      leaveRules: finalLeaveRules,
    };

    // Update tenant settings
    const result = await dbClient.query(
      `UPDATE tenants SET
        settings = $2,
        setup_step = GREATEST(setup_step, 2),
        updated_at = NOW()
       WHERE id = $1
       RETURNING setup_step, settings`,
      [tenantId, JSON.stringify(newSettings)]
    );

    if (result.rows.length === 0) {
      throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      data: {
        message: 'Step 2 completed: CCNL Configuration saved',
        currentStep: Math.max(result.rows[0]?.setup_step, 2),
        nextStep: 3,
        leaveRules: finalLeaveRules,
      },
    });
  })
);

// =============================================================================
// POST /api/v1/tenant-setup/step/3
// Step 3: Fiscal Year Configuration
// =============================================================================
router.post(
  '/step/3',
  validate(tenantSetupStep3Schema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenantId;

    if (!tenantId) {
      throw createAppError('No tenant associated with user', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { startMonth, payPeriod, holidayCalendar, customHolidays } = req.body as FiscalConfig;

    // Validate start month (1-12)
    const validStartMonth = Math.max(1, Math.min(12, startMonth || 1));

    // Validate pay period
    const validPayPeriod = ['monthly', 'biweekly'].includes(payPeriod) ? payPeriod : 'monthly';

    // Validate holiday calendar
    const validCalendar = ['italian_default', 'custom'].includes(holidayCalendar)
      ? holidayCalendar
      : 'italian_default';

    // Get current settings and merge
    const currentResult = await dbClient.query('SELECT settings FROM tenants WHERE id = $1', [
      tenantId,
    ]);

    const currentSettings: TenantSettings = currentResult.rows[0]?.settings || {};

    const newSettings: TenantSettings = {
      ...currentSettings,
      fiscalYear: {
        startMonth: validStartMonth,
        payPeriod: validPayPeriod as 'monthly' | 'biweekly',
        holidayCalendar: validCalendar as 'italian_default' | 'custom',
      },
      holidays: {
        calendar: validCalendar,
        customHolidays:
          validCalendar === 'custom' && Array.isArray(customHolidays) ? customHolidays : [],
      },
    };

    // Update tenant settings and mark setup as complete
    const result = await dbClient.query(
      `UPDATE tenants SET
        settings = $2,
        setup_step = 3,
        setup_completed = true,
        setup_completed_at = NOW(),
        status = 'active',
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [tenantId, JSON.stringify(newSettings)]
    );

    if (result.rows.length === 0) {
      throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      data: {
        message: 'Setup wizard completed! Your organization is now configured.',
        setupCompleted: true,
        currentStep: 3,
        tenant: {
          id: result.rows[0]?.id,
          code: result.rows[0]?.code,
          name: result.rows[0]?.name,
          status: result.rows[0]?.status,
        },
      },
    });
  })
);

// =============================================================================
// GET /api/v1/tenant-setup/settings
// Get all tenant settings
// =============================================================================
router.get(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenantId;

    if (!tenantId) {
      throw createAppError('No tenant associated with user', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await dbClient.query('SELECT settings FROM tenants WHERE id = $1', [tenantId]);

    if (result.rows.length === 0) {
      throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      data: result.rows[0]?.settings || {},
    });
  })
);

// =============================================================================
// PUT /api/v1/tenant-setup/settings
// Update specific tenant settings
// =============================================================================
router.put(
  '/settings',
  validate(tenantUpdateSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const dbClient = req.dbClient!;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user.tenantId;

    if (!tenantId) {
      throw createAppError('No tenant associated with user', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const newSettings = req.body;

    if (!newSettings || typeof newSettings !== 'object') {
      throw createAppError('Invalid settings object', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get current settings and merge
    const currentResult = await dbClient.query('SELECT settings FROM tenants WHERE id = $1', [
      tenantId,
    ]);

    const currentSettings = currentResult.rows[0]?.settings || {};
    const mergedSettings = { ...currentSettings, ...newSettings };

    const result = await dbClient.query(
      `UPDATE tenants SET
        settings = $2,
        updated_at = NOW()
       WHERE id = $1
       RETURNING settings`,
      [tenantId, JSON.stringify(mergedSettings)]
    );

    if (result.rows.length === 0) {
      throw createAppError('Tenant not found', 404, ErrorCodes.TENANT_NOT_FOUND);
    }

    res.json({
      success: true,
      data: result.rows[0]?.settings,
    });
  })
);

export default router;
