"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertNotificationModel = void 0;
const supabase_1 = require("../client/supabase");
class AlertNotificationModel {
    /**
     * Create a new alert notification
     */
    static async create(notificationData) {
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .insert({
            alert_rule_id: notificationData.alertRuleId,
            metric_value: notificationData.metricValue,
            notification_channels: notificationData.notificationChannels,
            delivery_status: notificationData.deliveryStatus || {},
            triggered_at: notificationData.triggeredAt || new Date().toISOString()
        })
            .select()
            .single();
        if (error) {
            console.error('Error creating alert notification:', error);
            return null;
        }
        return data;
    }
    /**
     * Get alert notifications with filtering
     */
    static async getNotifications(filters, page = 1, limit = 50) {
        let query = supabase_1.supabase
            .from('alert_notifications')
            .select('*', { count: 'exact' });
        // Apply filters
        if (filters?.alertRuleId) {
            query = query.eq('alert_rule_id', filters.alertRuleId);
        }
        if (filters?.channel) {
            query = query.contains('notification_channels', [filters.channel]);
        }
        if (filters?.startTime) {
            query = query.gte('triggered_at', filters.startTime);
        }
        if (filters?.endTime) {
            query = query.lte('triggered_at', filters.endTime);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query
            .order('triggered_at', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            console.error('Error fetching alert notifications:', error);
            return { notifications: [], total: 0 };
        }
        return {
            notifications: data || [],
            total: count || 0
        };
    }
    /**
     * Get notification by ID
     */
    static async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            console.error('Error fetching alert notification by ID:', error);
            return null;
        }
        return data;
    }
    /**
     * Update delivery status for a specific channel
     */
    static async updateDeliveryStatus(id, channel, status, errorMessage) {
        // Get current notification to update delivery status
        const current = await this.getById(id);
        if (!current)
            return null;
        const updatedDeliveryStatus = {
            ...(current.delivery_status || {}),
            [channel]: status
        };
        if (errorMessage && status === 'failed') {
            updatedDeliveryStatus[`${channel}_error`] = errorMessage;
        }
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .update({
            delivery_status: updatedDeliveryStatus
        })
            .eq('id', id)
            .select()
            .single();
        if (error) {
            console.error('Error updating delivery status:', error);
            return null;
        }
        return data;
    }
    /**
     * Get notifications for a specific alert rule
     */
    static async getByAlertRule(alertRuleId, hours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .select('*')
            .eq('alert_rule_id', alertRuleId)
            .gte('triggered_at', since.toISOString())
            .order('triggered_at', { ascending: false });
        if (error) {
            console.error('Error fetching notifications by alert rule:', error);
            return [];
        }
        return data || [];
    }
    /**
     * Get recent notifications for dashboard
     */
    static async getRecentNotifications(limit = 20, hours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .select('*')
            .gte('triggered_at', since.toISOString())
            .order('triggered_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('Error fetching recent notifications:', error);
            return [];
        }
        return data || [];
    }
    /**
     * Get failed notifications for retry
     */
    static async getFailedNotifications(hours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .select('*')
            .gte('triggered_at', since.toISOString())
            .order('triggered_at', { ascending: false });
        if (error) {
            console.error('Error fetching failed notifications:', error);
            return [];
        }
        const failedNotifications = [];
        data?.forEach(notification => {
            const deliveryStatus = notification.delivery_status || {};
            const failedChannels = [];
            notification.notification_channels.forEach(channel => {
                if (deliveryStatus[channel] === 'failed') {
                    failedChannels.push(channel);
                }
            });
            if (failedChannels.length > 0) {
                failedNotifications.push({
                    notification,
                    failedChannels
                });
            }
        });
        return failedNotifications;
    }
    /**
     * Get notification statistics
     */
    static async getStatistics(days = 7) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .select('notification_channels, delivery_status, triggered_at')
            .gte('triggered_at', since.toISOString());
        if (error) {
            console.error('Error fetching notification statistics:', error);
            return {
                totalNotifications: 0,
                successfulDeliveries: 0,
                failedDeliveries: 0,
                channelStats: {
                    email: { sent: 0, failed: 0, successRate: 0 },
                    dashboard: { sent: 0, failed: 0, successRate: 0 },
                    sms: { sent: 0, failed: 0, successRate: 0 }
                },
                notificationsByDay: []
            };
        }
        const totalNotifications = data?.length || 0;
        let successfulDeliveries = 0;
        let failedDeliveries = 0;
        const channelStats = {
            email: { sent: 0, failed: 0, successRate: 0 },
            dashboard: { sent: 0, failed: 0, successRate: 0 },
            sms: { sent: 0, failed: 0, successRate: 0 }
        };
        // Group notifications by day
        const notificationsByDay = {};
        data?.forEach(notification => {
            const date = notification.triggered_at.split('T')[0];
            notificationsByDay[date] = (notificationsByDay[date] || 0) + 1;
            const deliveryStatus = notification.delivery_status || {};
            notification.notification_channels.forEach(channel => {
                const status = deliveryStatus[channel];
                if (status === 'sent') {
                    channelStats[channel].sent++;
                    successfulDeliveries++;
                }
                else if (status === 'failed') {
                    channelStats[channel].failed++;
                    failedDeliveries++;
                }
            });
        });
        // Calculate success rates
        Object.keys(channelStats).forEach(channel => {
            const stats = channelStats[channel];
            const total = stats.sent + stats.failed;
            stats.successRate = total > 0 ? (stats.sent / total) * 100 : 0;
        });
        const notificationsByDayArray = Object.keys(notificationsByDay).map(date => ({
            date,
            count: notificationsByDay[date]
        })).sort((a, b) => a.date.localeCompare(b.date));
        return {
            totalNotifications,
            successfulDeliveries,
            failedDeliveries,
            channelStats,
            notificationsByDay: notificationsByDayArray
        };
    }
    /**
     * Get notification frequency for alert rule
     */
    static async getNotificationFrequency(alertRuleId, hours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .select('triggered_at, metric_value')
            .eq('alert_rule_id', alertRuleId)
            .gte('triggered_at', since.toISOString())
            .order('triggered_at', { ascending: true });
        if (error) {
            console.error('Error fetching notification frequency:', error);
            return {
                totalNotifications: 0,
                avgTimeBetweenNotifications: 0,
                notifications: []
            };
        }
        const notifications = (data || []).map(n => ({
            triggeredAt: n.triggered_at,
            metricValue: n.metric_value
        }));
        const totalNotifications = notifications.length;
        let avgTimeBetweenNotifications = 0;
        if (totalNotifications > 1) {
            let totalTimeDiff = 0;
            for (let i = 1; i < notifications.length; i++) {
                const prevTime = new Date(notifications[i - 1].triggeredAt).getTime();
                const currentTime = new Date(notifications[i].triggeredAt).getTime();
                totalTimeDiff += currentTime - prevTime;
            }
            avgTimeBetweenNotifications = totalTimeDiff / (totalNotifications - 1) / (1000 * 60); // Convert to minutes
        }
        return {
            totalNotifications,
            avgTimeBetweenNotifications: Math.round(avgTimeBetweenNotifications * 100) / 100,
            notifications
        };
    }
    /**
     * Mark notification as sent for a channel
     */
    static async markAsSent(id, channel) {
        return this.updateDeliveryStatus(id, channel, 'sent');
    }
    /**
     * Mark notification as failed for a channel
     */
    static async markAsFailed(id, channel, errorMessage) {
        return this.updateDeliveryStatus(id, channel, 'failed', errorMessage);
    }
    /**
     * Mark notification as pending for a channel
     */
    static async markAsPending(id, channel) {
        return this.updateDeliveryStatus(id, channel, 'pending');
    }
    /**
     * Mark notification as retrying for a channel
     */
    static async markAsRetrying(id, channel) {
        return this.updateDeliveryStatus(id, channel, 'retrying');
    }
    /**
     * Get notifications with join to alert rules
     */
    static async getNotificationsWithRules(page = 1, limit = 50, hours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - hours);
        // This would require a more complex query joining with alert_rules
        // For now, we'll fetch notifications and rules separately
        const { data: notifications, error: notificationError, count } = await supabase_1.supabase
            .from('alert_notifications')
            .select('*', { count: 'exact' })
            .gte('triggered_at', since.toISOString())
            .order('triggered_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);
        if (notificationError) {
            console.error('Error fetching notifications with rules:', notificationError);
            return { notifications: [], total: 0 };
        }
        // Get unique alert rule IDs
        const ruleIds = [...new Set(notifications?.map(n => n.alert_rule_id) || [])];
        // Fetch alert rules
        const { data: rules, error: ruleError } = await supabase_1.supabase
            .from('alert_rules')
            .select('id, rule_name, metric_type')
            .in('id', ruleIds);
        if (ruleError) {
            console.error('Error fetching alert rules:', ruleError);
            return { notifications: [], total: 0 };
        }
        // Map rules by ID for easy lookup
        const ruleMap = new Map(rules?.map(rule => [rule.id, rule]) || []);
        // Combine notifications with rule data
        const notificationsWithRules = (notifications || []).map(notification => {
            const rule = ruleMap.get(notification.alert_rule_id);
            return {
                ...notification,
                rule_name: rule?.rule_name || 'Unknown Rule',
                metric_type: rule?.metric_type || 'unknown'
            };
        });
        return {
            notifications: notificationsWithRules,
            total: count || 0
        };
    }
    /**
     * Clean up old notifications (for data retention)
     */
    static async deleteOlderThan(days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const { data, error } = await supabase_1.supabase
            .from('alert_notifications')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Error deleting old alert notifications:', error);
            return 0;
        }
        return data?.length || 0;
    }
    /**
     * Get notification delivery health
     */
    static async getDeliveryHealth() {
        const stats = await this.getStatistics(7);
        const overallSuccessRate = stats.totalNotifications > 0
            ? (stats.successfulDeliveries / (stats.successfulDeliveries + stats.failedDeliveries)) * 100
            : 0;
        const channelHealth = {
            email: {
                isHealthy: stats.channelStats.email.successRate >= 95,
                successRate: stats.channelStats.email.successRate,
                recentFailures: stats.channelStats.email.failed
            },
            dashboard: {
                isHealthy: stats.channelStats.dashboard.successRate >= 99,
                successRate: stats.channelStats.dashboard.successRate,
                recentFailures: stats.channelStats.dashboard.failed
            },
            sms: {
                isHealthy: stats.channelStats.sms.successRate >= 90,
                successRate: stats.channelStats.sms.successRate,
                recentFailures: stats.channelStats.sms.failed
            }
        };
        // Simple trend analysis based on recent vs overall success rate
        // This is a simplified version - real implementation would compare time periods
        let recentTrend = 'stable';
        if (overallSuccessRate > 95) {
            recentTrend = 'improving';
        }
        else if (overallSuccessRate < 85) {
            recentTrend = 'degrading';
        }
        return {
            overallSuccessRate: Math.round(overallSuccessRate * 100) / 100,
            channelHealth,
            recentTrend
        };
    }
}
exports.AlertNotificationModel = AlertNotificationModel;
//# sourceMappingURL=alert-notifications.js.map