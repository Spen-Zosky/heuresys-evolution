/**
 * Zod Schemas for Tenants Routes
 * Covers: tenant CRUD operations
 */

import { z } from 'zod';

// =============================================================================
// TENANTS
// =============================================================================

export const createTenantSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Code must be lowercase alphanumeric with hyphens only'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  nace_code: z.string().trim().max(50).optional().nullable(),
  region: z.string().trim().max(100).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional(),
  subscription_plan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  industry_type: z.string().trim().max(200).optional().nullable(),
  sap_company_code: z.string().trim().max(50).optional().nullable(),
  annual_revenue_eur: z.coerce.number().min(0).optional().nullable(),
});

// Normalizes canonical website domain: lowercase, strip protocol, strip www., strip trailing slash
const verifiedWebsiteSchema = z
  .string()
  .trim()
  .max(255)
  .transform((v) =>
    v
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
  )
  .refine((v) => v === '' || /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v), {
    message: 'Invalid domain format (e.g. example.com)',
  })
  .optional()
  .nullable();

// Normalizes tax_id: uppercase, strip whitespace (accepts IT12345678901, VAT formats, codice fiscale)
const taxIdSchema = z
  .string()
  .trim()
  .max(32)
  .transform((v) => v.toUpperCase().replace(/\s+/g, ''))
  .refine((v) => v === '' || /^[A-Z0-9]{8,32}$/.test(v), {
    message: 'Invalid tax ID format (8-32 alphanumeric characters)',
  })
  .optional()
  .nullable();

export const updateTenantSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    nace_code: z.string().trim().max(50).optional().nullable(),
    region: z.string().trim().max(100).optional().nullable(),
    status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional(),
    subscription_plan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
    industry_type: z.string().trim().max(200).optional().nullable(),
    sap_company_code: z.string().trim().max(50).optional().nullable(),
    annual_revenue_eur: z.coerce.number().min(0).optional().nullable(),
    verified_website: verifiedWebsiteSchema,
    tax_id: taxIdSchema,
  })
  .partial();
