/**
 * Inference Review Workflow Routes
 * API endpoints for reviewing AI-inferred skill relations
 * Epic: E-ONTO-02 (AI Integration)
 * Story: S-ONTO-02-05 (Inferred Relations Review Workflow)
 * Created: 2025-12-22
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { approveInferenceSchema, rejectInferenceSchema, bulkInferenceSchema, bulkByFilterInferenceSchema, } from '../schemas/skills-extended.js';
import { asyncHandler } from '../errors/middleware.js';
import { Errors } from '../errors/factory.js';
import { buildMeta } from '../utils/pagination.js';
import { logger } from '../config/logger.js';
import { safeParseInt } from '../utils/query-helpers.js';
const router = Router();
// =============================================================================
// PENDING RELATIONS
// =============================================================================
/**
 * GET /inference/pending
 * List pending AI-inferred relations awaiting review
 */
router.get('/pending', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { limit, offset, relationType, minConfidence, sortBy } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 20, max: 100 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    const minConf = parseFloat(minConfidence) || 0;
    let query = `
      SELECT
        r.id,
        r.source_skill_id,
        s1.preferred_label_en as source_skill_label,
        r.target_skill_id,
        s2.preferred_label_en as target_skill_label,
        r.relation_type,
        r.strength,
        r.confidence,
        r.context,
        r.model_version,
        r.inference_date,
        r.created_at
      FROM ontology_skill_relations r
      JOIN esco_skills s1 ON r.source_skill_id = s1.id
      JOIN esco_skills s2 ON r.target_skill_id = s2.id
      WHERE r.source = 'ai_inferred'
        AND r.approval_status = 'pending'
    `;
    const params = [];
    let paramIndex = 1;
    if (relationType) {
        query += ` AND r.relation_type = $${paramIndex++}`;
        params.push(relationType);
    }
    if (minConf > 0) {
        query += ` AND r.confidence >= $${paramIndex++}`;
        params.push(minConf);
    }
    // Sorting — values are hardcoded safe SQL fragments
    const sortOptions = {
        confidence_desc: 'r.confidence DESC',
        confidence_asc: 'r.confidence ASC',
        date_desc: 'r.inference_date DESC',
        date_asc: 'r.inference_date ASC',
        strength_desc: 'r.strength DESC',
    };
    const validSortKey = Object.hasOwn(sortOptions, sortBy)
        ? sortBy
        : 'confidence_desc';
    const orderBy = sortOptions[validSortKey];
    query += ` ORDER BY ${orderBy}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limitNum, offsetNum);
    const result = await dbClient.query(query, params);
    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM ontology_skill_relations
      WHERE source = 'ai_inferred' AND approval_status = 'pending'
    `;
    const countParams = [];
    let countIdx = 1;
    if (relationType) {
        countQuery += ` AND relation_type = $${countIdx++}`;
        countParams.push(relationType);
    }
    if (minConf > 0) {
        countQuery += ` AND confidence >= $${countIdx}`;
        countParams.push(minConf);
    }
    const countResult = await dbClient.query(countQuery, countParams);
    const relations = result.rows.map((row) => ({
        id: row.id,
        sourceSkillId: row.source_skill_id,
        sourceSkillLabel: row.source_skill_label,
        targetSkillId: row.target_skill_id,
        targetSkillLabel: row.target_skill_label,
        relationType: row.relation_type,
        strength: parseFloat(row.strength),
        confidence: parseFloat(row.confidence),
        context: row.context,
        modelVersion: row.model_version,
        inferenceDate: row.inference_date,
        createdAt: row.created_at,
    }));
    res.json({
        success: true,
        data: {
            relations,
            meta: buildMeta(parseInt(countResult.rows[0]?.count), limitNum, offsetNum),
        },
    });
}));
// =============================================================================
// APPROVE/REJECT SINGLE
// =============================================================================
/**
 * POST /inference/:id/approve
 * Approve a pending inferred relation
 */
