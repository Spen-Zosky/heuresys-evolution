import { z } from 'zod';

// =============================================================================
// LEARNING PATHS SCHEMAS
// =============================================================================

export const createLearningPathSchema = z.object({
  code: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1, 'Title is required').max(500),
  title_en: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  target_role: z.string().trim().max(200).optional(),
  skills_gained: z.array(z.string().trim().max(200)).optional(),
  total_hours: z.number().min(0).max(10000).optional(),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  path_type: z.string().trim().max(100).optional(),
  is_mandatory: z.boolean().default(false),
  is_active: z.boolean().default(true),
  created_by: z.string().uuid('Invalid creator ID').optional(),
});

export const updateLearningPathSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(500).optional(),
  title_en: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  target_role: z.string().trim().max(200).optional(),
  skills_gained: z.array(z.string().trim().max(200)).optional(),
  total_hours: z.number().min(0).max(10000).optional(),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  path_type: z.string().trim().max(100).optional(),
  is_mandatory: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// =============================================================================
// COURSES SCHEMAS
// =============================================================================

export const createCourseSchema = z.object({
  code: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1, 'Title is required').max(500),
  title_en: z.string().trim().max(500).optional(),
  description: z.string().trim().max(10000).optional(),
  description_en: z.string().trim().max(10000).optional(),
  category: z.string().trim().max(200).optional(),
  duration_hours: z.number().min(0).max(10000).optional(),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  provider: z.string().trim().max(200).optional(),
  is_mandatory: z.boolean().default(false),
  is_active: z.boolean().default(true),
  is_certification: z.boolean().default(false),
  external_url: z.string().trim().url('Invalid URL format').max(2000).optional().or(z.literal('')),
  thumbnail_url: z.string().trim().url('Invalid URL format').max(2000).optional().or(z.literal('')),
  language: z.string().trim().max(10).default('it'),
  tags: z.array(z.string().trim().max(100)).optional(),
  prerequisites: z.array(z.string().trim().max(500)).optional(),
  created_by: z.string().uuid('Invalid creator ID').optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(500).optional(),
  title_en: z.string().trim().max(500).optional(),
  description: z.string().trim().max(10000).optional(),
  description_en: z.string().trim().max(10000).optional(),
  category: z.string().trim().max(200).optional(),
  duration_hours: z.number().min(0).max(10000).optional(),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  provider: z.string().trim().max(200).optional(),
  is_mandatory: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_certification: z.boolean().optional(),
  external_url: z.string().trim().url('Invalid URL format').max(2000).optional().or(z.literal('')),
  thumbnail_url: z.string().trim().url('Invalid URL format').max(2000).optional().or(z.literal('')),
  language: z.string().trim().max(10).optional(),
  tags: z.array(z.string().trim().max(100)).optional(),
  prerequisites: z.array(z.string().trim().max(500)).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});
