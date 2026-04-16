/**
 * Zod Schemas for HR Operations Routes
 * Covers: attendance, employee-documents, employee-skill-profiles
 */

import { z } from 'zod';

// =============================================================================
// ATTENDANCE
// =============================================================================

export const createAttendanceSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  attendance_date: z.string().min(1, 'Attendance date is required'),
  clock_in: z.string().optional().nullable(),
  clock_out: z.string().optional().nullable(),
  break_start: z.string().optional().nullable(),
  break_end: z.string().optional().nullable(),
  hours_regular: z.coerce.number().min(0).optional(),
  hours_overtime: z.coerce.number().min(0).optional(),
  hours_night: z.coerce.number().min(0).optional(),
  hours_holiday: z.coerce.number().min(0).optional(),
  status: z.enum(['present', 'absent', 'late', 'half_day', 'remote', 'leave']).optional(),
  source: z.string().trim().max(50).optional(),
  source_reference: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const clockInSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const clockOutSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateAttendanceSchema = z
  .object({
    clock_in: z.string().optional().nullable(),
    clock_out: z.string().optional().nullable(),
    break_start: z.string().optional().nullable(),
    break_end: z.string().optional().nullable(),
    hours_regular: z.coerce.number().min(0).optional(),
    hours_overtime: z.coerce.number().min(0).optional(),
    hours_night: z.coerce.number().min(0).optional(),
    hours_holiday: z.coerce.number().min(0).optional(),
    status: z.enum(['present', 'absent', 'late', 'half_day', 'remote', 'leave']).optional(),
    is_validated: z.boolean().optional(),
    validated_by: z.string().uuid('Invalid validator ID').optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .partial();

export const validateAttendanceSchema = z.object({
  validated_by: z.string().uuid('Invalid validator ID').optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// =============================================================================
// EMPLOYEE DOCUMENTS
// =============================================================================

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  document_type: z.string().trim().min(1, 'Document type is required').max(100),
  category: z.string().trim().max(50).optional().nullable(),
  filename: z.string().trim().min(1, 'Filename is required').max(500),
  original_name: z.string().trim().min(1, 'Original name is required').max(500),
  mime_type: z.string().trim().min(1, 'MIME type is required').max(100),
  file_size: z.coerce.number().int().min(0).optional().nullable(),
  file_path: z.string().trim().min(1, 'File path is required').max(1000),
  document_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  reference_number: z.string().trim().max(100).optional().nullable(),
});

export const createDocumentRequestSchema = z.object({
  document_type: z.string().trim().min(1, 'Document type is required').max(100),
  purpose: z.string().trim().max(500).optional().nullable(),
  additional_notes: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

// =============================================================================
// EMPLOYEE SKILL PROFILES
// =============================================================================

const skillItemSchema = z.object({
  skillId: z.string().uuid('Invalid skill ID'),
  knowledge: z.coerce.number().min(0).max(5).optional(),
  skill: z.coerce.number().min(0).max(5).optional(),
  ability: z.coerce.number().min(0).max(5).optional(),
  behavior: z.coerce.number().min(0).max(5).optional(),
  attitude: z.coerce.number().min(0).max(5).optional(),
  isPrimary: z.boolean().optional(),
  isTarget: z.boolean().optional(),
  targetLevel: z.coerce.number().min(0).max(5).optional().nullable(),
});

export const updateSkillProfileSchema = z.object({
  skills: z.array(skillItemSchema).min(1, 'At least one skill is required'),
});

export const declareSkillSchema = z.object({
  skillId: z.string().uuid('Invalid skill ID'),
  knowledge: z.coerce.number().min(0).max(5).optional(),
  skill: z.coerce.number().min(0).max(5).optional(),
  ability: z.coerce.number().min(0).max(5).optional(),
  behavior: z.coerce.number().min(0).max(5).optional(),
  attitude: z.coerce.number().min(0).max(5).optional(),
  sourceDescription: z.string().trim().max(500).optional().nullable(),
  acquiredDate: z.string().optional().nullable(),
  evidenceType: z.string().trim().max(50).optional().nullable(),
  evidenceId: z.string().trim().max(200).optional().nullable(),
  evidenceUrl: z.string().trim().max(500).optional().nullable(),
  evidenceNotes: z.string().trim().max(2000).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isTarget: z.boolean().optional(),
  targetLevel: z.coerce.number().min(0).max(5).optional().nullable(),
});
