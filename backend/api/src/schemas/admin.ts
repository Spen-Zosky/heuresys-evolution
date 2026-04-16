/**
 * Zod Schemas for Admin Routes
 * Covers: sso, predictions, skills
 */

import { z } from 'zod';

// =============================================================================
// SSO
// =============================================================================

export const testAzureConfigSchema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required').max(200),
  clientSecret: z.string().trim().min(1, 'Client secret is required').max(500),
  azureTenantId: z.string().trim().min(1, 'Azure tenant ID is required').max(200),
});

export const testGoogleConfigSchema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required').max(200),
  clientSecret: z.string().trim().min(1, 'Client secret is required').max(500),
});

export const updateAzureConfigSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  clientId: z.string().trim().max(200).optional().nullable(),
  clientSecret: z.string().trim().max(500).optional().nullable(),
  azureTenantId: z.string().trim().max(200).optional().nullable(),
  enabled: z.boolean().optional(),
});

export const updateGoogleConfigSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  clientId: z.string().trim().max(200).optional().nullable(),
  clientSecret: z.string().trim().max(500).optional().nullable(),
  allowedDomains: z.array(z.string().trim().max(200)).optional(),
  enabled: z.boolean().optional(),
});

// =============================================================================
// PREDICTIONS
// =============================================================================

export const createPredictionModelSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: z.string().trim().min(1, 'Type is required').max(100),
  version: z.string().trim().min(1, 'Version is required').max(50),
  description: z.string().trim().max(2000).optional().nullable(),
  config: z.record(z.unknown()),
  created_by: z.string().trim().max(200).optional(),
});

export const updateModelStatusSchema = z.object({
  status: z.string().trim().min(1, 'Status is required').max(50),
});

export const generatePerformancePredictionsSchema = z.object({
  prediction_period: z.string().trim().max(50).optional().nullable(),
});

export const validatePredictionsSchema = z.object({
  prediction_period: z.string().trim().min(1, 'Prediction period is required').max(50),
});

// =============================================================================
// SKILLS
// =============================================================================

export const createSkillSchema = z.object({
  uri: z.string().trim().min(1, 'URI is required').max(500),
  preferred_label_en: z.string().trim().min(1, 'Label is required').max(500),
  description_en: z.string().trim().max(5000).optional().nullable(),
  skill_type: z.string().trim().min(1, 'Skill type is required').max(50),
  reuse_level: z.string().trim().max(50).optional().nullable(),
  is_digital: z.boolean().optional(),
  is_green: z.boolean().optional(),
});

export const updateSkillSchema = z
  .object({
    uri: z.string().trim().max(500).optional(),
    preferred_label_en: z.string().trim().max(500).optional(),
    description_en: z.string().trim().max(5000).optional().nullable(),
    skill_type: z.string().trim().max(50).optional(),
    reuse_level: z.string().trim().max(50).optional().nullable(),
    is_digital: z.boolean().optional(),
    is_green: z.boolean().optional(),
  })
  .partial();
