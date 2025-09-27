import { supabase } from '../client/supabase.js';
import type { 
  CommunicationRetrySchedule, 
  RetryStatus,
  NotificationType,
  RecipientType 
} from '@vocilia/types';

export class CommunicationRetryScheduleModel {
  /**
   * Create a new retry schedule
   */
  static async create(data: Omit<CommunicationRetrySchedule, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationRetrySchedule> {
    const { data: schedule, error } = await supabase
      .from('communication_retry_schedules')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create retry schedule: ${error.message}`);
    }

    return schedule;
  }

  /**
   * Get retry schedule by ID
   */
  static async getById(id: string): Promise<CommunicationRetrySchedule | null> {
    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get retry schedule: ${error.message}`);
    }

    return data;
  }

  /**
   * Get retry schedules by notification ID
   */
  static async getByNotificationId(notificationId: string): Promise<CommunicationRetrySchedule[]> {
    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select('*')
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get retry schedules: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get pending retries ready for processing
   */
  static async getPendingRetries(): Promise<CommunicationRetrySchedule[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending retries: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get pending retries by type for batch processing
   */
  static async getPendingRetriesByType(
    notificationType: NotificationType,
    limit: number = 50
  ): Promise<CommunicationRetrySchedule[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select(`
        *,
        communication_notifications!inner(
          notification_type
        )
      `)
      .eq('status', 'pending')
      .eq('communication_notifications.notification_type', notificationType)
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get pending retries by type: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update retry schedule status
   */
  static async updateStatus(
    id: string, 
    status: RetryStatus, 
    executedAt?: string,
    errorReason?: string
  ): Promise<CommunicationRetrySchedule> {
    const updateData: Partial<CommunicationRetrySchedule> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (executedAt) {
      updateData.executed_at = executedAt;
    }

    if (errorReason) {
      updateData.error_reason = errorReason;
    }

    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update retry schedule: ${error.message}`);
    }

    return data;
  }

  /**
   * Cancel all pending retries for a notification
   */
  static async cancelForNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('communication_retry_schedules')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('notification_id', notificationId)
      .eq('status', 'pending');

    if (error) {
      throw new Error(`Failed to cancel retries: ${error.message}`);
    }
  }

  /**
   * Get retry statistics for monitoring
   */
  static async getRetryStats(days: number = 7): Promise<{
    total_scheduled: number;
    completed: number;
    failed: number;
    cancelled: number;
    pending: number;
    success_rate: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select('status')
      .gte('created_at', since.toISOString());

    if (error) {
      throw new Error(`Failed to get retry stats: ${error.message}`);
    }

    const stats = {
      total_scheduled: data?.length || 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      pending: 0,
      success_rate: 0
    };

    data?.forEach(schedule => {
      switch (schedule.status) {
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        case 'pending':
          stats.pending++;
          break;
      }
    });

    if (stats.total_scheduled > 0) {
      stats.success_rate = Math.round((stats.completed / stats.total_scheduled) * 100);
    }

    return stats;
  }

  /**
   * Get retry history for a specific recipient
   */
  static async getRetryHistoryForRecipient(
    recipientType: RecipientType,
    recipientId: string,
    limit: number = 20
  ): Promise<CommunicationRetrySchedule[]> {
    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select(`
        *,
        communication_notifications!inner(
          recipient_type,
          recipient_id,
          notification_type,
          channel
        )
      `)
      .eq('communication_notifications.recipient_type', recipientType)
      .eq('communication_notifications.recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get retry history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Schedule a retry for a failed notification
   */
  static async scheduleRetry(
    notificationId: string,
    retryAttempt: number,
    scheduledAt: string,
    retryReason?: string
  ): Promise<CommunicationRetrySchedule> {
    const retryData = {
      notification_id: notificationId,
      retry_attempt: retryAttempt,
      scheduled_at: scheduledAt,
      status: 'pending' as RetryStatus,
      retry_reason: retryReason
    };

    return this.create(retryData);
  }

  /**
   * Calculate next retry time using exponential backoff
   */
  static calculateNextRetryTime(attempt: number): Date {
    // Retry intervals: immediate (0), 5min (300s), 30min (1800s)
    const intervals = [0, 300, 1800]; // seconds
    const intervalSeconds = intervals[Math.min(attempt - 1, intervals.length - 1)];
    
    const nextRetry = new Date();
    nextRetry.setSeconds(nextRetry.getSeconds() + intervalSeconds);
    
    return nextRetry;
  }

  /**
   * Clean up old completed/failed retries
   */
  static async cleanupOldRetries(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { count, error } = await supabase
      .from('communication_retry_schedules')
      .delete({ count: 'exact' })
      .in('status', ['completed', 'failed', 'cancelled'])
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Failed to cleanup old retries: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get retries that have exceeded maximum attempts
   */
  static async getMaxAttemptsExceeded(): Promise<CommunicationRetrySchedule[]> {
    const { data, error } = await supabase
      .from('communication_retry_schedules')
      .select('*')
      .eq('status', 'failed')
      .gte('retry_attempt', 3)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get max attempts exceeded: ${error.message}`);
    }

    return data || [];
  }
}