router.post('/:id/approve', validate(approveInferenceSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id } = req.params;
    const { reviewerId, notes } = req.body;
    if (!id) {
        throw Errors.badRequest('Relation ID is required');
    }
    // Check if relation exists and is pending
    const checkResult = await dbClient.query(`SELECT id, approval_status FROM ontology_skill_relations WHERE id = $1`, [id]);
    if (checkResult.rows.length === 0) {
        throw Errors.notFound('Relation', id);
    }
    if (checkResult.rows[0].approval_status !== 'pending') {
        throw Errors.badRequest(`Relation is already ${checkResult.rows[0]?.approval_status}`);
    }
    // Approve the relation
    const result = await dbClient.query(`
      UPDATE ontology_skill_relations
      SET
        approval_status = 'approved',
        approved_by = $2,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, reviewerId || null]);
    // Log the review action
    await logReviewAction(dbClient, id, 'approved', reviewerId, notes);
    res.json({
        success: true,
        data: {
            id: result.rows[0]?.id,
            status: 'approved',
            approvedAt: result.rows[0]?.approved_at,
        },
    });
}));
/**
 * POST /inference/:id/reject
 * Reject a pending inferred relation
 */
router.post('/:id/reject', validate(rejectInferenceSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { id } = req.params;
    const { reviewerId, reason } = req.body;
    if (!id) {
        throw Errors.badRequest('Relation ID is required');
    }
    // Check if relation exists and is pending
    const checkResult = await dbClient.query(`SELECT id, approval_status FROM ontology_skill_relations WHERE id = $1`, [id]);
    if (checkResult.rows.length === 0) {
        throw Errors.notFound('Relation', id);
    }
    if (checkResult.rows[0].approval_status !== 'pending') {
        throw Errors.badRequest(`Relation is already ${checkResult.rows[0]?.approval_status}`);
    }
    // Reject the relation
    const result = await dbClient.query(`
      UPDATE ontology_skill_relations
      SET
        approval_status = 'rejected',
        approved_by = $2,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, reviewerId || null]);
    // Log the review action
    await logReviewAction(dbClient, id, 'rejected', reviewerId, reason);
    res.json({
        success: true,
        data: {
            id: result.rows[0]?.id,
            status: 'rejected',
            rejectedAt: result.rows[0]?.approved_at,
        },
    });
}));
// =============================================================================
// BULK OPERATIONS
// =============================================================================
/**
 * POST /inference/bulk
 * Bulk approve or reject multiple relations
 */
router.post('/bulk', validate(bulkInferenceSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { action, relationIds, reviewerId, notes } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
        throw Errors.badRequest('action must be "approve" or "reject"');
    }
    if (!Array.isArray(relationIds) || relationIds.length === 0) {
        throw Errors.badRequest('relationIds array is required and must not be empty');
    }
    if (relationIds.length > 100) {
        throw Errors.badRequest('Maximum 100 relations per bulk operation');
    }
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    // Update all relations
    const result = await dbClient.query(`
      UPDATE ontology_skill_relations
      SET
        approval_status = $1,
        approved_by = $2,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ANY($3)
        AND approval_status = 'pending'
      RETURNING id
    `, [newStatus, reviewerId || null, relationIds]);
    const updatedCount = result.rows.length;
    // Log bulk action
    for (const row of result.rows) {
        await logReviewAction(dbClient, row.id, newStatus, reviewerId, notes);
    }
    res.json({
        success: true,
        data: {
            action,
            requested: relationIds.length,
            updated: updatedCount,
            skipped: relationIds.length - updatedCount,
            message: `${updatedCount} relations ${newStatus}`,
        },
    });
}));
/**
 * POST /inference/bulk-by-filter
 * Bulk approve/reject relations matching filter criteria
 */
router.post('/bulk-by-filter', validate(bulkByFilterInferenceSchema), asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { action, filter, reviewerId, notes, limit } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
        throw Errors.badRequest('action must be "approve" or "reject"');
    }
    const maxLimit = Math.min(limit || 50, 500);
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    let query = `
      UPDATE ontology_skill_relations
      SET
        approval_status = $1,
        approved_by = $2,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id IN (
        SELECT id FROM ontology_skill_relations
        WHERE source = 'ai_inferred'
          AND approval_status = 'pending'
    `;
    const params = [newStatus, reviewerId || null];
    let paramIndex = 3;
    if (filter?.relationType) {
        query += ` AND relation_type = $${paramIndex++}`;
        params.push(filter.relationType);
    }
    if (filter?.minConfidence) {
        query += ` AND confidence >= $${paramIndex++}`;
        params.push(filter.minConfidence);
    }
    if (filter?.maxAge) {
        query += ` AND inference_date >= NOW() - $${paramIndex++}::INTERVAL`;
        params.push(`${filter.maxAge} days`);
    }
    query += ` LIMIT $${paramIndex}`;
    params.push(maxLimit);
    query += `) RETURNING id`;
    const result = await dbClient.query(query, params);
    // Log bulk action
    for (const row of result.rows) {
        await logReviewAction(dbClient, row.id, newStatus, reviewerId, notes);
    }
    res.json({
        success: true,
        data: {
            action,
            updated: result.rows.length,
            message: `${result.rows.length} relations ${newStatus}`,
        },
    });
}));
// =============================================================================
// METRICS
// =============================================================================
/**
 * GET /inference/metrics
 * Get review workflow metrics
 */
