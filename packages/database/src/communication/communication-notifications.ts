import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { 
  CommunicationNotification, 
  NotificationStatus, 
  NotificationType, 
  CommunicationChannel,
  RecipientType
} from '@vocilia/types/communication';

export class CommunicationNotificationModel {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a new communication notification
   */
  async create(notification: Omit<CommunicationNotification, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationNotification> {
    const { data, error } = await this.supabase
      .from('communication_notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data;
  }

  /**
   * Create multiple notifications in batch
   */
  async createBatch(notifications: Array<Omit<CommunicationNotification, 'id' | 'created_at' | 'updated_at'>>): Promise<CommunicationNotification[]> {
    const { data, error } = await this.supabase
      .from('communication_notifications')
      .insert(notifications)
      .select();

    if (error) {
      throw new Error(`Failed to create notifications batch: ${error.message}`);
    }

    return data;
  }

  /**
   * Get notification by ID
   */
  async findById(id: string): Promise<CommunicationNotification | null> {
    const { data, error } = await this.supabase
      .from('communication_notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to fetch notification: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Get notifications by recipient
   */
  async findByRecipient(
    recipientId: string, 
    recipientType: RecipientType,
    options: {
      limit?: number;
      offset?: number;
      status?: NotificationStatus;
      notificationType?: NotificationType;
      channel?: CommunicationChannel;
    } = {}
  ): Promise<CommunicationNotification[]> {
    let query = this.supabase
      .from('communication_notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .eq('recipient_type', recipientType)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.notificationType) {
      query = query.eq('notification_type', options.notificationType);
    }

    if (options.channel) {
      query = query.eq('channel', options.channel);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update notification status
   */
  async updateStatus(
    id: string, 
    status: NotificationStatus, 
    metadata?: { 
      delivered_at?: string; 
      failed_reason?: string; 
      retry_count?: number 
    }
  ): Promise<CommunicationNotification> {
    const updateData: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };

    if (metadata?.delivered_at) {
      updateData.delivered_at = metadata.delivered_at;
    }

    if (metadata?.failed_reason) {
      updateData.failed_reason = metadata.failed_reason;
    }

    if (metadata?.retry_count !== undefined) {
      updateData.retry_count = metadata.retry_count;
    }

    if (status === 'sent' && !updateData.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('communication_notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update notification status: ${error.message}`);
    }

    return data;
  }

  /**
   * Get notifications pending retry
   */
  async findPendingRetries(maxRetryCount: number = 3): Promise<CommunicationNotification[]> {
    const { data, error } = await this.supabase
      .from('communication_notifications')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', maxRetryCount)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch pending retries: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get notifications scheduled for delivery
   */
  async findScheduledNotifications(beforeTime?: string): Promise<CommunicationNotification[]> {
    const cutoffTime = beforeTime || new Date().toISOString();

    const { data, error } = await this.supabase
      .from('communication_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', cutoffTime)
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch scheduled notifications: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get notification statistics for a recipient
   */
  async getRecipientStats(
    recipientId: string, 
    recipientType: RecipientType,
    dateRange?: { start: string; end: string }
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    by_channel: Record<CommunicationChannel, number>;
    by_type: Record<NotificationType, number>;
  }> {
    let query = this.supabase
      .from('communication_notifications')
      .select('status, channel, notification_type')
      .eq('recipient_id', recipientId)
      .eq('recipient_type', recipientType);

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch notification stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      by_channel: {} as Record<CommunicationChannel, number>,
      by_type: {} as Record<NotificationType, number>
    };

    data?.forEach(notification => {
      if (notification.status === 'sent') stats.sent++;
      if (notification.status === 'delivered') stats.delivered++;
      if (notification.status === 'failed') stats.failed++;

      stats.by_channel[notification.channel] = (stats.by_channel[notification.channel] || 0) + 1;
      stats.by_type[notification.notification_type] = (stats.by_type[notification.notification_type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('communication_notifications')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old notifications: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Mark notifications as read (for admin tracking)
   */
  async markAsRead(ids: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('communication_notifications')
      .update({ 
        metadata: { read_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to mark notifications as read: ${error.message}`);
    }
  }

  /**
   * Get delivery rate metrics for monitoring
   */
  async getDeliveryMetrics(
    dateRange: { start: string; end: string },
    channel?: CommunicationChannel
  ): Promise<{
    total_sent: number;
    total_delivered: number;
    total_failed: number;
    delivery_rate: number;
    failure_rate: number;
    average_delivery_time_minutes: number;
  }> {
    let query = this.supabase
      .from('communication_notifications')
      .select('status, sent_at, delivered_at')
      .in('status', ['sent', 'delivered', 'failed'])
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch delivery metrics: ${error.message}`);
    }

    const metrics = {
      total_sent: 0,
      total_delivered: 0,
      total_failed: 0,
      delivery_rate: 0,
      failure_rate: 0,
      average_delivery_time_minutes: 0
    };

    let totalDeliveryTime = 0;
    let deliveredCount = 0;

    data?.forEach(notification => {
      if (notification.status === 'sent') metrics.total_sent++;
      if (notification.status === 'delivered') {
        metrics.total_delivered++;
        
        // Calculate delivery time if both timestamps available
        if (notification.sent_at && notification.delivered_at) {
          const sentTime = new Date(notification.sent_at).getTime();
          const deliveredTime = new Date(notification.delivered_at).getTime();
          totalDeliveryTime += (deliveredTime - sentTime) / 1000 / 60; // Convert to minutes
          deliveredCount++;
        }
      }
      if (notification.status === 'failed') metrics.total_failed++;
    });

    const totalAttempts = metrics.total_sent + metrics.total_delivered + metrics.total_failed;
    if (totalAttempts > 0) {
      metrics.delivery_rate = ((metrics.total_sent + metrics.total_delivered) / totalAttempts) * 100;
      metrics.failure_rate = (metrics.total_failed / totalAttempts) * 100;
    }

    if (deliveredCount > 0) {
      metrics.average_delivery_time_minutes = totalDeliveryTime / deliveredCount;
    }

    return metrics;
  }
}