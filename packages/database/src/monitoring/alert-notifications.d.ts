export type AlertNotification = {
    id: string;
    alert_rule_id: string;
    triggered_at: string;
    metric_value: number;
    notification_channels: string[];
    delivery_status: Record<string, any>;
    created_at: string;
};
export type AlertNotificationInsert = Omit<AlertNotification, 'id' | 'created_at'> & {
    id?: string;
    created_at?: string;
};
export type AlertNotificationUpdate = Partial<Omit<AlertNotification, 'id' | 'created_at'>>;
export type NotificationChannel = 'email' | 'dashboard' | 'sms';
export type DeliveryStatus = 'sent' | 'failed' | 'pending' | 'retrying';
export interface NotificationData {
    alertRuleId: string;
    metricValue: number;
    notificationChannels: NotificationChannel[];
    deliveryStatus?: Record<NotificationChannel, DeliveryStatus>;
    triggeredAt?: string;
}
export interface NotificationFilters {
    alertRuleId?: string;
    channel?: NotificationChannel;
    deliveryStatus?: DeliveryStatus;
    startTime?: string;
    endTime?: string;
}
export declare class AlertNotificationModel {
    /**
     * Create a new alert notification
     */
    static create(notificationData: NotificationData): Promise<AlertNotification | null>;
    /**
     * Get alert notifications with filtering
     */
    static getNotifications(filters?: NotificationFilters, page?: number, limit?: number): Promise<{
        notifications: AlertNotification[];
        total: number;
    }>;
    /**
     * Get notification by ID
     */
    static getById(id: string): Promise<AlertNotification | null>;
    /**
     * Update delivery status for a specific channel
     */
    static updateDeliveryStatus(id: string, channel: NotificationChannel, status: DeliveryStatus, errorMessage?: string): Promise<AlertNotification | null>;
    /**
     * Get notifications for a specific alert rule
     */
    static getByAlertRule(alertRuleId: string, hours?: number): Promise<AlertNotification[]>;
    /**
     * Get recent notifications for dashboard
     */
    static getRecentNotifications(limit?: number, hours?: number): Promise<AlertNotification[]>;
    /**
     * Get failed notifications for retry
     */
    static getFailedNotifications(hours?: number): Promise<{
        notification: AlertNotification;
        failedChannels: NotificationChannel[];
    }[]>;
    /**
     * Get notification statistics
     */
    static getStatistics(days?: number): Promise<{
        totalNotifications: number;
        successfulDeliveries: number;
        failedDeliveries: number;
        channelStats: Record<NotificationChannel, {
            sent: number;
            failed: number;
            successRate: number;
        }>;
        notificationsByDay: {
            date: string;
            count: number;
        }[];
    }>;
    /**
     * Get notification frequency for alert rule
     */
    static getNotificationFrequency(alertRuleId: string, hours?: number): Promise<{
        totalNotifications: number;
        avgTimeBetweenNotifications: number;
        notifications: {
            triggeredAt: string;
            metricValue: number;
        }[];
    }>;
    /**
     * Mark notification as sent for a channel
     */
    static markAsSent(id: string, channel: NotificationChannel): Promise<AlertNotification | null>;
    /**
     * Mark notification as failed for a channel
     */
    static markAsFailed(id: string, channel: NotificationChannel, errorMessage?: string): Promise<AlertNotification | null>;
    /**
     * Mark notification as pending for a channel
     */
    static markAsPending(id: string, channel: NotificationChannel): Promise<AlertNotification | null>;
    /**
     * Mark notification as retrying for a channel
     */
    static markAsRetrying(id: string, channel: NotificationChannel): Promise<AlertNotification | null>;
    /**
     * Get notifications with join to alert rules
     */
    static getNotificationsWithRules(page?: number, limit?: number, hours?: number): Promise<{
        notifications: (AlertNotification & {
            rule_name: string;
            metric_type: string;
        })[];
        total: number;
    }>;
    /**
     * Clean up old notifications (for data retention)
     */
    static deleteOlderThan(days: number): Promise<number>;
    /**
     * Get notification delivery health
     */
    static getDeliveryHealth(): Promise<{
        overallSuccessRate: number;
        channelHealth: Record<NotificationChannel, {
            isHealthy: boolean;
            successRate: number;
            recentFailures: number;
        }>;
        recentTrend: 'improving' | 'degrading' | 'stable';
    }>;
}
//# sourceMappingURL=alert-notifications.d.ts.map