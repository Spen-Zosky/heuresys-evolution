/**
 * Report Subscriptions Service
 * Epic 7 - Story 7.3: Scheduled Reports & Subscriptions
 *
 * Features:
 * - Report scheduling (cron-based)
 * - Email delivery
 * - Download links
 * - In-app notifications
 * - Subscription management
 * - Delivery logging
 */

import { pool } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import { reportBuilderService } from './report-builder.js';
import { logger } from '../config/logger.js';

// ============================================================================
// Types
// ============================================================================

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
export type DeliveryMethod = 'email' | 'download' | 'notification';
export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string; // HH:mm format
  timezone?: string;
  day_of_week?: DayOfWeek; // For weekly
  day_of_month?: number; // For monthly
  month_of_year?: number; // For quarterly
  cron_expression?: string; // For custom
}

export interface DeliveryConfig {
  methods: DeliveryMethod[];
  format: ExportFormat;
  email_recipients?: string[];
  email_subject_template?: string;
  email_body_template?: string;
  include_inline?: boolean; // Include data inline in email
  notification_title?: string;
  notification_message?: string;
}

export interface SubscriptionInput {
  tenant_id: string;
  report_id: string;
  name: string;
  description?: string;
  schedule: ScheduleConfig;
  delivery: DeliveryConfig;
  parameters?: Record<string, any>;
  filters?: Record<string, unknown>[];
  created_by: string;
}

export interface SubscriptionUpdate {
  name?: string;
  description?: string;
  schedule?: ScheduleConfig;
  delivery?: DeliveryConfig;
  parameters?: Record<string, any>;
  filters?: Record<string, unknown>[];
  is_active?: boolean;
}

// ============================================================================
// Report Subscriptions Service
// ============================================================================

export class ReportSubscriptionsService {
  // ==========================================================================
  // Subscription CRUD
  // ==========================================================================

