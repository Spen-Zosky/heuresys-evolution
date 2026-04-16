/**
 * Zod Schemas for Workforce Analytics Routes
 * Covers: overtime, compensation-analytics, nace, talent-skill-profiles
 */

import { z } from 'zod';

// =============================================================================
// OVERTIME
// =============================================================================

export const overtimeStatsQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .passthrough();

export const overtimeByTypeQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .passthrough();

export const overtimeListQuerySchema = z
  .object({
    employee_id: z.string().uuid('Invalid employee ID').optional(),
    status: z.string().trim().max(50).optional(),
    overtime_type: z.string().trim().max(50).optional(),
    date_from: z.string().trim().optional(),
    date_to: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .passthrough();

// =============================================================================
// COMPENSATION ANALYTICS
// =============================================================================

export const compaRatioQuerySchema = z
  .object({
    org_unit_id: z.string().uuid('Invalid department ID').optional(),
  })
  .passthrough();

export const bonusDistributionQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .passthrough();

// =============================================================================
// NACE
// =============================================================================

export const naceDivisionsQuerySchema = z
  .object({
    section: z.string().trim().max(10).optional(),
  })
  .passthrough();

export const naceGroupsQuerySchema = z
  .object({
    division: z.string().trim().max(10).optional(),
  })
  .passthrough();

// =============================================================================
// TALENT SKILL PROFILES
// =============================================================================

export const talentSkillProfilesListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    org_unit_id: z.string().uuid('Invalid department ID').optional(),
    min_score: z.coerce.number().min(0).max(100).optional(),
    max_score: z.coerce.number().min(0).max(100).optional(),
    search: z.string().trim().max(200).optional(),
    include_stats: z.string().trim().optional(),
  })
  .passthrough();
