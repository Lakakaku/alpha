import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { 
  CommunicationLog, 
  CommunicationLogLevel,
  CommunicationLogType,
  NotificationType,
  CommunicationChannel,
  RecipientType
} from '@vocilia/types/communication';

export class CommunicationLogModel {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a new communication log entry
   */
  async create(log: Omit<CommunicationLog, 'id' | 'created_at'>): Promise<CommunicationLog> {
    const { data, error } = await this.supabase
      .from('communication_logs')
      .insert(log)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create communication log: ${error.message}`);
    }

    return data;
  }

  /**
   * Log notification delivery event
   */
  async logNotificationDelivery(
    notificationId: string,
    status: 'sent' | 'delivered' | 'failed',
    details: {
      channel: CommunicationChannel;
      recipient_id: string;
      recipient_type: RecipientType;
      notification_type: NotificationType;
      provider_response?: any;
      error_message?: string;
      delivery_time_ms?: number;
    }
  ): Promise<CommunicationLog> {
    const logLevel: CommunicationLogLevel = status === 'failed' ? 'error' : 'info';
    
    return await this.create({
      log_type: 'notification_delivery',
      log_level: logLevel,
      notification_id: notificationId,
      recipient_id: details.recipient_id,
      recipient_type: details.recipient_type,
      channel: details.channel,
      event_name: `notification_${status}`,
      message: `Notification ${status}: ${details.notification_type} via ${details.channel}`,
      metadata: {
        notification_type: details.notification_type,
        provider_response: details.provider_response,
        error_message: details.error_message,
        delivery_time_ms: details.delivery_time_ms,
        status: status
      }
    });
  }

  /**
   * Log system event
   */
  async logSystemEvent(
    eventName: string,
    message: string,
    level: CommunicationLogLevel = 'info',
    metadata?: Record<string, any>
  ): Promise<CommunicationLog> {
    return await this.create({
      log_type: 'system_event',
      log_level: level,
      event_name: eventName,
      message: message,
      metadata: metadata || {}
    });
  }

  /**
   * Log API call
   */
  async logApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    statusCode: number,
    responseTime: number,
    details: {
      user_id?: string;
      request_body?: any;
      response_body?: any;
      error_message?: string;
      ip_address?: string;
      user_agent?: string;
    }
  ): Promise<CommunicationLog> {
    const logLevel: CommunicationLogLevel = statusCode >= 400 ? 'error' : 'info';
    
    return await this.create({
      log_type: 'api_call',
      log_level: logLevel,
      event_name: `${method}_${endpoint}`,
      message: `${method} ${endpoint} - ${statusCode} (${responseTime}ms)`,
      metadata: {
        method,
        endpoint,
        status_code: statusCode,
        response_time_ms: responseTime,
        user_id: details.user_id,
        request_body: details.request_body,
        response_body: details.response_body,
        error_message: details.error_message,
        ip_address: details.ip_address,
        user_agent: details.user_agent
      }
    });
  }

  /**
   * Log support ticket activity
   */
  async logSupportActivity(
    ticketId: string,
    activityType: string,
    performedBy: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<CommunicationLog> {
    return await this.create({
      log_type: 'support_activity',
      log_level: 'info',
      event_name: activityType,
      message: message,
      metadata: {
        ticket_id: ticketId,
        performed_by: performedBy,
        activity_type: activityType,
        ...metadata
      }
    });
  }

  /**
   * Log error with context
   */
  async logError(
    errorType: string,
    errorMessage: string,
    context: {
      function_name?: string;
      notification_id?: string;
      user_id?: string;
      stack_trace?: string;
      additional_data?: any;
    }
  ): Promise<CommunicationLog> {
    return await this.create({
      log_type: 'error',
      log_level: 'error',
      event_name: errorType,
      message: errorMessage,
      notification_id: context.notification_id,
      recipient_id: context.user_id,
      metadata: {
        function_name: context.function_name,
        stack_trace: context.stack_trace,
        additional_data: context.additional_data
      }
    });
  }

  /**
   * Get logs by type and date range
   */
  async findByType(
    logType: CommunicationLogType,
    options: {
      logLevel?: CommunicationLogLevel;
      eventName?: string;
      dateRange?: { start: string; end: string };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CommunicationLog[]> {
    let query = this.supabase
      .from('communication_logs')
      .select('*')
      .eq('log_type', logType)
      .order('created_at', { ascending: false });

    if (options.logLevel) {
      query = query.eq('log_level', options.logLevel);
    }

    if (options.eventName) {
      query = query.eq('event_name', options.eventName);
    }

    if (options.dateRange) {
      query = query
        .gte('created_at', options.dateRange.start)
        .lte('created_at', options.dateRange.end);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch communication logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get logs for a specific notification
   */
  async findByNotification(notificationId: string): Promise<CommunicationLog[]> {
    const { data, error } = await this.supabase
      .from('communication_logs')
      .select('*')
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch notification logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get logs for a specific recipient
   */
  async findByRecipient(
    recipientId: string,
    recipientType: RecipientType,
    options: {
      logType?: CommunicationLogType;
      channel?: CommunicationChannel;
      dateRange?: { start: string; end: string };
      limit?: number;
    } = {}
  ): Promise<CommunicationLog[]> {
    let query = this.supabase
      .from('communication_logs')
      .select('*')
      .eq('recipient_id', recipientId)
      .eq('recipient_type', recipientType)
      .order('created_at', { ascending: false });

    if (options.logType) {
      query = query.eq('log_type', options.logType);
    }

    if (options.channel) {
      query = query.eq('channel', options.channel);
    }

    if (options.dateRange) {
      query = query
        .gte('created_at', options.dateRange.start)
        .lte('created_at', options.dateRange.end);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch recipient logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get error logs
   */
  async getErrorLogs(
    options: {
      eventName?: string;
      dateRange?: { start: string; end: string };
      limit?: number;
    } = {}
  ): Promise<CommunicationLog[]> {
    return await this.findByType('error', {
      logLevel: 'error',
      ...options
    });
  }

  /**
   * Get system performance logs
   */
  async getPerformanceLogs(
    dateRange: { start: string; end: string },
    options: {
      slowRequestThreshold?: number;
      limit?: number;
    } = {}
  ): Promise<CommunicationLog[]> {
    let query = this.supabase
      .from('communication_logs')
      .select('*')
      .eq('log_type', 'api_call')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at', { ascending: false });

    if (options.slowRequestThreshold) {
      // Filter for slow requests using metadata
      query = query.gte('metadata->response_time_ms', options.slowRequestThreshold);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch performance logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get communication statistics
   */
  async getStats(
    dateRange: { start: string; end: string },
    groupBy: 'hour' | 'day' | 'channel' | 'notification_type' = 'day'
  ): Promise<Array<{
    period: string;
    total_notifications: number;
    successful_deliveries: number;
    failed_deliveries: number;
    success_rate: number;
    average_delivery_time_ms: number;
  }>> {
    // This would typically use a more complex query with grouping
    // For now, we'll fetch the data and process it in-memory
    const { data, error } = await this.supabase
      .from('communication_logs')
      .select('*')
      .eq('log_type', 'notification_delivery')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch communication stats: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group logs by the specified criteria
    const groupedStats = new Map<string, {
      notifications: number;
      successful: number;
      failed: number;
      totalDeliveryTime: number;
      deliveryCount: number;
    }>();

    data.forEach(log => {
      let groupKey: string;
      const logDate = new Date(log.created_at);

      switch (groupBy) {
        case 'hour':
          groupKey = logDate.toISOString().substring(0, 13) + ':00:00.000Z';
          break;
        case 'day':
          groupKey = logDate.toISOString().substring(0, 10);
          break;
        case 'channel':
          groupKey = log.channel || 'unknown';
          break;
        case 'notification_type':
          groupKey = log.metadata?.notification_type || 'unknown';
          break;
        default:
          groupKey = logDate.toISOString().substring(0, 10);
      }

      if (!groupedStats.has(groupKey)) {
        groupedStats.set(groupKey, {
          notifications: 0,
          successful: 0,
          failed: 0,
          totalDeliveryTime: 0,
          deliveryCount: 0
        });
      }

      const stats = groupedStats.get(groupKey)!;
      stats.notifications++;

      const status = log.metadata?.status;
      if (status === 'sent' || status === 'delivered') {
        stats.successful++;
      } else if (status === 'failed') {
        stats.failed++;
      }

      const deliveryTime = log.metadata?.delivery_time_ms;
      if (deliveryTime && typeof deliveryTime === 'number') {
        stats.totalDeliveryTime += deliveryTime;
        stats.deliveryCount++;
      }
    });

    // Convert to result format
    return Array.from(groupedStats.entries()).map(([period, stats]) => ({
      period,
      total_notifications: stats.notifications,
      successful_deliveries: stats.successful,
      failed_deliveries: stats.failed,
      success_rate: stats.notifications > 0 ? (stats.successful / stats.notifications) * 100 : 0,
      average_delivery_time_ms: stats.deliveryCount > 0 ? stats.totalDeliveryTime / stats.deliveryCount : 0
    }));
  }

  /**
   * Search logs by message content
   */
  async searchLogs(
    searchTerm: string,
    options: {
      logType?: CommunicationLogType;
      logLevel?: CommunicationLogLevel;
      dateRange?: { start: string; end: string };
      limit?: number;
    } = {}
  ): Promise<CommunicationLog[]> {
    let query = this.supabase
      .from('communication_logs')
      .select('*')
      .textSearch('message', searchTerm)
      .order('created_at', { ascending: false });

    if (options.logType) {
      query = query.eq('log_type', options.logType);
    }

    if (options.logLevel) {
      query = query.eq('log_level', options.logLevel);
    }

    if (options.dateRange) {
      query = query
        .gte('created_at', options.dateRange.start)
        .lte('created_at', options.dateRange.end);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search communication logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get log summary for monitoring dashboard
   */
  async getLogSummary(
    dateRange: { start: string; end: string }
  ): Promise<{
    total_logs: number;
    by_level: Record<CommunicationLogLevel, number>;
    by_type: Record<CommunicationLogType, number>;
    error_rate: number;
    recent_errors: CommunicationLog[];
    notification_delivery_rate: number;
    api_call_summary: {
      total_calls: number;
      average_response_time: number;
      error_rate: number;
    };
  }> {
    const { data, error } = await this.supabase
      .from('communication_logs')
      .select('*')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error) {
      throw new Error(`Failed to fetch log summary: ${error.message}`);
    }

    const summary = {
      total_logs: data?.length || 0,
      by_level: {} as Record<CommunicationLogLevel, number>,
      by_type: {} as Record<CommunicationLogType, number>,
      error_rate: 0,
      recent_errors: [] as CommunicationLog[],
      notification_delivery_rate: 0,
      api_call_summary: {
        total_calls: 0,
        average_response_time: 0,
        error_rate: 0
      }
    };

    if (data && data.length > 0) {
      let errorCount = 0;
      let notificationLogs = 0;
      let successfulNotifications = 0;
      let apiCalls = 0;
      let totalApiResponseTime = 0;
      let apiErrors = 0;

      data.forEach(log => {
        // Count by level
        summary.by_level[log.log_level] = (summary.by_level[log.log_level] || 0) + 1;
        
        // Count by type
        summary.by_type[log.log_type] = (summary.by_type[log.log_type] || 0) + 1;

        // Count errors
        if (log.log_level === 'error') {
          errorCount++;
        }

        // Notification delivery stats
        if (log.log_type === 'notification_delivery') {
          notificationLogs++;
          const status = log.metadata?.status;
          if (status === 'sent' || status === 'delivered') {
            successfulNotifications++;
          }
        }

        // API call stats
        if (log.log_type === 'api_call') {
          apiCalls++;
          const responseTime = log.metadata?.response_time_ms;
          const statusCode = log.metadata?.status_code;
          
          if (responseTime && typeof responseTime === 'number') {
            totalApiResponseTime += responseTime;
          }
          
          if (statusCode && statusCode >= 400) {
            apiErrors++;
          }
        }
      });

      summary.error_rate = (errorCount / summary.total_logs) * 100;
      summary.notification_delivery_rate = notificationLogs > 0 ? 
        (successfulNotifications / notificationLogs) * 100 : 0;

      summary.api_call_summary = {
        total_calls: apiCalls,
        average_response_time: apiCalls > 0 ? totalApiResponseTime / apiCalls : 0,
        error_rate: apiCalls > 0 ? (apiErrors / apiCalls) * 100 : 0
      };

      // Get recent errors
      summary.recent_errors = data
        .filter(log => log.log_level === 'error')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
    }

    return summary;
  }

  /**
   * Clean up old logs (for maintenance)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('communication_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old logs: ${error.message}`);
    }

    return data?.length || 0;
  }
}