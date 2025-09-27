import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { AuditLoggingService } from '../services/audit/audit-logging-service';

interface DeliveryMetrics {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  delivery_rate: number;
  average_delivery_time_seconds: number;
  failed_by_reason: Record<string, number>;
  delivery_by_country: Record<string, { sent: number; delivered: number; rate: number }>;
}

interface SLAMetrics {
  total_tickets: number;
  tickets_within_sla: number;
  tickets_breached_sla: number;
  sla_compliance_rate: number;
  average_response_time_minutes: number;
  average_resolution_time_minutes: number;
  sla_by_channel: Record<string, {
    total: number;
    within_sla: number;
    compliance_rate: number;
    avg_response_time: number;
  }>;
  escalation_count: number;
  escalation_rate: number;
}

interface NotificationMetrics {
  total_notifications: number;
  notifications_by_type: Record<string, number>;
  notifications_by_priority: Record<string, number>;
  retry_rate: number;
  template_usage: Record<string, number>;
  peak_sending_hours: Record<string, number>;
}

interface SystemPerformanceMetrics {
  batch_processing_time_ms: number;
  average_processing_time_per_message_ms: number;
  messages_per_second: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  error_rate: number;
  uptime_percentage: number;
}

interface CommunicationDashboard {
  delivery_metrics: DeliveryMetrics;
  sla_metrics: SLAMetrics;
  notification_metrics: NotificationMetrics;
  performance_metrics: SystemPerformanceMetrics;
  alerts: Array<{
    type: 'delivery_rate_low' | 'sla_breach' | 'high_error_rate' | 'system_overload';
    severity: 'warning' | 'critical';
    message: string;
    timestamp: string;
    acknowledged: boolean;
  }>;
  last_updated: string;
}

export class CommunicationMetricsService {
  private supabase: SupabaseClient<Database>;
  private auditLogger: AuditLoggingService;
  
  // Alert thresholds
  private readonly DELIVERY_RATE_WARNING_THRESHOLD = 0.95; // 95%
  private readonly DELIVERY_RATE_CRITICAL_THRESHOLD = 0.90; // 90%
  private readonly SLA_COMPLIANCE_WARNING_THRESHOLD = 0.90; // 90%
  private readonly SLA_COMPLIANCE_CRITICAL_THRESHOLD = 0.80; // 80%
  private readonly ERROR_RATE_WARNING_THRESHOLD = 0.05; // 5%
  private readonly ERROR_RATE_CRITICAL_THRESHOLD = 0.10; // 10%
  private readonly PROCESSING_TIME_WARNING_THRESHOLD = 30000; // 30 seconds
  private readonly PROCESSING_TIME_CRITICAL_THRESHOLD = 60000; // 60 seconds

  constructor(
    supabase: SupabaseClient<Database>,
    auditLogger: AuditLoggingService
  ) {
    this.supabase = supabase;
    this.auditLogger = auditLogger;
  }