router.get('/metrics', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    // Get counts by status
    const statusResult = await dbClient.query(`
      SELECT
        approval_status,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
      FROM ontology_skill_relations
      WHERE source = 'ai_inferred'
      GROUP BY approval_status
    `);
    const statusCounts = {
        pending: 0,
        approved: 0,
        rejected: 0,
    };
    let avgConfidence = 0;
    let totalInferred = 0;
    for (const row of statusResult.rows) {
        statusCounts[row.approval_status] = parseInt(row.count);
        totalInferred += parseInt(row.count);
        if (row.approval_status === 'pending') {
            avgConfidence = parseFloat(row.avg_confidence) || 0;
        }
    }
    // Get counts by relation type
    const typeResult = await dbClient.query(`
      SELECT
        relation_type,
        approval_status,
        COUNT(*) as count
      FROM ontology_skill_relations
      WHERE source = 'ai_inferred'
      GROUP BY relation_type, approval_status
      ORDER BY relation_type
    `);
    const byRelationType = {};
    for (const row of typeResult.rows) {
        const relType = row.relation_type;
        if (!byRelationType[relType]) {
            byRelationType[relType] = { pending: 0, approved: 0, rejected: 0 };
        }
        const typeEntry = byRelationType[relType];
        if (typeEntry) {
            const status = row.approval_status;
            typeEntry[status] = parseInt(row.count);
        }
    }
    // Get recent activity (last 7 days)
    const activityResult = await dbClient.query(`
      SELECT
        DATE(approved_at) as date,
        approval_status,
        COUNT(*) as count
      FROM ontology_skill_relations
      WHERE source = 'ai_inferred'
        AND approved_at IS NOT NULL
        AND approved_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(approved_at), approval_status
      ORDER BY date DESC
    `);
    const activityMap = {};
    for (const row of activityResult.rows) {
        const dateStr = row.date.toISOString().split('T')[0];
        if (!activityMap[dateStr]) {
            activityMap[dateStr] = { approved: 0, rejected: 0 };
        }
        if (row.approval_status === 'approved') {
            activityMap[dateStr].approved = parseInt(row.count);
        }
        else if (row.approval_status === 'rejected') {
            activityMap[dateStr].rejected = parseInt(row.count);
        }
    }
    const recentActivity = Object.entries(activityMap).map(([date, counts]) => ({
        date,
        approved: counts.approved,
        rejected: counts.rejected,
    }));
    const pendingCount = statusCounts.pending ?? 0;
    const approvedCount = statusCounts.approved ?? 0;
    const rejectedCount = statusCounts.rejected ?? 0;
    const totalReviewed = approvedCount + rejectedCount;
    const approvalRate = totalReviewed > 0 ? Math.round((approvedCount / totalReviewed) * 100) / 100 : 0;
    const metrics = {
        totalPending: pendingCount,
        totalApproved: approvedCount,
        totalRejected: rejectedCount,
        approvalRate,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
        byRelationType,
        recentActivity,
    };
    res.json({
        success: true,
        data: metrics,
    });
}));
/**
 * GET /inference/activity
 * Get recent review activity log
 */
router.get('/activity', asyncHandler(async (req, res) => {
    const dbClient = req.dbClient;
    const { limit, offset } = req.query;
    const limitNum = safeParseInt(limit, { fallback: 20, max: 100 });
    const offsetNum = safeParseInt(offset, { fallback: 0 });
    const result = await dbClient.query(`
      SELECT
        r.id,
        s1.preferred_label_en as source_skill,
        s2.preferred_label_en as target_skill,
        r.relation_type,
        r.approval_status,
        r.confidence,
        r.approved_at,
        r.approved_by
      FROM ontology_skill_relations r
      JOIN esco_skills s1 ON r.source_skill_id = s1.id
      JOIN esco_skills s2 ON r.target_skill_id = s2.id
      WHERE r.source = 'ai_inferred'
        AND r.approved_at IS NOT NULL
      ORDER BY r.approved_at DESC
      LIMIT $1 OFFSET $2
    `, [limitNum, offsetNum]);
    res.json({
        success: true,
        data: {
            activity: result.rows.map((row) => ({
                id: row.id,
                sourceSkill: row.source_skill,
                targetSkill: row.target_skill,
                relationType: row.relation_type,
                status: row.approval_status,
                confidence: parseFloat(row.confidence),
                reviewedAt: row.approved_at,
                reviewerId: row.approved_by,
            })),
            meta: {
                total: offsetNum + result.rows.length,
                limit: limitNum,
                offset: offsetNum,
                hasMore: result.rows.length === limitNum,
            },
        },
    });
}));
// =============================================================================
// HELPERS
// =============================================================================
/**
 * Log a review action for audit purposes
 */
async function logReviewAction(dbClient, relationId, action, reviewerId, notes) {
    try {
        // Use the audit_logs table if it exists, otherwise just log
        await dbClient.query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, user_id, details, created_at)
      VALUES ('ontology_skill_relation', $1, $2, $3, $4, NOW())
      ON CONFLICT DO NOTHING
    `, [relationId, `inference_${action}`, reviewerId || null, JSON.stringify({ notes })]);
    }
    catch {
        // Audit logging is best-effort, don't fail the main operation
        logger.warn(`Failed to log review action for relation ${relationId}`);
    }
}
export default router;
//# sourceMappingURL=inference-review.js.map