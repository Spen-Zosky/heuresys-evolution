import { z } from 'zod';

export const createGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  employee_id: z.string().uuid('Invalid employee ID').optional(),
  parent_goal_id: z.string().uuid('Invalid parent goal ID').optional().nullable(),
  goal_type: z.enum(['individual', 'team', 'department', 'company']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled', 'on_hold']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  weight: z.number().min(0).max(100).optional(),
  target_value: z.number().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();