  async getDeliveryMetrics(startDate: Date, endDate: Date): Promise<DeliveryMetrics> {
    try {
      const { data: notifications, error } = await this.supabase
        .from('communication_notifications')
        .select(`
          id,
          status,
          delivery_status,
          sent_at,
          delivered_at,
          failed_reason,
          recipient_phone,
          retry_count
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch delivery metrics: ${error.message}`);
      }

      const metrics: DeliveryMetrics = {
        total_sent: 0,
        total_delivered: 0,
        total_failed: 0,
        delivery_rate: 0,
        average_delivery_time_seconds: 0,
        failed_by_reason: {},
        delivery_by_country: {}
      };

      let totalDeliveryTime = 0;
      let deliveredCount = 0;

      for (const notification of notifications || []) {
        if (notification.status === 'sent' || notification.status === 'delivered') {
          metrics.total_sent++;
        }

        if (notification.delivery_status === 'delivered') {
          metrics.total_delivered++;
          deliveredCount++;

          // Calculate delivery time
          if (notification.sent_at && notification.delivered_at) {
            const sentTime = new Date(notification.sent_at).getTime();
            const deliveredTime = new Date(notification.delivered_at).getTime();
            totalDeliveryTime += (deliveredTime - sentTime) / 1000; // Convert to seconds
          }
        }

        if (notification.delivery_status === 'failed') {
          metrics.total_failed++;
          
          const reason = notification.failed_reason || 'unknown';
          metrics.failed_by_reason[reason] = (metrics.failed_by_reason[reason] || 0) + 1;
        }

        // Extract country code from phone number
        if (notification.recipient_phone) {
          const countryCode = this.extractCountryCode(notification.recipient_phone);
          if (!metrics.delivery_by_country[countryCode]) {
            metrics.delivery_by_country[countryCode] = { sent: 0, delivered: 0, rate: 0 };
          }
          
          if (notification.status === 'sent' || notification.status === 'delivered') {
            metrics.delivery_by_country[countryCode].sent++;
          }
          
          if (notification.delivery_status === 'delivered') {
            metrics.delivery_by_country[countryCode].delivered++;
          }
        }
      }

      // Calculate rates and averages
      metrics.delivery_rate = metrics.total_sent > 0 ? metrics.total_delivered / metrics.total_sent : 0;
      metrics.average_delivery_time_seconds = deliveredCount > 0 ? totalDeliveryTime / deliveredCount : 0;

      // Calculate delivery rates by country
      Object.keys(metrics.delivery_by_country).forEach(country => {
        const countryData = metrics.delivery_by_country[country];
        countryData.rate = countryData.sent > 0 ? countryData.delivered / countryData.sent : 0;
      });

      return metrics;
    } catch (error) {
      await this.auditLogger.log({
        action: 'delivery_metrics_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { start_date: startDate.toISOString(), end_date: endDate.toISOString() }
      });
      throw error;
    }
  }

  async getSLAMetrics(startDate: Date, endDate: Date): Promise<SLAMetrics> {
    try {
      const { data: tickets, error } = await this.supabase
        .from('support_tickets')
        .select(`
          id,
          channel,
          priority,
          status,
          created_at,
          first_response_at,
          resolved_at,
          sla_deadline,
          escalated_at
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch SLA metrics: ${error.message}`);
      }

      const metrics: SLAMetrics = {
        total_tickets: tickets?.length || 0,
        tickets_within_sla: 0,
        tickets_breached_sla: 0,
        sla_compliance_rate: 0,
        average_response_time_minutes: 0,
        average_resolution_time_minutes: 0,
        sla_by_channel: {},
        escalation_count: 0,
        escalation_rate: 0
      };

      let totalResponseTime = 0;
      let totalResolutionTime = 0;
      let responseCount = 0;
      let resolutionCount = 0;

      for (const ticket of tickets || []) {
        const createdAt = new Date(ticket.created_at);
        const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
        const firstResponseAt = ticket.first_response_at ? new Date(ticket.first_response_at) : null;
        const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;

        // Initialize channel metrics
        if (!metrics.sla_by_channel[ticket.channel]) {
          metrics.sla_by_channel[ticket.channel] = {
            total: 0,
            within_sla: 0,
            compliance_rate: 0,
            avg_response_time: 0
          };
        }
        metrics.sla_by_channel[ticket.channel].total++;

        // Check SLA compliance
        let withinSLA = true;
        if (slaDeadline) {
          if (resolvedAt && resolvedAt > slaDeadline) {
            withinSLA = false;
            metrics.tickets_breached_sla++;
          } else if (!resolvedAt && new Date() > slaDeadline) {
            withinSLA = false;
            metrics.tickets_breached_sla++;
          } else {
            metrics.tickets_within_sla++;
            metrics.sla_by_channel[ticket.channel].within_sla++;
          }
        }

        // Calculate response time
        if (firstResponseAt) {
          const responseTime = (firstResponseAt.getTime() - createdAt.getTime()) / (1000 * 60); // minutes
          totalResponseTime += responseTime;
          responseCount++;
        }

        // Calculate resolution time
        if (resolvedAt) {
          const resolutionTime = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60); // minutes
          totalResolutionTime += resolutionTime;
          resolutionCount++;
        }

        // Count escalations
        if (ticket.escalated_at) {
          metrics.escalation_count++;
        }
      }

      // Calculate averages and rates
      metrics.sla_compliance_rate = metrics.total_tickets > 0 ? 
        metrics.tickets_within_sla / metrics.total_tickets : 1;
      metrics.average_response_time_minutes = responseCount > 0 ? totalResponseTime / responseCount : 0;
      metrics.average_resolution_time_minutes = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0;
      metrics.escalation_rate = metrics.total_tickets > 0 ? metrics.escalation_count / metrics.total_tickets : 0;

      // Calculate compliance rates by channel
      Object.keys(metrics.sla_by_channel).forEach(channel => {
        const channelData = metrics.sla_by_channel[channel];
        channelData.compliance_rate = channelData.total > 0 ? channelData.within_sla / channelData.total : 1;
      });

      return metrics;
    } catch (error) {
      await this.auditLogger.log({
        action: 'sla_metrics_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { start_date: startDate.toISOString(), end_date: endDate.toISOString() }
      });
      throw error;
    }
  }

  async getNotificationMetrics(startDate: Date, endDate: Date): Promise<NotificationMetrics> {
    try {
      const { data: notifications, error } = await this.supabase
        .from('communication_notifications')
        .select(`
          id,
          notification_type,
          priority,
          retry_count,
          template_id,
          sent_at
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch notification metrics: ${error.message}`);
      }

      const metrics: NotificationMetrics = {
        total_notifications: notifications?.length || 0,
        notifications_by_type: {},
        notifications_by_priority: {},
        retry_rate: 0,
        template_usage: {},
        peak_sending_hours: {}
      };

      let retriedNotifications = 0;

      for (const notification of notifications || []) {
        // Count by type
        const type = notification.notification_type || 'unknown';
        metrics.notifications_by_type[type] = (metrics.notifications_by_type[type] || 0) + 1;

        // Count by priority
        const priority = notification.priority || 'medium';
        metrics.notifications_by_priority[priority] = (metrics.notifications_by_priority[priority] || 0) + 1;

        // Count retries
        if (notification.retry_count && notification.retry_count > 0) {
          retriedNotifications++;
        }

        // Count template usage
        if (notification.template_id) {
          metrics.template_usage[notification.template_id] = (metrics.template_usage[notification.template_id] || 0) + 1;
        }

        // Track peak sending hours
        if (notification.sent_at) {
          const sentHour = new Date(notification.sent_at).getHours();
          const hourKey = `${sentHour}:00`;
          metrics.peak_sending_hours[hourKey] = (metrics.peak_sending_hours[hourKey] || 0) + 1;
        }
      }

      metrics.retry_rate = metrics.total_notifications > 0 ? retriedNotifications / metrics.total_notifications : 0;

      return metrics;
    } catch (error) {
      await this.auditLogger.log({
        action: 'notification_metrics_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { start_date: startDate.toISOString(), end_date: endDate.toISOString() }
      });
      throw error;
    }
  }

  async getSystemPerformanceMetrics(startDate: Date, endDate: Date): Promise<SystemPerformanceMetrics> {
    try {
      // Get batch processing metrics
      const { data: batches, error: batchError } = await this.supabase
        .from('communication_logs')
        .select('*')
        .eq('log_type', 'batch_processing')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (batchError) {
        throw new Error(`Failed to fetch batch metrics: ${batchError.message}`);
      }

      // Get error metrics
      const { data: errors, error: errorError } = await this.supabase
        .from('communication_logs')
        .select('*')
        .eq('log_type', 'error')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (errorError) {
        throw new Error(`Failed to fetch error metrics: ${errorError.message}`);
      }

      const metrics: SystemPerformanceMetrics = {
        batch_processing_time_ms: 0,
        average_processing_time_per_message_ms: 0,
        messages_per_second: 0,
        memory_usage_mb: 0,
        cpu_usage_percent: 0,
        error_rate: 0,
        uptime_percentage: 0
      };

      // Calculate batch processing metrics
      if (batches && batches.length > 0) {
        let totalProcessingTime = 0;
        let totalMessages = 0;

        for (const batch of batches) {
          const details = batch.details as any;
          if (details.processing_time_ms) {
            totalProcessingTime += details.processing_time_ms;
          }
          if (details.message_count) {
            totalMessages += details.message_count;
          }
        }

        metrics.batch_processing_time_ms = totalProcessingTime / batches.length;
        metrics.average_processing_time_per_message_ms = totalMessages > 0 ? 
          totalProcessingTime / totalMessages : 0;
        
        const totalTimeSeconds = totalProcessingTime / 1000;
        metrics.messages_per_second = totalTimeSeconds > 0 ? totalMessages / totalTimeSeconds : 0;
      }

      // Calculate error rate
      const totalOperations = (batches?.length || 0) + (errors?.length || 0);
      metrics.error_rate = totalOperations > 0 ? (errors?.length || 0) / totalOperations : 0;

      // Get current system metrics (this would typically come from system monitoring)
      const currentMetrics = await this.getCurrentSystemMetrics();
      metrics.memory_usage_mb = currentMetrics.memory_usage_mb;
      metrics.cpu_usage_percent = currentMetrics.cpu_usage_percent;
      metrics.uptime_percentage = currentMetrics.uptime_percentage;

      return metrics;
    } catch (error) {
      await this.auditLogger.log({
        action: 'performance_metrics_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { start_date: startDate.toISOString(), end_date: endDate.toISOString() }
      });
      throw error;
    }
  }

  async getCommunicationDashboard(startDate: Date, endDate: Date): Promise<CommunicationDashboard> {
    try {
      const [deliveryMetrics, slaMetrics, notificationMetrics, performanceMetrics] = await Promise.all([
        this.getDeliveryMetrics(startDate, endDate),
        this.getSLAMetrics(startDate, endDate),
        this.getNotificationMetrics(startDate, endDate),
        this.getSystemPerformanceMetrics(startDate, endDate)
      ]);

      const alerts = await this.generateAlerts(deliveryMetrics, slaMetrics, performanceMetrics);

      const dashboard: CommunicationDashboard = {
        delivery_metrics: deliveryMetrics,
        sla_metrics: slaMetrics,
        notification_metrics: notificationMetrics,
        performance_metrics: performanceMetrics,
        alerts,
        last_updated: new Date().toISOString()
      };

      await this.auditLogger.log({
        action: 'dashboard_generated',
        details: { 
          metrics_period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          alerts_count: alerts.length 
        },
        metadata: { dashboard_summary: this.getDashboardSummary(dashboard) }
      });

      return dashboard;
    } catch (error) {
      await this.auditLogger.log({
        action: 'dashboard_generation_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { start_date: startDate.toISOString(), end_date: endDate.toISOString() }
      });
      throw error;
    }
  }

  private async generateAlerts(
    deliveryMetrics: DeliveryMetrics,
    slaMetrics: SLAMetrics,
    performanceMetrics: SystemPerformanceMetrics
  ): Promise<CommunicationDashboard['alerts']> {
    const alerts: CommunicationDashboard['alerts'] = [];

    // Delivery rate alerts
    if (deliveryMetrics.delivery_rate < this.DELIVERY_RATE_CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'delivery_rate_low',
        severity: 'critical',
        message: `Critical: SMS delivery rate is ${(deliveryMetrics.delivery_rate * 100).toFixed(1)}% (below ${(this.DELIVERY_RATE_CRITICAL_THRESHOLD * 100)}% threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    } else if (deliveryMetrics.delivery_rate < this.DELIVERY_RATE_WARNING_THRESHOLD) {
      alerts.push({
        type: 'delivery_rate_low',
        severity: 'warning',
        message: `Warning: SMS delivery rate is ${(deliveryMetrics.delivery_rate * 100).toFixed(1)}% (below ${(this.DELIVERY_RATE_WARNING_THRESHOLD * 100)}% threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // SLA compliance alerts
    if (slaMetrics.sla_compliance_rate < this.SLA_COMPLIANCE_CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'sla_breach',
        severity: 'critical',
        message: `Critical: SLA compliance is ${(slaMetrics.sla_compliance_rate * 100).toFixed(1)}% (below ${(this.SLA_COMPLIANCE_CRITICAL_THRESHOLD * 100)}% threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    } else if (slaMetrics.sla_compliance_rate < this.SLA_COMPLIANCE_WARNING_THRESHOLD) {
      alerts.push({
        type: 'sla_breach',
        severity: 'warning',
        message: `Warning: SLA compliance is ${(slaMetrics.sla_compliance_rate * 100).toFixed(1)}% (below ${(this.SLA_COMPLIANCE_WARNING_THRESHOLD * 100)}% threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Error rate alerts
    if (performanceMetrics.error_rate > this.ERROR_RATE_CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `Critical: System error rate is ${(performanceMetrics.error_rate * 100).toFixed(1)}% (above ${(this.ERROR_RATE_CRITICAL_THRESHOLD * 100)}% threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    } else if (performanceMetrics.error_rate > this.ERROR_RATE_WARNING_THRESHOLD) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'warning',
        message: `Warning: System error rate is ${(performanceMetrics.error_rate * 100).toFixed(1)}% (above ${(this.ERROR_RATE_WARNING_THRESHOLD * 100)}% threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    // Performance alerts
    if (performanceMetrics.batch_processing_time_ms > this.PROCESSING_TIME_CRITICAL_THRESHOLD) {
      alerts.push({
        type: 'system_overload',
        severity: 'critical',
        message: `Critical: Batch processing time is ${(performanceMetrics.batch_processing_time_ms / 1000).toFixed(1)}s (above ${this.PROCESSING_TIME_CRITICAL_THRESHOLD / 1000}s threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    } else if (performanceMetrics.batch_processing_time_ms > this.PROCESSING_TIME_WARNING_THRESHOLD) {
      alerts.push({
        type: 'system_overload',
        severity: 'warning',
        message: `Warning: Batch processing time is ${(performanceMetrics.batch_processing_time_ms / 1000).toFixed(1)}s (above ${this.PROCESSING_TIME_WARNING_THRESHOLD / 1000}s threshold)`,
        timestamp: new Date().toISOString(),
        acknowledged: false
      });
    }

    return alerts;
  }

  private getDashboardSummary(dashboard: CommunicationDashboard): Record<string, any> {
    return {
      delivery_rate: dashboard.delivery_metrics.delivery_rate,
      sla_compliance: dashboard.sla_metrics.sla_compliance_rate,
      total_notifications: dashboard.notification_metrics.total_notifications,
      error_rate: dashboard.performance_metrics.error_rate,
      alerts_count: dashboard.alerts.length,
      critical_alerts: dashboard.alerts.filter(a => a.severity === 'critical').length
    };
  }

  private extractCountryCode(phoneNumber: string): string {
    // Extract country code from phone number (simplified version)
    if (phoneNumber.startsWith('+46')) return 'SE'; // Sweden
    if (phoneNumber.startsWith('+47')) return 'NO'; // Norway
    if (phoneNumber.startsWith('+45')) return 'DK'; // Denmark
    if (phoneNumber.startsWith('+358')) return 'FI'; // Finland
    if (phoneNumber.startsWith('+1')) return 'US'; // US/Canada
    if (phoneNumber.startsWith('+44')) return 'GB'; // UK
    return 'OTHER';
  }

  private async getCurrentSystemMetrics(): Promise<{
    memory_usage_mb: number;
    cpu_usage_percent: number;
    uptime_percentage: number;
  }> {
    // In a real implementation, this would collect actual system metrics
    // For now, return mock values that would come from system monitoring
    const memoryUsage = process.memoryUsage();
    return {
      memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
      cpu_usage_percent: Math.random() * 30 + 10, // Mock CPU usage between 10-40%
      uptime_percentage: 99.9 // Mock uptime
    };
  }

  async acknowledgeAlert(alertTimestamp: string, acknowledgedBy: string): Promise<void> {
    await this.auditLogger.log({
      action: 'alert_acknowledged',
      details: { alert_timestamp: alertTimestamp, acknowledged_by: acknowledgedBy },
      metadata: { timestamp: new Date().toISOString() }
    });
  }

  async exportMetrics(startDate: Date, endDate: Date, format: 'json' | 'csv'): Promise<string> {
    const dashboard = await this.getCommunicationDashboard(startDate, endDate);
    
    if (format === 'json') {
      return JSON.stringify(dashboard, null, 2);
    } else {
      // Convert to CSV format (simplified)
      const csvLines = [
        'Metric,Value',
        `Delivery Rate,${dashboard.delivery_metrics.delivery_rate}`,
        `SLA Compliance,${dashboard.sla_metrics.sla_compliance_rate}`,
        `Total Notifications,${dashboard.notification_metrics.total_notifications}`,
        `Error Rate,${dashboard.performance_metrics.error_rate}`,
        `Alerts Count,${dashboard.alerts.length}`
      ];
      return csvLines.join('\n');
    }
  }
}