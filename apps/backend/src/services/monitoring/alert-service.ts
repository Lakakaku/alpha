import { Database } from '@vocilia/database';
import { AlertSeverity, AlertStatus, AlertChannel, AlertRule } from '@vocilia/types';

interface Alert {
  id: string;
  rule_id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source_service: string;
  triggered_at: Date;
  resolved_at?: Date;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  metadata: Record<string, any>;
}

interface AlertNotification {
  alert_id: string;
  channel: AlertChannel;
  recipient: string;
  sent_at: Date;
  delivery_status: 'pending' | 'sent' | 'failed' | 'bounced';
  error_message?: string;
}

interface EscalationPolicy {
  id: string;
  name: string;
  rules: EscalationRule[];
  enabled: boolean;
}

interface EscalationRule {
  delay_minutes: number;
  channels: AlertChannel[];
  recipients: string[];
  severity_threshold: AlertSeverity;
}

export class AlertService {
  private database: Database;
  private alertRules: Map<string, AlertRule> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private notificationQueues: Map<AlertChannel, Alert[]> = new Map();
  private processingInterval: NodeJS.Timer | null = null;

  constructor(database: Database) {
    this.database = database;
    this.initializeDefaultRules();
    this.initializeDefaultEscalationPolicies();
    this.initializeNotificationQueues();
  }

  /**
   * Start alert processing
   */
  public startProcessing(intervalMs: number = 10000): void { // 10 seconds
    if (this.processingInterval) {
      this.stopProcessing();
    }

    this.processingInterval = setInterval(async () => {
      await this.processAlerts();
      await this.processEscalations();
      await this.processNotificationQueues();
    }, intervalMs);

    console.log(`Alert processing started with ${intervalMs}ms interval`);
  }

