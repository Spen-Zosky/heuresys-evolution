/**
 * Performance Management Service
 * Epic 9: Complete Performance Management functionality
 *
 * Covers:
 * - Story 9.1: Goal Management System
 * - Story 9.2: OKR Tracking System
 * - Story 9.3: Performance Review Cycles
 * - Story 9.4: Calibration Sessions
 * - Story 9.5: Performance Reviews
 */

import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface Goal {
  id: string;
  tenant_id: string;
  employee_id: string;
  owner_id?: string;
  title: string;
  description?: string;
  goal_type: 'individual' | 'team' | 'department' | 'company' | 'stretch';
  category?: string;
  parent_goal_id?: string;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'at_risk';
  progress_percent: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  weight?: number;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoalAlignment {
  id: string;
  goal_id: string;
  aligned_goal_id: string;
  alignment_type: 'supports' | 'contributes_to' | 'derived_from' | 'depends_on';
  alignment_weight: number;
}

export interface GoalUpdate {
  id: string;
  goal_id: string;
  author_id?: string;
  update_type: 'progress' | 'status_change' | 'milestone' | 'blocker' | 'note';
  previous_progress?: number;
  new_progress?: number;
  previous_status?: string;
  new_status?: string;
  content?: string;
  created_at: string;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  description?: string;
  target_date?: string;
  completed_at?: string;
  status: 'pending' | 'completed' | 'missed' | 'cancelled';
  weight: number;
}

export interface OKR {
  id: string;
  tenant_id: string;
  owner_id?: string;
  objective: string;
  description?: string;
  okr_type: 'company' | 'department' | 'team' | 'individual';
  department?: string;
  period_type: 'annual' | 'quarterly' | 'monthly' | 'custom';
  period_start?: string;
  period_end?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  overall_progress: number;
  confidence_level?: number;
  parent_okr_id?: string;
}

export interface KeyResult {
  id: string;
  okr_id: string;
  owner_id?: string;
  title: string;
  description?: string;
  metric_type: 'number' | 'percentage' | 'currency' | 'boolean' | 'milestone';
  start_value: number;
  target_value: number;
  current_value: number;
  unit?: string;
  progress_percent: number;
  confidence_level?: number;
  weight: number;
  status: 'active' | 'at_risk' | 'behind' | 'on_track' | 'completed' | 'cancelled';
  due_date?: string;
}

export interface ReviewCycle {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  cycle_type: 'annual' | 'semi_annual' | 'quarterly' | 'probation' | 'adhoc';
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'in_calibration' | 'completed' | 'cancelled';
  self_review_deadline?: string;
  manager_review_deadline?: string;
  calibration_deadline?: string;
  include_self_review: boolean;
  include_peer_review: boolean;
  include_360_feedback: boolean;
}

export interface CalibrationSession {
  id: string;
  tenant_id: string;
  review_cycle_id?: string;
  name: string;
  description?: string;
  session_type: 'company' | 'division' | 'department' | 'team' | 'custom';
  org_unit_id?: string;
  scheduled_date?: string;
  scheduled_end_date?: string;
  location?: string;
  meeting_link?: string;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  facilitator_id?: string;
  facilitator_ids?: string[];
}

export interface PerformanceReview {
  id: string;
  tenant_id: string;
  review_cycle_id?: string;
  employee_id: string;
  reviewer_id: string;
  review_type: 'annual' | 'semi_annual' | 'quarterly' | 'probation' | 'adhoc' | 'project';
  overall_rating?: number;
  goal_achievement_rating?: number;
  competency_rating?: number;
  potential_rating?: number;
  status: string;
  performance_box?: number;
  potential_box?: number;
}

export interface Feedback360 {
  id: string;
  tenant_id: string;
  subject_id: string;
  rater_id?: string;
  rater_type: 'self' | 'manager' | 'peer' | 'direct_report' | 'stakeholder' | 'external';
  is_anonymous: boolean;
  overall_rating?: number;
  status: 'pending' | 'in_progress' | 'submitted' | 'declined';
}

// =============================================================================
// PERFORMANCE MANAGEMENT SERVICE
// =============================================================================

export class PerformanceManagementService {
  // ===========================================================================
  // GOAL MANAGEMENT (Story 9.1)
  // ===========================================================================

  /**
   * Get goal hierarchy for a tenant
   */
  async getGoalHierarchy(
    tenantId: string,
    options: {
      rootOnly?: boolean;
      employeeId?: string;
      status?: string;
    } = {}
  ): Promise<Goal[]> {
    const params: (string | boolean)[] = [tenantId];
    let paramIndex = 2;

    let query = `
      WITH RECURSIVE goal_tree AS (
        SELECT g.*, 0 as depth, ARRAY[g.id] as path
        FROM goals g
        WHERE g.tenant_id = $1 AND g.parent_goal_id IS NULL
    `;

    if (options.employeeId) {
      query += ` AND g.employee_id = $${paramIndex}`;
      params.push(options.employeeId);
      paramIndex++;
    }

    if (options.status) {
      query += ` AND g.status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    query += `
        UNION ALL
        SELECT g.*, gt.depth + 1, gt.path || g.id
        FROM goals g
        JOIN goal_tree gt ON g.parent_goal_id = gt.id
        WHERE g.tenant_id = $1
      )
      SELECT * FROM goal_tree
      ORDER BY depth, title
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create goal alignment
   */
  async createGoalAlignment(
    tenantId: string,
    goalId: string,
    alignedGoalId: string,
    alignmentType: string,
    weight: number = 100
  ): Promise<GoalAlignment> {
    const result = await pool.query(
      `
      INSERT INTO goal_alignments (tenant_id, goal_id, aligned_goal_id, alignment_type, alignment_weight)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [tenantId, goalId, alignedGoalId, alignmentType, weight]
    );
    return result.rows[0];
  }

  /**
   * Get goal alignments
   */
  async getGoalAlignments(
    tenantId: string,
    goalId: string
  ): Promise<{
    aligns_to: GoalAlignment[];
    aligned_from: GoalAlignment[];
  }> {
    const [alignsTo, alignedFrom] = await Promise.all([
      pool.query(
        `
        SELECT ga.*, g.title as aligned_goal_title, g.status as aligned_goal_status
        FROM goal_alignments ga
        JOIN goals g ON ga.aligned_goal_id = g.id
        WHERE ga.tenant_id = $1 AND ga.goal_id = $2
      `,
        [tenantId, goalId]
      ),
      pool.query(
        `
        SELECT ga.*, g.title as source_goal_title, g.status as source_goal_status
        FROM goal_alignments ga
        JOIN goals g ON ga.goal_id = g.id
        WHERE ga.tenant_id = $1 AND ga.aligned_goal_id = $2
      `,
        [tenantId, goalId]
      ),
    ]);

    return {
      aligns_to: alignsTo.rows,
      aligned_from: alignedFrom.rows,
    };
  }

  /**
   * Add goal update
   */
  async addGoalUpdate(
    tenantId: string,
    goalId: string,
    update: {
      author_id?: string;
      update_type: string;
      content?: string;
      new_progress?: number;
      new_status?: string;
    }
  ): Promise<GoalUpdate> {
    // Get current goal state
    const currentGoal = await pool.query(
      'SELECT progress_percent, status FROM goals WHERE id = $1 AND tenant_id = $2',
      [goalId, tenantId]
    );

    if (currentGoal.rows.length === 0) {
      throw new Error('Goal not found');
    }

    const result = await pool.query(
      `
      INSERT INTO goal_updates (
        tenant_id, goal_id, author_id, update_type,
        previous_progress, new_progress, previous_status, new_status, content
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        tenantId,
        goalId,
        update.author_id,
        update.update_type,
        currentGoal.rows[0].progress_percent,
        update.new_progress,
        currentGoal.rows[0].status,
        update.new_status,
        update.content,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get goal updates history
   */
  async getGoalUpdates(
    tenantId: string,
    goalId: string,
    limit: number = 50
  ): Promise<GoalUpdate[]> {
    const result = await pool.query(
      `
      SELECT gu.*, e.first_name || ' ' || e.last_name as author_name
      FROM goal_updates gu
      LEFT JOIN employees e ON gu.author_id = e.id
      WHERE gu.tenant_id = $1 AND gu.goal_id = $2
      ORDER BY gu.created_at DESC
      LIMIT $3
    `,
      [tenantId, goalId, limit]
    );
    return result.rows;
  }

  /**
   * Manage goal milestones
   */
  async createGoalMilestone(
    tenantId: string,
    goalId: string,
    milestone: Omit<GoalMilestone, 'id' | 'completed_at'>
  ): Promise<GoalMilestone> {
    const result = await pool.query(
      `
      INSERT INTO goal_milestones (tenant_id, goal_id, title, description, target_date, status, weight)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        tenantId,
        goalId,
        milestone.title,
        milestone.description,
        milestone.target_date,
        milestone.status || 'pending',
        milestone.weight || 0,
      ]
    );
    return result.rows[0];
  }

  async completeMilestone(tenantId: string, milestoneId: string): Promise<GoalMilestone> {
    const result = await pool.query(
      `
      UPDATE goal_milestones
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
      [milestoneId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Milestone not found');
    }

    return result.rows[0];
  }

  async getGoalMilestones(tenantId: string, goalId: string): Promise<GoalMilestone[]> {
    const result = await pool.query(
      `
      SELECT * FROM goal_milestones
      WHERE tenant_id = $1 AND goal_id = $2
      ORDER BY target_date ASC NULLS LAST, created_at ASC
    `,
      [tenantId, goalId]
    );
    return result.rows;
  }

  /**
   * Calculate cascaded goal progress
   */
  async calculateCascadedProgress(tenantId: string, goalId: string): Promise<number> {
    const result = await pool.query(
      `
      WITH child_goals AS (
        SELECT progress_percent, weight
        FROM goals
        WHERE parent_goal_id = $1 AND tenant_id = $2 AND status != 'cancelled'
      )
      SELECT
        CASE
          WHEN COUNT(*) = 0 THEN (SELECT progress_percent FROM goals WHERE id = $1)
          WHEN SUM(weight) > 0 THEN SUM(progress_percent * weight) / SUM(weight)
          ELSE AVG(progress_percent)
        END as calculated_progress
      FROM child_goals
    `,
      [goalId, tenantId]
    );

    return parseFloat(result.rows[0].calculated_progress) || 0;
  }

  // ===========================================================================
  // OKR TRACKING (Story 9.2)
  // ===========================================================================

  /**
   * Create Key Result for an OKR
   */
  async createKeyResult(
    tenantId: string,
    okrId: string,
    keyResult: {
      title: string;
      description?: string;
      metric_type?: string;
      start_value?: number;
      target_value: number;
      current_value?: number;
      unit?: string;
      weight?: number;
      owner_id?: string;
      due_date?: string;
    }
  ): Promise<KeyResult> {
    const result = await pool.query(
      `
      INSERT INTO key_results (
        tenant_id, okr_id, title, description, metric_type,
        start_value, target_value, current_value, unit, weight, owner_id, due_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $8, $9, $10, $11)
      RETURNING *
    `,
      [
        tenantId,
        okrId,
        keyResult.title,
        keyResult.description,
        keyResult.metric_type || 'number',
        keyResult.start_value || 0,
        keyResult.target_value,
        keyResult.unit,
        keyResult.weight || 100,
        keyResult.owner_id,
        keyResult.due_date,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update Key Result progress
   */
  async updateKeyResultProgress(
    tenantId: string,
    keyResultId: string,
    currentValue: number,
    confidenceLevel?: number
  ): Promise<KeyResult> {
    // Get key result to calculate progress
    const kr = await pool.query(
      'SELECT start_value, target_value FROM key_results WHERE id = $1 AND tenant_id = $2',
      [keyResultId, tenantId]
    );

    if (kr.rows.length === 0) {
      throw new Error('Key Result not found');
    }

    const { start_value, target_value } = kr.rows[0];
    const range = target_value - start_value;
    const progress =
      range !== 0 ? Math.min(100, Math.max(0, ((currentValue - start_value) / range) * 100)) : 0;

    // Determine status based on progress
    let status = 'active';
    if (progress >= 100) status = 'completed';
    else if (progress >= 70) status = 'on_track';
    else if (progress >= 40) status = 'at_risk';
    else status = 'behind';

    const result = await pool.query(
      `
      UPDATE key_results
      SET current_value = $1, progress_percent = $2, confidence_level = COALESCE($3, confidence_level),
          status = $4, updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `,
      [currentValue, progress, confidenceLevel, status, keyResultId, tenantId]
    );

    return result.rows[0];
  }

  /**
   * Get OKR with Key Results
   */
  async getOKRWithKeyResults(
    tenantId: string,
    okrId: string
  ): Promise<{
    okr: OKR;
    key_results: KeyResult[];
    progress_summary: {
      total_key_results: number;
      completed: number;
      on_track: number;
      at_risk: number;
      behind: number;
    };
  }> {
    const [okrResult, keyResultsResult] = await Promise.all([
      pool.query(
        `
        SELECT o.*, e.first_name || ' ' || e.last_name as owner_name
        FROM okrs o
        LEFT JOIN employees e ON o.owner_id = e.id
        WHERE o.id = $1 AND o.tenant_id = $2
      `,
        [okrId, tenantId]
      ),
      pool.query(
        `
        SELECT kr.*, e.first_name || ' ' || e.last_name as owner_name
        FROM key_results kr
        LEFT JOIN employees e ON kr.owner_id = e.id
        WHERE kr.okr_id = $1 AND kr.tenant_id = $2
        ORDER BY kr.created_at ASC
      `,
        [okrId, tenantId]
      ),
    ]);

    if (okrResult.rows.length === 0) {
      throw new Error('OKR not found');
    }

    const keyResults = keyResultsResult.rows;
    const progressSummary = {
      total_key_results: keyResults.length,
      completed: keyResults.filter((kr) => kr.status === 'completed').length,
      on_track: keyResults.filter((kr) => kr.status === 'on_track').length,
      at_risk: keyResults.filter((kr) => kr.status === 'at_risk').length,
      behind: keyResults.filter((kr) => kr.status === 'behind').length,
    };

    return {
      okr: okrResult.rows[0],
      key_results: keyResults,
      progress_summary: progressSummary,
    };
  }

  /**
   * Create OKR Check-in
   */
  async createOKRCheckin(
    tenantId: string,
    okrId: string,
    checkin: {
      author_id?: string;
      created_by?: string;
      progress_snapshot?: number;
      overall_progress?: number;
      confidence_level?: number;
      status_update?: string;
      blockers?: string;
      achievements?: string;
      next_steps?: string;
      notes?: string;
      key_result_updates?: Array<{
        key_result_id: string;
        current_value: number;
        notes?: string;
      }>;
    }
  ): Promise<Record<string, unknown>> {
    const result = await pool.query(
      `
      INSERT INTO okr_checkins (
        tenant_id, okr_id, author_id, overall_progress, confidence_level,
        status_update, blockers, next_steps, key_result_updates
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        tenantId,
        okrId,
        checkin.author_id,
        checkin.overall_progress,
        checkin.confidence_level,
        checkin.status_update,
        checkin.blockers,
        checkin.next_steps,
        JSON.stringify(checkin.key_result_updates || []),
      ]
    );

    // Update key results if provided
    if (checkin.key_result_updates && checkin.key_result_updates.length > 0) {
      for (const update of checkin.key_result_updates) {
        await this.updateKeyResultProgress(tenantId, update.key_result_id, update.current_value);
      }
    }

    return result.rows[0];
  }

  // ===========================================================================
  // REVIEW CYCLES (Story 9.3)
  // ===========================================================================

  /**
   * Add participants to review cycle
   */
  async addReviewCycleParticipants(
    tenantId: string,
    cycleId: string,
    participantIds: string[]
  ): Promise<number> {
    let addedCount = 0;

    for (const employeeId of participantIds) {
      try {
        // Get manager for employee
        const empResult = await pool.query(
          'SELECT manager_id FROM employees WHERE id = $1 AND tenant_id = $2',
          [employeeId, tenantId]
        );

        const managerId = empResult.rows[0]?.manager_id;

        await pool.query(
          `
          INSERT INTO review_cycle_participants (tenant_id, review_cycle_id, employee_id, manager_id, status)
          VALUES ($1, $2, $3, $4, 'pending')
          ON CONFLICT (review_cycle_id, employee_id) DO NOTHING
        `,
          [tenantId, cycleId, employeeId, managerId]
        );

        addedCount++;
      } catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.performance-management');
      }
    }

    return addedCount;
  }

  /**
   * Get review cycle participants with status
   */
  async getReviewCycleParticipants(
    tenantId: string,
    cycleId: string,
    options: {
      status?: string;
      managerId?: string;
      orgUnitId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    participants: Record<string, unknown>[];
    total: number;
    status_summary: Record<string, number>;
  }> {
    const params: (string | number)[] = [tenantId, cycleId];
    let paramIndex = 3;

    let query = `
      SELECT rcp.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        e.org_unit_id,
        d.name as department_name,
        m.first_name || ' ' || m.last_name as manager_name
      FROM review_cycle_participants rcp
      JOIN employees e ON rcp.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      LEFT JOIN employees m ON rcp.manager_id = m.id
      WHERE rcp.tenant_id = $1 AND rcp.review_cycle_id = $2
    `;

    if (options.status) {
      query += ` AND rcp.status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    query += ` ORDER BY e.last_name, e.first_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(options.limit || 100, options.offset || 0);

    const [participantsResult, countResult, statusResult] = await Promise.all([
      pool.query(query, params),
      pool.query(
        `
        SELECT COUNT(*) FROM review_cycle_participants
        WHERE tenant_id = $1 AND review_cycle_id = $2
      `,
        [tenantId, cycleId]
      ),
      pool.query(
        `
        SELECT status, COUNT(*) as count
        FROM review_cycle_participants
        WHERE tenant_id = $1 AND review_cycle_id = $2
        GROUP BY status
      `,
        [tenantId, cycleId]
      ),
    ]);

    const statusSummary: Record<string, number> = {};
    for (const row of statusResult.rows) {
      statusSummary[row.status] = parseInt(row.count);
    }

    return {
      participants: participantsResult.rows,
      total: parseInt(countResult.rows[0].count),
      status_summary: statusSummary,
    };
  }

  /**
   * Update participant status
   */
  async updateParticipantStatus(
    tenantId: string,
    participantId: string,
    status: string,
    additionalUpdates?: {
      self_review_completed?: boolean;
      manager_review_completed?: boolean;
      calibrated?: boolean;
      acknowledged?: boolean;
    }
  ): Promise<Record<string, unknown>> {
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: (string | boolean)[] = [status];
    let paramIndex = 2;

    if (additionalUpdates?.self_review_completed !== undefined) {
      updates.push(`self_review_completed = $${paramIndex}`);
      values.push(additionalUpdates.self_review_completed);
      if (additionalUpdates.self_review_completed) {
        updates.push('self_review_completed_at = NOW()');
      }
      paramIndex++;
    }

    if (additionalUpdates?.manager_review_completed !== undefined) {
      updates.push(`manager_review_completed = $${paramIndex}`);
      values.push(additionalUpdates.manager_review_completed);
      if (additionalUpdates.manager_review_completed) {
        updates.push('manager_review_completed_at = NOW()');
      }
      paramIndex++;
    }

    if (additionalUpdates?.calibrated !== undefined) {
      updates.push(`calibrated = $${paramIndex}`);
      values.push(additionalUpdates.calibrated);
      if (additionalUpdates.calibrated) {
        updates.push('calibrated_at = NOW()');
      }
      paramIndex++;
    }

    if (additionalUpdates?.acknowledged !== undefined) {
      updates.push(`acknowledged = $${paramIndex}`);
      values.push(additionalUpdates.acknowledged);
      if (additionalUpdates.acknowledged) {
        updates.push('acknowledged_at = NOW()');
      }
      paramIndex++;
    }

    values.push(participantId, tenantId);

    const result = await pool.query(
      `
      UPDATE review_cycle_participants
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Participant not found');
    }

    return result.rows[0];
  }

  // ===========================================================================
  // CALIBRATION SESSIONS (Story 9.4)
  // ===========================================================================

  /**
   * Create calibration session
   */
  async createCalibrationSession(
    tenantId: string,
    session: Omit<CalibrationSession, 'id' | 'tenant_id'> & {
      status?: CalibrationSession['status'];
    }
  ): Promise<CalibrationSession> {
    const result = await pool.query(
      `
      INSERT INTO calibration_sessions (
        tenant_id, review_cycle_id, name, description, session_type,
        org_unit_id, scheduled_date, scheduled_end_date, location,
        meeting_link, facilitator_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
      [
        tenantId,
        session.review_cycle_id,
        session.name,
        session.description,
        session.session_type,
        session.org_unit_id,
        session.scheduled_date,
        session.scheduled_end_date,
        session.location,
        session.meeting_link,
        session.facilitator_id,
        session.status || 'scheduled',
      ]
    );

    return result.rows[0];
  }

  /**
   * Add calibration participants
   */
  async addCalibrationParticipants(
    tenantId: string,
    sessionId: string,
    participants: Array<{
      employee_id: string;
      participant_type: 'facilitator' | 'calibrator' | 'observer' | 'subject';
      pre_calibration_rating?: number;
    }>
  ): Promise<number> {
    let addedCount = 0;

    for (const p of participants) {
      try {
        await pool.query(
          `
          INSERT INTO calibration_participants (
            tenant_id, calibration_session_id, employee_id, participant_type, pre_calibration_rating
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (calibration_session_id, employee_id, participant_type) DO NOTHING
        `,
          [tenantId, sessionId, p.employee_id, p.participant_type, p.pre_calibration_rating]
        );
        addedCount++;
      } catch (_err) {
        logger.warn({ err: _err }, 'Silent catch in services.performance-management');
      }
    }

    return addedCount;
  }

  /**
   * Record calibration adjustment
   */
  async recordCalibrationAdjustment(
    tenantId: string,
    sessionId: string,
    adjustment: {
      employee_id: string;
      performance_review_id?: string;
      original_rating?: number;
      adjusted_rating?: number;
      rating_category?: string;
      adjustment_reason?: string;
      supporting_evidence?: string;
      proposed_by?: string;
      adjusted_by?: string;
      competency_adjustments?: Record<string, unknown>;
    }
  ): Promise<Record<string, unknown>> {
    const result = await pool.query(
      `
      INSERT INTO calibration_adjustments (
        tenant_id, calibration_session_id, employee_id,
        original_rating, adjusted_rating, rating_category,
        adjustment_reason, supporting_evidence, proposed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        tenantId,
        sessionId,
        adjustment.employee_id,
        adjustment.original_rating,
        adjustment.adjusted_rating,
        adjustment.rating_category,
        adjustment.adjustment_reason,
        adjustment.supporting_evidence,
        adjustment.proposed_by,
      ]
    );

    // Update calibration participant with new rating
    await pool.query(
      `
      UPDATE calibration_participants
      SET post_calibration_rating = $1, rating_changed = TRUE, updated_at = NOW()
      WHERE calibration_session_id = $2 AND employee_id = $3 AND participant_type = 'subject'
    `,
      [adjustment.adjusted_rating, sessionId, adjustment.employee_id]
    );

    return result.rows[0];
  }

  /**
   * Complete calibration session
   */
  async completeCalibrationSession(
    tenantId: string,
    sessionId: string,
    notes?: string,
    decisions?: Record<string, unknown>[]
  ): Promise<CalibrationSession> {
    const result = await pool.query(
      `
      UPDATE calibration_sessions
      SET status = 'completed', completed_at = NOW(), notes = $1, decisions = $2, updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `,
      [notes, JSON.stringify(decisions || []), sessionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Calibration session not found');
    }

    return result.rows[0];
  }

  /**
   * Get calibration session with participants
   */
  async getCalibrationSessionDetails(
    tenantId: string,
    sessionId: string
  ): Promise<{
    session: CalibrationSession;
    facilitators: Record<string, unknown>[];
    calibrators: Record<string, unknown>[];
    subjects: Record<string, unknown>[];
    adjustments: Record<string, unknown>[];
  }> {
    const [sessionResult, participantsResult, adjustmentsResult] = await Promise.all([
      pool.query(
        `
        SELECT cs.*, rc.name as cycle_name, d.name as department_name,
               f.first_name || ' ' || f.last_name as facilitator_name
        FROM calibration_sessions cs
        LEFT JOIN review_cycles rc ON cs.review_cycle_id = rc.id
        LEFT JOIN org_units d ON cs.org_unit_id = d.id
        LEFT JOIN employees f ON cs.facilitator_id = f.id
        WHERE cs.id = $1 AND cs.tenant_id = $2
      `,
        [sessionId, tenantId]
      ),
      pool.query(
        `
        SELECT cp.*, e.first_name || ' ' || e.last_name as employee_name,
               e.job_title, e.org_unit_id
        FROM calibration_participants cp
        JOIN employees e ON cp.employee_id = e.id
        WHERE cp.calibration_session_id = $1 AND cp.tenant_id = $2
        ORDER BY cp.participant_type, e.last_name
      `,
        [sessionId, tenantId]
      ),
      pool.query(
        `
        SELECT ca.*, e.first_name || ' ' || e.last_name as employee_name,
               p.first_name || ' ' || p.last_name as proposed_by_name
        FROM calibration_adjustments ca
        JOIN employees e ON ca.employee_id = e.id
        LEFT JOIN employees p ON ca.proposed_by = p.id
        WHERE ca.calibration_session_id = $1 AND ca.tenant_id = $2
        ORDER BY ca.created_at DESC
      `,
        [sessionId, tenantId]
      ),
    ]);

    if (sessionResult.rows.length === 0) {
      throw new Error('Calibration session not found');
    }

    const participants = participantsResult.rows;

    return {
      session: sessionResult.rows[0],
      facilitators: participants.filter((p) => p.participant_type === 'facilitator'),
      calibrators: participants.filter((p) => p.participant_type === 'calibrator'),
      subjects: participants.filter((p) => p.participant_type === 'subject'),
      adjustments: adjustmentsResult.rows,
    };
  }

  // ===========================================================================
  // PERFORMANCE REVIEWS (Story 9.5)
  // ===========================================================================

  /**
   * Create self-review
   */
  async createSelfReview(
    tenantId: string,
    performanceReviewId: string,
    selfReview: {
      employee_id: string;
      self_rating?: number;
      self_overall_rating?: number;
      self_goal_rating?: number;
      self_competency_rating?: number;
      achievements?: string;
      challenges?: string;
      learnings?: string;
      development_goals?: string;
      goals_for_next_period?: string;
      feedback_for_manager?: string;
      competency_ratings?: Record<string, unknown>;
      competency_self_ratings?: Record<string, unknown>[];
      goal_self_assessments?: Record<string, unknown>[];
      additional_comments?: string;
    }
  ): Promise<Record<string, unknown>> {
    const result = await pool.query(
      `
      INSERT INTO self_reviews (
        tenant_id, performance_review_id, employee_id,
        self_overall_rating, self_goal_rating, self_competency_rating,
        achievements, challenges, learnings, goals_for_next_period, feedback_for_manager,
        competency_self_ratings, goal_self_assessments
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (performance_review_id) DO UPDATE SET
        self_overall_rating = EXCLUDED.self_overall_rating,
        self_goal_rating = EXCLUDED.self_goal_rating,
        self_competency_rating = EXCLUDED.self_competency_rating,
        achievements = EXCLUDED.achievements,
        challenges = EXCLUDED.challenges,
        learnings = EXCLUDED.learnings,
        goals_for_next_period = EXCLUDED.goals_for_next_period,
        feedback_for_manager = EXCLUDED.feedback_for_manager,
        competency_self_ratings = EXCLUDED.competency_self_ratings,
        goal_self_assessments = EXCLUDED.goal_self_assessments,
        updated_at = NOW()
      RETURNING *
    `,
      [
        tenantId,
        performanceReviewId,
        selfReview.employee_id,
        selfReview.self_overall_rating,
        selfReview.self_goal_rating,
        selfReview.self_competency_rating,
        selfReview.achievements,
        selfReview.challenges,
        selfReview.learnings,
        selfReview.goals_for_next_period,
        selfReview.feedback_for_manager,
        JSON.stringify(selfReview.competency_self_ratings || []),
        JSON.stringify(selfReview.goal_self_assessments || []),
      ]
    );

    return result.rows[0];
  }

  /**
   * Submit self-review
   */
  async submitSelfReview(tenantId: string, selfReviewId: string): Promise<Record<string, unknown>> {
    const result = await pool.query(
      `
      UPDATE self_reviews
      SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
      [selfReviewId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Self-review not found');
    }

    // Update performance review status
    await pool.query(
      `
      UPDATE performance_reviews
      SET status = 'pending', self_review_completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
      [result.rows[0].performance_review_id]
    );

    return result.rows[0];
  }

  /**
   * Request 360 feedback
   */
  async request360Feedback(
    tenantId: string,
    subjectId: string,
    raters: Array<{
      rater_id?: string;
      rater_type: string;
      is_anonymous?: boolean;
      due_date?: string;
    }>,
    reviewCycleId?: string
  ): Promise<Feedback360[]> {
    const results: Feedback360[] = [];

    for (const rater of raters) {
      const result = await pool.query(
        `
        INSERT INTO feedback_360 (
          tenant_id, review_cycle_id, subject_id, rater_id, rater_type, is_anonymous, due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
        [
          tenantId,
          reviewCycleId,
          subjectId,
          rater.rater_id,
          rater.rater_type,
          rater.is_anonymous !== false,
          rater.due_date,
        ]
      );
      results.push(result.rows[0]);
    }

    return results;
  }

  /**
   * Submit 360 feedback
   */
  async submit360Feedback(
    tenantId: string,
    feedbackId: string,
    feedback: {
      overall_rating?: number;
      competency_ratings?: Record<string, unknown>[];
      strengths?: string;
      development_areas?: string;
      areas_for_improvement?: string;
      additional_comments?: string;
      responses?: Record<string, unknown>[];
    }
  ): Promise<Feedback360> {
    const result = await pool.query(
      `
      UPDATE feedback_360
      SET overall_rating = $1, competency_ratings = $2, strengths = $3,
          development_areas = $4, additional_comments = $5, responses = $6,
          status = 'submitted', submitted_at = NOW(), updated_at = NOW()
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
    `,
      [
        feedback.overall_rating,
        JSON.stringify(feedback.competency_ratings || []),
        feedback.strengths,
        feedback.development_areas,
        feedback.additional_comments,
        JSON.stringify(feedback.responses || []),
        feedbackId,
        tenantId,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('360 Feedback not found');
    }

    return result.rows[0];
  }

  /**
   * Get 360 feedback summary for an employee
   */
  async get360FeedbackSummary(
    tenantId: string,
    subjectId: string,
    reviewCycleId?: string
  ): Promise<{
    total_requests: number;
    submitted: number;
    pending: number;
    declined: number;
    avg_rating: number | null;
    by_rater_type: Record<string, { count: number; avg_rating: number | null }>;
    feedback_items: Record<string, unknown>[];
  }> {
    const params: string[] = [tenantId, subjectId];
    let cycleFilter = '';

    if (reviewCycleId) {
      cycleFilter = ' AND review_cycle_id = $3';
      params.push(reviewCycleId);
    }

    const result = await pool.query(
      `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in_progress') as pending,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        ROUND(AVG(overall_rating) FILTER (WHERE status = 'submitted'), 2) as avg_rating
      FROM feedback_360
      WHERE tenant_id = $1 AND subject_id = $2${cycleFilter}
    `,
      params
    );

    const byTypeResult = await pool.query(
      `
      SELECT
        rater_type,
        COUNT(*) as count,
        ROUND(AVG(overall_rating) FILTER (WHERE status = 'submitted'), 2) as avg_rating
      FROM feedback_360
      WHERE tenant_id = $1 AND subject_id = $2${cycleFilter}
      GROUP BY rater_type
    `,
      params
    );

    const feedbackResult = await pool.query(
      `
      SELECT f.*,
        CASE WHEN f.is_anonymous THEN 'Anonymous' ELSE r.first_name || ' ' || r.last_name END as rater_name
      FROM feedback_360 f
      LEFT JOIN employees r ON f.rater_id = r.id
      WHERE f.tenant_id = $1 AND f.subject_id = $2${cycleFilter} AND f.status = 'submitted'
      ORDER BY f.submitted_at DESC
    `,
      params
    );

    const byRaterType: Record<string, { count: number; avg_rating: number | null }> = {};
    for (const row of byTypeResult.rows) {
      byRaterType[row.rater_type] = {
        count: parseInt(row.count),
        avg_rating: row.avg_rating ? parseFloat(row.avg_rating) : null,
      };
    }

    return {
      total_requests: parseInt(result.rows[0].total),
      submitted: parseInt(result.rows[0].submitted),
      pending: parseInt(result.rows[0].pending),
      declined: parseInt(result.rows[0].declined),
      avg_rating: result.rows[0].avg_rating ? parseFloat(result.rows[0].avg_rating) : null,
      by_rater_type: byRaterType,
      feedback_items: feedbackResult.rows,
    };
  }

  /**
   * Get 9-box grid data
   */
  async get9BoxGrid(
    tenantId: string,
    reviewCycleId?: string
  ): Promise<{
    grid: Record<string, Record<string, unknown>[]>;
    summary: {
      total: number;
      by_category: Record<string, number>;
    };
  }> {
    const params: string[] = [tenantId];
    let cycleFilter = '';

    if (reviewCycleId) {
      cycleFilter = ' AND pr.review_cycle_id = $2';
      params.push(reviewCycleId);
    }

    const result = await pool.query(
      `
      SELECT
        pr.employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.job_title,
        d.name as department,
        pr.overall_rating,
        pr.potential_rating,
        pr.performance_box,
        pr.potential_box,
        CASE
          WHEN pr.performance_box = 3 AND pr.potential_box = 3 THEN 'Star'
          WHEN pr.performance_box = 3 AND pr.potential_box = 2 THEN 'High Performer'
          WHEN pr.performance_box = 3 AND pr.potential_box = 1 THEN 'Consistent Performer'
          WHEN pr.performance_box = 2 AND pr.potential_box = 3 THEN 'High Potential'
          WHEN pr.performance_box = 2 AND pr.potential_box = 2 THEN 'Core Player'
          WHEN pr.performance_box = 2 AND pr.potential_box = 1 THEN 'Solid Performer'
          WHEN pr.performance_box = 1 AND pr.potential_box = 3 THEN 'Rough Diamond'
          WHEN pr.performance_box = 1 AND pr.potential_box = 2 THEN 'Inconsistent'
          WHEN pr.performance_box = 1 AND pr.potential_box = 1 THEN 'Risk'
          ELSE 'Not Rated'
        END as category
      FROM performance_reviews pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN org_units d ON e.org_unit_id = d.id
      WHERE pr.tenant_id = $1
        AND pr.status = 'completed'
        AND pr.performance_box IS NOT NULL
        AND pr.potential_box IS NOT NULL
        ${cycleFilter}
      ORDER BY pr.performance_box DESC, pr.potential_box DESC
    `,
      params
    );

    // Initialize grid structure
    const grid: Record<string, Record<string, unknown>[]> = {
      '1_1': [],
      '1_2': [],
      '1_3': [],
      '2_1': [],
      '2_2': [],
      '2_3': [],
      '3_1': [],
      '3_2': [],
      '3_3': [],
    };

    const byCategory: Record<string, number> = {};

    for (const row of result.rows) {
      const key = `${row.performance_box}_${row.potential_box}`;
      if (grid[key]) {
        grid[key].push(row);
      }
      byCategory[row.category] = (byCategory[row.category] || 0) + 1;
    }

    return {
      grid,
      summary: {
        total: result.rows.length,
        by_category: byCategory,
      },
    };
  }

  /**
   * Get competency frameworks
   */
  async getCompetencyFrameworks(tenantId: string): Promise<Record<string, unknown>[]> {
    const result = await pool.query(
      `
      SELECT cf.*,
        (SELECT COUNT(*) FROM competencies c WHERE c.framework_id = cf.id) as competency_count
      FROM competency_frameworks cf
      WHERE cf.tenant_id = $1 AND cf.is_active = TRUE
      ORDER BY cf.framework_type, cf.name
    `,
      [tenantId]
    );
    return result.rows;
  }

  /**
   * Get competencies for a framework
   */
  async getFrameworkCompetencies(
    tenantId: string,
    frameworkId: string
  ): Promise<Record<string, unknown>[]> {
    const result = await pool.query(
      `
      SELECT * FROM competencies
      WHERE tenant_id = $1 AND framework_id = $2 AND is_active = TRUE
      ORDER BY sort_order, name
    `,
      [tenantId, frameworkId]
    );
    return result.rows;
  }

  /**
   * Get rating scales
   */
  async getRatingScales(tenantId: string): Promise<Record<string, unknown>[]> {
    const result = await pool.query(
      `
      SELECT * FROM rating_scales
      WHERE tenant_id = $1 AND is_active = TRUE
      ORDER BY is_default DESC, name
    `,
      [tenantId]
    );
    return result.rows;
  }
}

// Export singleton instance
export const performanceManagementService = new PerformanceManagementService();