  /**
   * Create a new subscription
   */
  async createSubscription(input: SubscriptionInput): Promise<Record<string, any> | null> {
    const id = uuidv4();

    // Verify report exists
    const report = await reportBuilderService.getReport(input.tenant_id, input.report_id);
    if (!report) {
      throw new Error('Report not found');
    }

    // Calculate next run time
    const nextRunAt = this.calculateNextRun(input.schedule);

    const query = `
      INSERT INTO report_subscriptions (
        id, tenant_id, report_id, name, description,
        schedule, delivery_config, parameters, filters,
        is_active, next_run_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      input.tenant_id,
      input.report_id,
      input.name,
      input.description || null,
      JSON.stringify(input.schedule),
      JSON.stringify(input.delivery),
      JSON.stringify(input.parameters || {}),
      JSON.stringify(input.filters || []),
      nextRunAt,
      input.created_by,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(
    tenantId: string,
    subscriptionId: string
  ): Promise<Record<string, any> | null> {
    const query = `
      SELECT rs.*, rd.name as report_name, rd.data_source
      FROM report_subscriptions rs
      JOIN report_definitions rd ON rs.report_id = rd.id
      WHERE rs.id = $1 AND rs.tenant_id = $2
    `;

    const result = await pool.query(query, [subscriptionId, tenantId]);
    return result.rows[0] || null;
  }

  /**
   * List subscriptions
   */
  async listSubscriptions(
    tenantId: string,
    options?: {
      report_id?: string;
      user_id?: string;
      is_active?: boolean;
      page?: number;
      page_size?: number;
    }
  ): Promise<{ subscriptions: Record<string, unknown>[]; total: number }> {
    const conditions: string[] = ['rs.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options?.report_id) {
      conditions.push(`rs.report_id = $${paramIndex++}`);
      params.push(options.report_id);
    }

    if (options?.user_id) {
      conditions.push(`rs.created_by = $${paramIndex++}`);
      params.push(options.user_id);
    }

    if (options?.is_active !== undefined) {
      conditions.push(`rs.is_active = $${paramIndex++}`);
      params.push(options.is_active);
    }

    const page = options?.page || 1;
    const pageSize = options?.page_size || 20;
    const offset = (page - 1) * pageSize;

    // Count
    const countQuery = `
      SELECT COUNT(*) FROM report_subscriptions rs
      WHERE ${conditions.join(' AND ')}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // List
    const query = `
      SELECT rs.*, rd.name as report_name, rd.data_source
      FROM report_subscriptions rs
      JOIN report_definitions rd ON rs.report_id = rd.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY rs.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(pageSize, offset);

    const result = await pool.query(query, params);
    return { subscriptions: result.rows, total };
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    tenantId: string,
    subscriptionId: string,
    updates: SubscriptionUpdate
  ): Promise<Record<string, any> | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [subscriptionId, tenantId];
    let paramIndex = 3;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }

    if (updates.schedule !== undefined) {
      setClauses.push(`schedule = $${paramIndex++}`);
      params.push(JSON.stringify(updates.schedule));

      // Recalculate next run
      const nextRun = this.calculateNextRun(updates.schedule);
      setClauses.push(`next_run_at = $${paramIndex++}`);
      params.push(nextRun);
    }

    if (updates.delivery !== undefined) {
      setClauses.push(`delivery_config = $${paramIndex++}`);
      params.push(JSON.stringify(updates.delivery));
    }

    if (updates.parameters !== undefined) {
      setClauses.push(`parameters = $${paramIndex++}`);
      params.push(JSON.stringify(updates.parameters));
    }

    if (updates.filters !== undefined) {
      setClauses.push(`filters = $${paramIndex++}`);
      params.push(JSON.stringify(updates.filters));
    }

    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.is_active);
    }

    if (setClauses.length === 0) {
      return this.getSubscription(tenantId, subscriptionId);
    }

    setClauses.push('updated_at = NOW()');

    const query = `
      UPDATE report_subscriptions SET ${setClauses.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(tenantId: string, subscriptionId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM report_subscriptions WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [subscriptionId, tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(
    tenantId: string,
    subscriptionId: string
  ): Promise<Record<string, any> | null> {
    return this.updateSubscription(tenantId, subscriptionId, { is_active: false });
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(
    tenantId: string,
    subscriptionId: string
  ): Promise<Record<string, any> | null> {
    const subscription = await this.getSubscription(tenantId, subscriptionId);
    if (!subscription) {
      return null;
    }

    // Recalculate next run from now
    const schedule = subscription.schedule as ScheduleConfig;
    const nextRunAt = this.calculateNextRun(schedule);

    const query = `
      UPDATE report_subscriptions
      SET is_active = true, next_run_at = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [nextRunAt, subscriptionId, tenantId]);
    return result.rows[0];
  }

  // ==========================================================================
  // Scheduling Logic
  // ==========================================================================

  /**
   * Calculate the next run time based on schedule
   */
  calculateNextRun(schedule: ScheduleConfig): Date {
    const now = new Date();
    const timeParts = schedule.time.split(':').map(Number);
    const hours = timeParts[0] ?? 0;
    const minutes = timeParts[1] ?? 0;

    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has passed today, start from tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    switch (schedule.frequency) {
      case 'daily':
        // Already set to next occurrence
        break;

      case 'weekly':
        const dayMap: Record<DayOfWeek, number> = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        };
        const targetDay = dayMap[schedule.day_of_week || 'monday'];
        const currentDay = nextRun.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) {
          daysUntil += 7;
        }
        nextRun.setDate(nextRun.getDate() + daysUntil);
        break;

      case 'monthly':
        const targetDate = schedule.day_of_month || 1;
        nextRun.setDate(targetDate);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;

      case 'quarterly':
        const quarterMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
        const currentMonth = nextRun.getMonth();
        const foundQuarterMonth = quarterMonths.find((m) => m > currentMonth);
        let nextQuarterMonth: number;
        if (foundQuarterMonth !== undefined) {
          nextQuarterMonth = foundQuarterMonth;
        } else {
          nextQuarterMonth = quarterMonths[0]!;
          nextRun.setFullYear(nextRun.getFullYear() + 1);
        }
        nextRun.setMonth(nextQuarterMonth);
        nextRun.setDate(schedule.day_of_month ?? 1);
        break;

      case 'custom':
        // For custom cron, we'd need a cron parser
        // For now, default to daily
        break;
    }

    return nextRun;
  }

  /**
   * Get subscriptions due for execution
   */
  async getDueSubscriptions(limit: number = 100): Promise<Record<string, any>[]> {
    const query = `
      SELECT rs.*, rd.name as report_name, t.code as tenant_code
      FROM report_subscriptions rs
      JOIN report_definitions rd ON rs.report_id = rd.id
      JOIN tenants t ON rs.tenant_id = t.id
      WHERE rs.is_active = true
        AND rs.next_run_at <= NOW()
      ORDER BY rs.next_run_at
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // ==========================================================================
  // Execution & Delivery
  // ==========================================================================

  /**
   * Execute a subscription (run report and deliver)
   */
  async executeSubscription(subscriptionId: string): Promise<Record<string, any> | null> {
    const logId = uuidv4();
    const startTime = Date.now();

    // Get subscription
    const query = `
      SELECT rs.*, rd.name as report_name
      FROM report_subscriptions rs
      JOIN report_definitions rd ON rs.report_id = rd.id
      WHERE rs.id = $1
    `;
    const subResult = await pool.query(query, [subscriptionId]);
    const subscription = subResult.rows[0];

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    try {
      // Execute report
      const reportResult = await reportBuilderService.executeReport(
        subscription.tenant_id,
        subscription.report_id,
        {
          parameters: subscription.parameters,
          page: 1,
          page_size: 10000, // Max for subscription delivery
        }
      );

      // Deliver results
      const deliveryConfig = subscription.delivery_config as DeliveryConfig;
      const deliveryResults: Record<string, any> = {};

      for (const method of deliveryConfig.methods) {
        try {
          const result = await this.deliver(method, subscription, reportResult, deliveryConfig);
          deliveryResults[method] = { success: true, ...result };
        } catch (error) {
          deliveryResults[method] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      // Log delivery
      await this.logDelivery(logId, subscription, {
        status: 'success',
        row_count: reportResult.data.length,
        execution_time_ms: Date.now() - startTime,
        delivery_results: deliveryResults,
      });

      // Update next run time
      const schedule = subscription.schedule as ScheduleConfig;
      const nextRunAt = this.calculateNextRun(schedule);
      await pool.query(
        `UPDATE report_subscriptions SET next_run_at = $1, last_run_at = NOW(), run_count = run_count + 1
         WHERE id = $2`,
        [nextRunAt, subscriptionId]
      );

      return {
        success: true,
        log_id: logId,
        row_count: reportResult.data.length,
        delivery_results: deliveryResults,
      };
    } catch (error) {
      // Log failure
      await this.logDelivery(logId, subscription, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Deliver report via specific method
   */
  private async deliver(
    method: DeliveryMethod,
    subscription: Record<string, any>,
    reportResult: Record<string, any>,
    config: DeliveryConfig
  ): Promise<Record<string, any> | null> {
    switch (method) {
      case 'email':
        return this.deliverByEmail(subscription, reportResult, config);

      case 'download':
        return this.createDownloadLink(subscription, reportResult, config);

      case 'notification':
        return this.sendNotification(subscription, reportResult, config);

      default:
        throw new Error(`Unknown delivery method: ${method}`);
    }
  }

  /**
   * Deliver report by email
   */
  private async deliverByEmail(
    subscription: Record<string, any>,
    reportResult: Record<string, any>,
    config: DeliveryConfig
  ): Promise<Record<string, any> | null> {
    // In a real implementation, this would:
    // 1. Format data according to config.format
    // 2. Create email with template
    // 3. Attach file or inline data
    // 4. Send via email service

    const recipients = config.email_recipients || [];
    if (recipients.length === 0) {
      throw new Error('No email recipients configured');
    }

    // Simulate email delivery (would integrate with email service)
    logger.info(
      `[Email] Delivering report "${subscription.report_name}" to ${recipients.join(', ')}`
    );

    return {
      recipients,
      format: config.format,
      row_count: reportResult.data.length,
      delivered_at: new Date().toISOString(),
    };
  }

  /**
   * Create download link for report
   */
  private async createDownloadLink(
    subscription: Record<string, any>,
    reportResult: Record<string, any>,
    config: DeliveryConfig
  ): Promise<Record<string, any> | null> {
    // In a real implementation, this would:
    // 1. Export data to file
    // 2. Store in object storage
    // 3. Generate signed URL
    // 4. Set expiration

    const downloadId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    // Store download reference (in production, would also store the file)
    await pool.query(
      `
      INSERT INTO export_jobs (id, tenant_id, type, status, file_format, row_count, expires_at, created_by)
      VALUES ($1, $2, 'subscription_export', 'completed', $3, $4, $5, $6)
    `,
      [
        downloadId,
        subscription.tenant_id,
        config.format,
        reportResult.data.length,
        expiresAt,
        subscription.created_by,
      ]
    );

    return {
      download_id: downloadId,
      format: config.format,
      expires_at: expiresAt.toISOString(),
      // In production: download_url: signedUrl
    };
  }

  /**
   * Send in-app notification
   */
  private async sendNotification(
    subscription: Record<string, any>,
    reportResult: Record<string, any>,
    config: DeliveryConfig
  ): Promise<Record<string, any> | null> {
    const title = config.notification_title || `Report Ready: ${subscription.report_name}`;
    const message =
      config.notification_message ||
      `Your scheduled report "${subscription.report_name}" is ready with ${reportResult.data.length} rows.`;

    // Create notification
    await pool.query(
      `
      INSERT INTO notifications (id, tenant_id, user_id, type, title, message, data, created_at)
      VALUES ($1, $2, $3, 'report_ready', $4, $5, $6, NOW())
    `,
      [
        uuidv4(),
        subscription.tenant_id,
        subscription.created_by,
        title,
        message,
        JSON.stringify({
          subscription_id: subscription.id,
          report_id: subscription.report_id,
          row_count: reportResult.data.length,
        }),
      ]
    );

    return {
      notified_user: subscription.created_by,
      title,
      delivered_at: new Date().toISOString(),
    };
  }

  /**
   * Log delivery attempt
   */
  private async logDelivery(
    logId: string,
    subscription: Record<string, any>,
    details: {
      status: string;
      row_count?: number;
      error?: string;
      execution_time_ms: number;
      delivery_results?: Record<string, any>;
    }
  ): Promise<void> {
    await pool.query(
      `
      INSERT INTO report_delivery_log (
        id, subscription_id, tenant_id, status, row_count,
        error_message, execution_time_ms, delivery_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        logId,
        subscription.id,
        subscription.tenant_id,
        details.status,
        details.row_count || 0,
        details.error || null,
        details.execution_time_ms,
        JSON.stringify(details.delivery_results || {}),
      ]
    );
  }

  // ==========================================================================
  // Delivery History
  // ==========================================================================

  /**
   * Get delivery history for a subscription
   */
  async getDeliveryHistory(
    tenantId: string,
    subscriptionId: string,
    limit: number = 50
  ): Promise<Record<string, any>[]> {
    const query = `
      SELECT * FROM report_delivery_log
      WHERE subscription_id = $1 AND tenant_id = $2
      ORDER BY delivered_at DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [subscriptionId, tenantId, limit]);
    return result.rows;
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(
    tenantId: string,
    subscriptionId?: string
  ): Promise<Record<string, any> | null> {
    let query = `
      SELECT
        COUNT(*) as total_deliveries,
        COUNT(*) FILTER (WHERE status = 'success') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(execution_time_ms) as avg_execution_time,
        MAX(delivered_at) as last_delivery
      FROM report_delivery_log
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (subscriptionId) {
      query += ' AND subscription_id = $2';
      params.push(subscriptionId);
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Manually trigger a subscription run
   */
  async triggerNow(tenantId: string, subscriptionId: string): Promise<Record<string, any> | null> {
    const subscription = await this.getSubscription(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    return this.executeSubscription(subscriptionId);
  }
}

// Export singleton instance
export const reportSubscriptionsService = new ReportSubscriptionsService();
