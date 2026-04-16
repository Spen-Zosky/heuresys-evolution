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
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
export type DeliveryMethod = 'email' | 'download' | 'notification';
export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export interface ScheduleConfig {
    frequency: ScheduleFrequency;
    time: string;
    timezone?: string;
    day_of_week?: DayOfWeek;
    day_of_month?: number;
    month_of_year?: number;
    cron_expression?: string;
}
export interface DeliveryConfig {
    methods: DeliveryMethod[];
    format: ExportFormat;
    email_recipients?: string[];
    email_subject_template?: string;
    email_body_template?: string;
    include_inline?: boolean;
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
export declare class ReportSubscriptionsService {
    /**
     * Create a new subscription
     */
    createSubscription(input: SubscriptionInput): Promise<Record<string, any> | null>;
    /**
     * Get subscription by ID
     */
    getSubscription(tenantId: string, subscriptionId: string): Promise<Record<string, any> | null>;
    /**
     * List subscriptions
     */
    listSubscriptions(tenantId: string, options?: {
        report_id?: string;
        user_id?: string;
        is_active?: boolean;
        page?: number;
        page_size?: number;
    }): Promise<{
        subscriptions: Record<string, unknown>[];
        total: number;
    }>;
    /**
     * Update subscription
     */
    updateSubscription(tenantId: string, subscriptionId: string, updates: SubscriptionUpdate): Promise<Record<string, any> | null>;
    /**
     * Delete subscription
     */
    deleteSubscription(tenantId: string, subscriptionId: string): Promise<boolean>;
    /**
     * Pause subscription
     */
    pauseSubscription(tenantId: string, subscriptionId: string): Promise<Record<string, any> | null>;
    /**
     * Resume subscription
     */
    resumeSubscription(tenantId: string, subscriptionId: string): Promise<Record<string, any> | null>;
    /**
     * Calculate the next run time based on schedule
     */
    calculateNextRun(schedule: ScheduleConfig): Date;
    /**
     * Get subscriptions due for execution
     */
    getDueSubscriptions(limit?: number): Promise<Record<string, any>[]>;
    /**
     * Execute a subscription (run report and deliver)
     */
    executeSubscription(subscriptionId: string): Promise<Record<string, any> | null>;
    /**
     * Deliver report via specific method
     */
    private deliver;
    /**
     * Deliver report by email
     */
    private deliverByEmail;
    /**
     * Create download link for report
     */
    private createDownloadLink;
    /**
     * Send in-app notification
     */
    private sendNotification;
    /**
     * Log delivery attempt
     */
    private logDelivery;
    /**
     * Get delivery history for a subscription
     */
    getDeliveryHistory(tenantId: string, subscriptionId: string, limit?: number): Promise<Record<string, any>[]>;
    /**
     * Get delivery statistics
     */
    getDeliveryStats(tenantId: string, subscriptionId?: string): Promise<Record<string, any> | null>;
    /**
     * Manually trigger a subscription run
     */
    triggerNow(tenantId: string, subscriptionId: string): Promise<Record<string, any> | null>;
}
export declare const reportSubscriptionsService: ReportSubscriptionsService;
//# sourceMappingURL=report-subscriptions.d.ts.map