  /**
   * Stop alert processing
   */
  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Alert processing stopped');
    }
  }

  /**
   * Trigger an alert
   */
  public async triggerAlert(
    ruleId: string,
    sourceService: string,
    metadata: Record<string, any> = {}
  ): Promise<Alert> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule ${ruleId} not found`);
    }

    // Check if alert already exists and is active
    const existingAlert = await this.findActiveAlert(ruleId, sourceService);
    if (existingAlert) {
      // Update existing alert metadata
      return await this.updateAlert(existingAlert.id, { metadata });
    }

    // Create new alert
    const alert: Alert = {
      id: this.generateAlertId(),
      rule_id: ruleId,
      title: rule.title,
      description: this.formatDescription(rule.description, metadata),
      severity: rule.severity,
      status: 'active',
      source_service: sourceService,
      triggered_at: new Date(),
      metadata: {
        ...rule.metadata,
        ...metadata,
        trigger_count: 1
      }
    };

    // Store alert in database
    await this.database
      .from('monitoring_alerts')
      .insert({
        alert_id: alert.id,
        rule_id: alert.rule_id,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        status: alert.status,
        source_service: alert.source_service,
        triggered_at: alert.triggered_at.toISOString(),
        metadata: alert.metadata
      });

    // Send immediate notifications
    await this.sendNotifications(alert);

    console.log(`Alert triggered: ${alert.id} (${alert.severity})`);
    return alert;
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(
    alertId: string,
    resolvedBy?: string,
    resolution?: string
  ): Promise<Alert> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (alert.status === 'resolved') {
      return alert;
    }

    const updatedAlert = await this.updateAlert(alertId, {
      status: 'resolved',
      resolved_at: new Date(),
      metadata: {
        ...alert.metadata,
        resolved_by: resolvedBy,
        resolution: resolution
      }
    });

    // Send resolution notifications
    await this.sendResolutionNotifications(updatedAlert);

    console.log(`Alert resolved: ${alertId} by ${resolvedBy || 'system'}`);
    return updatedAlert;
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    note?: string
  ): Promise<Alert> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    if (alert.status !== 'active') {
      return alert;
    }

    const updatedAlert = await this.updateAlert(alertId, {
      status: 'acknowledged',
      acknowledged_at: new Date(),
      acknowledged_by: acknowledgedBy,
      metadata: {
        ...alert.metadata,
        acknowledgment_note: note
      }
    });

    console.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    return updatedAlert;
  }

  /**
   * Get alerts with filtering options
   */
  public async getAlerts(options?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    service?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    alerts: Alert[];
    total: number;
    hasMore: boolean;
  }> {
    let query = this.database
      .from('monitoring_alerts')
      .select('*', { count: 'exact' });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options?.service) {
      query = query.eq('source_service', options.service);
    }

    if (options?.startDate) {
      query = query.gte('triggered_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('triggered_at', options.endDate.toISOString());
    }

    query = query.order('triggered_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get alerts: ${error.message}`);
    }

    const alerts = (data || []).map(this.mapDatabaseToAlert);
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const hasMore = count ? (offset + limit) < count : false;

    return {
      alerts,
      total: count || 0,
      hasMore
    };
  }

  /**
   * Get alert statistics
   */
  public async getAlertStatistics(days: number = 30): Promise<{
    total_alerts: number;
    active_alerts: number;
    resolved_alerts: number;
    acknowledged_alerts: number;
    by_severity: Record<AlertSeverity, number>;
    by_service: Record<string, number>;
    resolution_time_avg_minutes: number;
    acknowledgment_time_avg_minutes: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: alerts } = await this.database
      .from('monitoring_alerts')
      .select('*')
      .gte('triggered_at', since.toISOString());

    if (!alerts || alerts.length === 0) {
      return {
        total_alerts: 0,
        active_alerts: 0,
        resolved_alerts: 0,
        acknowledged_alerts: 0,
        by_severity: {} as Record<AlertSeverity, number>,
        by_service: {},
        resolution_time_avg_minutes: 0,
        acknowledgment_time_avg_minutes: 0
      };
    }

    const mappedAlerts = alerts.map(this.mapDatabaseToAlert);
    const active = mappedAlerts.filter(a => a.status === 'active');
    const resolved = mappedAlerts.filter(a => a.status === 'resolved');
    const acknowledged = mappedAlerts.filter(a => a.status === 'acknowledged');

    const bySeverity = mappedAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<AlertSeverity, number>);

    const byService = mappedAlerts.reduce((acc, alert) => {
      acc[alert.source_service] = (acc[alert.source_service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average resolution time
    const resolvedWithTimes = resolved.filter(a => a.resolved_at);
    const totalResolutionTime = resolvedWithTimes.reduce((sum, alert) => {
      const resolutionTime = alert.resolved_at!.getTime() - alert.triggered_at.getTime();
      return sum + resolutionTime;
    }, 0);
    const resolutionTimeAvg = resolvedWithTimes.length > 0 
      ? totalResolutionTime / resolvedWithTimes.length / 1000 / 60 // minutes
      : 0;

    // Calculate average acknowledgment time
    const acknowledgedWithTimes = acknowledged.filter(a => a.acknowledged_at);
    const totalAckTime = acknowledgedWithTimes.reduce((sum, alert) => {
      const ackTime = alert.acknowledged_at!.getTime() - alert.triggered_at.getTime();
      return sum + ackTime;
    }, 0);
    const ackTimeAvg = acknowledgedWithTimes.length > 0 
      ? totalAckTime / acknowledgedWithTimes.length / 1000 / 60 // minutes
      : 0;

    return {
      total_alerts: mappedAlerts.length,
      active_alerts: active.length,
      resolved_alerts: resolved.length,
      acknowledged_alerts: acknowledged.length,
      by_severity: bySeverity,
      by_service: byService,
      resolution_time_avg_minutes: resolutionTimeAvg,
      acknowledgment_time_avg_minutes: ackTimeAvg
    };
  }

  /**
   * Add or update alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.id}`);
  }

  /**
   * Add or update escalation policy
   */
  public addEscalationPolicy(policy: EscalationPolicy): void {
    this.escalationPolicies.set(policy.id, policy);
    console.log(`Escalation policy added: ${policy.id}`);
  }

  private async getAlert(alertId: string): Promise<Alert | null> {
    const { data } = await this.database
      .from('monitoring_alerts')
      .select('*')
      .eq('alert_id', alertId)
      .single();

    return data ? this.mapDatabaseToAlert(data) : null;
  }

  private async updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert> {
    const updateData: any = {};
    
    if (updates.status) updateData.status = updates.status;
    if (updates.resolved_at) updateData.resolved_at = updates.resolved_at.toISOString();
    if (updates.acknowledged_at) updateData.acknowledged_at = updates.acknowledged_at.toISOString();
    if (updates.acknowledged_by) updateData.acknowledged_by = updates.acknowledged_by;
    if (updates.metadata) updateData.metadata = updates.metadata;

    const { data } = await this.database
      .from('monitoring_alerts')
      .update(updateData)
      .eq('alert_id', alertId)
      .select()
      .single();

    return this.mapDatabaseToAlert(data);
  }

  private async findActiveAlert(ruleId: string, sourceService: string): Promise<Alert | null> {
    const { data } = await this.database
      .from('monitoring_alerts')
      .select('*')
      .eq('rule_id', ruleId)
      .eq('source_service', sourceService)
      .eq('status', 'active')
      .single();

    return data ? this.mapDatabaseToAlert(data) : null;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.rule_id);
    if (!rule || !rule.notification_channels) return;

    for (const channel of rule.notification_channels) {
      this.queueNotification(channel, alert);
    }
  }

  private async sendResolutionNotifications(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.rule_id);
    if (!rule || !rule.notification_channels) return;

    for (const channel of rule.notification_channels) {
      this.queueResolutionNotification(channel, alert);
    }
  }

  private queueNotification(channel: AlertChannel, alert: Alert): void {
    if (!this.notificationQueues.has(channel)) {
      this.notificationQueues.set(channel, []);
    }
    this.notificationQueues.get(channel)!.push(alert);
  }

  private queueResolutionNotification(channel: AlertChannel, alert: Alert): void {
    // For resolution notifications, we can use the same queue mechanism
    // but with different message content
    this.queueNotification(channel, { ...alert, metadata: { ...alert.metadata, notification_type: 'resolution' } });
  }

  private async processAlerts(): Promise<void> {
    // Process any pending alert evaluations
    // This would typically check metrics against alert rules
  }

  private async processEscalations(): Promise<void> {
    // Find unacknowledged alerts that need escalation
    const unacknowledgedAlerts = await this.getAlerts({
      status: 'active',
      limit: 100
    });

    for (const alert of unacknowledgedAlerts.alerts) {
      await this.checkEscalation(alert);
    }
  }

  private async checkEscalation(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.rule_id);
    if (!rule || !rule.escalation_policy_id) return;

    const policy = this.escalationPolicies.get(rule.escalation_policy_id);
    if (!policy || !policy.enabled) return;

    const minutesSinceTriggered = (Date.now() - alert.triggered_at.getTime()) / 1000 / 60;

    for (const escalationRule of policy.rules) {
      if (minutesSinceTriggered >= escalationRule.delay_minutes &&
          this.shouldEscalate(alert.severity, escalationRule.severity_threshold)) {
        
        await this.executeEscalation(alert, escalationRule);
      }
    }
  }

  private shouldEscalate(alertSeverity: AlertSeverity, threshold: AlertSeverity): boolean {
    const severityLevels = { info: 1, warning: 2, critical: 3 };
    return severityLevels[alertSeverity] >= severityLevels[threshold];
  }

  private async executeEscalation(alert: Alert, escalationRule: EscalationRule): Promise<void> {
    // Send escalation notifications
    for (const channel of escalationRule.channels) {
      for (const recipient of escalationRule.recipients) {
        await this.sendEscalationNotification(alert, channel, recipient);
      }
    }
  }

  private async sendEscalationNotification(
    alert: Alert,
    channel: AlertChannel,
    recipient: string
  ): Promise<void> {
    const notification: AlertNotification = {
      alert_id: alert.id,
      channel,
      recipient,
      sent_at: new Date(),
      delivery_status: 'pending'
    };

    try {
      // Simulate notification sending
      await this.deliverNotification(notification, alert);
      notification.delivery_status = 'sent';
    } catch (error) {
      notification.delivery_status = 'failed';
      notification.error_message = error instanceof Error ? error.message : 'Unknown error';
    }

    // Store notification record
    await this.database
      .from('alert_notifications')
      .insert({
        alert_id: notification.alert_id,
        channel: notification.channel,
        recipient: notification.recipient,
        sent_at: notification.sent_at.toISOString(),
        delivery_status: notification.delivery_status,
        error_message: notification.error_message
      });
  }

  private async processNotificationQueues(): Promise<void> {
    for (const [channel, alerts] of this.notificationQueues) {
      while (alerts.length > 0) {
        const alert = alerts.shift()!;
        await this.processChannelNotification(channel, alert);
      }
    }
  }

  private async processChannelNotification(channel: AlertChannel, alert: Alert): Promise<void> {
    const recipients = this.getChannelRecipients(channel);
    
    for (const recipient of recipients) {
      await this.sendEscalationNotification(alert, channel, recipient);
    }
  }

  private getChannelRecipients(channel: AlertChannel): string[] {
    // In a real implementation, this would come from configuration
    switch (channel) {
      case 'email':
        return ['admin@vocilia.com', 'ops@vocilia.com'];
      case 'slack':
        return ['#alerts'];
      case 'sms':
        return ['+46123456789'];
      case 'webhook':
        return ['https://api.vocilia.com/webhooks/alerts'];
      default:
        return [];
    }
  }

  private async deliverNotification(notification: AlertNotification, alert: Alert): Promise<void> {
    // Simulate notification delivery based on channel
    switch (notification.channel) {
      case 'email':
        console.log(`📧 Sending email alert to ${notification.recipient}: ${alert.title}`);
        break;
      case 'slack':
        console.log(`💬 Sending Slack alert to ${notification.recipient}: ${alert.title}`);
        break;
      case 'sms':
        console.log(`📱 Sending SMS alert to ${notification.recipient}: ${alert.title}`);
        break;
      case 'webhook':
        console.log(`🔗 Sending webhook alert to ${notification.recipient}: ${alert.title}`);
        break;
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private formatDescription(template: string, metadata: Record<string, any>): string {
    let formatted = template;
    for (const [key, value] of Object.entries(metadata)) {
      formatted = formatted.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return formatted;
  }

  private generateAlertId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `alert-${timestamp}-${random}`;
  }

  private mapDatabaseToAlert(data: any): Alert {
    return {
      id: data.alert_id,
      rule_id: data.rule_id,
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: data.status,
      source_service: data.source_service,
      triggered_at: new Date(data.triggered_at),
      resolved_at: data.resolved_at ? new Date(data.resolved_at) : undefined,
      acknowledged_at: data.acknowledged_at ? new Date(data.acknowledged_at) : undefined,
      acknowledged_by: data.acknowledged_by,
      metadata: data.metadata || {}
    };
  }

  private initializeDefaultRules(): void {
    this.addAlertRule({
      id: 'high-response-time',
      title: 'High Response Time',
      description: 'Response time exceeded {{threshold}}ms for service {{service}}',
      severity: 'warning',
      metric: 'response_time',
      threshold: 2000,
      operator: 'greater_than',
      notification_channels: ['email', 'slack'],
      escalation_policy_id: 'default-escalation',
      metadata: {
        check_interval_minutes: 5,
        consecutive_failures: 3
      }
    });

    this.addAlertRule({
      id: 'service-down',
      title: 'Service Down',
      description: 'Service {{service}} is not responding',
      severity: 'critical',
      metric: 'uptime',
      threshold: 1,
      operator: 'less_than',
      notification_channels: ['email', 'slack', 'sms'],
      escalation_policy_id: 'critical-escalation',
      metadata: {
        check_interval_minutes: 1,
        consecutive_failures: 3
      }
    });

    this.addAlertRule({
      id: 'high-error-rate',
      title: 'High Error Rate',
      description: 'Error rate is {{error_rate}}% for service {{service}}',
      severity: 'critical',
      metric: 'error_rate',
      threshold: 5,
      operator: 'greater_than',
      notification_channels: ['email', 'slack'],
      escalation_policy_id: 'default-escalation',
      metadata: {
        check_interval_minutes: 5,
        consecutive_failures: 2
      }
    });
  }

  private initializeDefaultEscalationPolicies(): void {
    this.addEscalationPolicy({
      id: 'default-escalation',
      name: 'Default Escalation',
      enabled: true,
      rules: [
        {
          delay_minutes: 15,
          channels: ['slack'],
          recipients: ['#alerts-escalation'],
          severity_threshold: 'warning'
        },
        {
          delay_minutes: 30,
          channels: ['email', 'sms'],
          recipients: ['ops@vocilia.com', '+46123456789'],
          severity_threshold: 'warning'
        }
      ]
    });

    this.addEscalationPolicy({
      id: 'critical-escalation',
      name: 'Critical Escalation',
      enabled: true,
      rules: [
        {
          delay_minutes: 5,
          channels: ['email', 'slack', 'sms'],
          recipients: ['ops@vocilia.com', '#critical-alerts', '+46123456789'],
          severity_threshold: 'critical'
        },
        {
          delay_minutes: 15,
          channels: ['sms'],
          recipients: ['+46987654321'], // Backup on-call number
          severity_threshold: 'critical'
        }
      ]
    });
  }

  private initializeNotificationQueues(): void {
    this.notificationQueues.set('email', []);
    this.notificationQueues.set('slack', []);
    this.notificationQueues.set('sms', []);
    this.notificationQueues.set('webhook', []);
  }
}