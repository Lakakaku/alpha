import { supabase } from '../../config/database';
import { CallLogger } from '../calls/CallLogger';
import { CostTracker } from '../calls/CostTracker';

interface MonitoringMetrics {
  totalCalls: number;
  activeCalls: number;
  avgDuration: number;
  successRate: number;
  avgCost: number;
  errorRate: number;
}

interface CallAlert {
  id: string;
  type: 'duration_exceeded' | 'cost_exceeded' | 'error_rate_high' | 'provider_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  callSessionId?: string;
  businessId?: string;
  timestamp: Date;
  data: Record<string, any>;
}

interface MonitoringThresholds {
  maxDuration: number; // seconds
  maxCost: number; // dollars
  maxErrorRate: number; // percentage
  alertCooldown: number; // seconds between similar alerts
}

export class CallMonitor {
  private logger: CallLogger;
  private costTracker: CostTracker;
  private thresholds: MonitoringThresholds;
  private alertHistory: Map<string, Date> = new Map();

  constructor() {
    this.logger = new CallLogger();
    this.costTracker = new CostTracker();
    this.thresholds = {
      maxDuration: 120, // 2 minutes
      maxCost: 0.25, // $0.25 per call
      maxErrorRate: 10, // 10%
      alertCooldown: 300 // 5 minutes
    };
  }

  /**
   * Monitor active calls and generate alerts if thresholds are exceeded
   */
  async monitorActiveCalls(): Promise<CallAlert[]> {
    const alerts: CallAlert[] = [];

    try {
      // Get all active calls
      const { data: activeCalls, error } = await supabase
        .from('call_sessions')
        .select(`
          *,
          businesses(name, email)
        `)
        .in('status', ['initiated', 'connecting', 'in_progress']);

      if (error) {
        throw new Error(`Failed to fetch active calls: ${error.message}`);
      }

      if (!activeCalls || activeCalls.length === 0) {
        return alerts;
      }

      // Check each active call for violations
      for (const call of activeCalls) {
        const callAlerts = await this.checkCallThresholds(call);
        alerts.push(...callAlerts);
      }

      // Check system-wide metrics
      const systemAlerts = await this.checkSystemMetrics();
      alerts.push(...systemAlerts);

      return alerts;
    } catch (error) {
      console.error('Error monitoring active calls:', error);
      return [{
        id: `monitor-error-${Date.now()}`,
        type: 'error_rate_high',
        severity: 'critical',
        message: `Call monitoring system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      }];
    }
  }

  /**
   * Check individual call against thresholds
   */
  private async checkCallThresholds(call: any): Promise<CallAlert[]> {
    const alerts: CallAlert[] = [];
    const now = new Date();

    // Check call duration
    if (call.started_at) {
      const startTime = new Date(call.started_at);
      const durationSeconds = (now.getTime() - startTime.getTime()) / 1000;

      if (durationSeconds > this.thresholds.maxDuration) {
        const alertKey = `duration-${call.id}`;
        
        if (this.shouldCreateAlert(alertKey)) {
          alerts.push({
            id: `duration-${call.id}-${Date.now()}`,
            type: 'duration_exceeded',
            severity: durationSeconds > this.thresholds.maxDuration * 1.5 ? 'critical' : 'high',
            message: `Call ${call.id} has exceeded maximum duration (${durationSeconds.toFixed(0)}s > ${this.thresholds.maxDuration}s)`,
            callSessionId: call.id,
            businessId: call.business_id,
            timestamp: now,
            data: {
              duration: durationSeconds,
              threshold: this.thresholds.maxDuration,
              businessName: call.businesses?.name
            }
          });
          
          this.alertHistory.set(alertKey, now);
        }
      }
    }

    // Check call cost
    const costEstimate = await this.costTracker.getCurrentUsage(call.id);
    if (costEstimate.cost > this.thresholds.maxCost) {
      const alertKey = `cost-${call.id}`;
      
      if (this.shouldCreateAlert(alertKey)) {
        alerts.push({
          id: `cost-${call.id}-${Date.now()}`,
          type: 'cost_exceeded',
          severity: costEstimate.cost > this.thresholds.maxCost * 1.5 ? 'critical' : 'high',
          message: `Call ${call.id} has exceeded cost threshold ($${costEstimate.cost.toFixed(3)} > $${this.thresholds.maxCost})`,
          callSessionId: call.id,
          businessId: call.business_id,
          timestamp: now,
          data: {
            cost: costEstimate.cost,
            threshold: this.thresholds.maxCost,
            breakdown: costEstimate
          }
        });
        
        this.alertHistory.set(alertKey, now);
      }
    }

    return alerts;
  }

  /**
   * Check system-wide metrics and thresholds
   */
  private async checkSystemMetrics(): Promise<CallAlert[]> {
    const alerts: CallAlert[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Get error rate over last hour
      const { data: recentCalls } = await supabase
        .from('call_sessions')
        .select('status')
        .gte('created_at', oneHourAgo.toISOString());

      if (recentCalls && recentCalls.length > 10) { // Only check if we have meaningful data
        const failedCalls = recentCalls.filter(call => call.status === 'failed').length;
        const errorRate = (failedCalls / recentCalls.length) * 100;

        if (errorRate > this.thresholds.maxErrorRate) {
          const alertKey = 'system-error-rate';
          
          if (this.shouldCreateAlert(alertKey)) {
            alerts.push({
              id: `error-rate-${Date.now()}`,
              type: 'error_rate_high',
              severity: errorRate > this.thresholds.maxErrorRate * 2 ? 'critical' : 'high',
              message: `System error rate is ${errorRate.toFixed(1)}% (threshold: ${this.thresholds.maxErrorRate}%)`,
              timestamp: now,
              data: {
                errorRate,
                threshold: this.thresholds.maxErrorRate,
                totalCalls: recentCalls.length,
                failedCalls
              }
            });
            
            this.alertHistory.set(alertKey, now);
          }
        }
      }

      // Check provider health
      const providerAlerts = await this.checkProviderHealth();
      alerts.push(...providerAlerts);

    } catch (error) {
      console.error('Error checking system metrics:', error);
    }

    return alerts;
  }

  /**
   * Check telephony provider health
   */
  private async checkProviderHealth(): Promise<CallAlert[]> {
    const alerts: CallAlert[] = [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    try {
      // Check recent provider failures
      const { data: recentLogs } = await supabase
        .from('telephony_provider_logs')
        .select('provider, success, operation')
        .gte('created_at', fiveMinutesAgo.toISOString());

      if (!recentLogs || recentLogs.length === 0) {
        return alerts;
      }

      // Group by provider
      const providerStats = recentLogs.reduce((acc, log) => {
        if (!acc[log.provider]) {
          acc[log.provider] = { total: 0, failures: 0 };
        }
        acc[log.provider].total++;
        if (!log.success) {
          acc[log.provider].failures++;
        }
        return acc;
      }, {} as Record<string, { total: number; failures: number }>);

      // Check each provider
      for (const [provider, stats] of Object.entries(providerStats)) {
        const failureRate = (stats.failures / stats.total) * 100;
        
        if (failureRate > 50 && stats.total >= 3) { // At least 3 attempts with >50% failure
          const alertKey = `provider-${provider}`;
          
          if (this.shouldCreateAlert(alertKey)) {
            alerts.push({
              id: `provider-${provider}-${Date.now()}`,
              type: 'provider_failure',
              severity: failureRate > 80 ? 'critical' : 'high',
              message: `Provider ${provider} has high failure rate: ${failureRate.toFixed(1)}% (${stats.failures}/${stats.total})`,
              timestamp: now,
              data: {
                provider,
                failureRate,
                failures: stats.failures,
                total: stats.total
              }
            });
            
            this.alertHistory.set(alertKey, now);
          }
        }
      }

    } catch (error) {
      console.error('Error checking provider health:', error);
    }

    return alerts;
  }

  /**
   * Get current system metrics
   */
  async getMetrics(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<MonitoringMetrics> {
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    try {
      // Get calls in time range
      const { data: calls } = await supabase
        .from('call_sessions')
        .select('*')
        .gte('created_at', startTime.toISOString());

      // Get active calls
      const { data: activeCalls } = await supabase
        .from('call_sessions')
        .select('*')
        .in('status', ['initiated', 'connecting', 'in_progress']);

      if (!calls) {
        throw new Error('Failed to fetch call metrics');
      }

      const totalCalls = calls.length;
      const completedCalls = calls.filter(call => call.status === 'completed');
      const failedCalls = calls.filter(call => call.status === 'failed');
      
      const avgDuration = completedCalls.length > 0
        ? completedCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / completedCalls.length
        : 0;

      const successRate = totalCalls > 0
        ? (completedCalls.length / totalCalls) * 100
        : 0;

      const avgCost = completedCalls.length > 0
        ? completedCalls.reduce((sum, call) => sum + (call.cost_estimate || 0), 0) / completedCalls.length
        : 0;

      const errorRate = totalCalls > 0
        ? (failedCalls.length / totalCalls) * 100
        : 0;

      return {
        totalCalls,
        activeCalls: activeCalls?.length || 0,
        avgDuration,
        successRate,
        avgCost,
        errorRate
      };

    } catch (error) {
      console.error('Error getting metrics:', error);
      return {
        totalCalls: 0,
        activeCalls: 0,
        avgDuration: 0,
        successRate: 0,
        avgCost: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Process and handle alerts (send notifications, log, etc.)
   */
  async processAlerts(alerts: CallAlert[]): Promise<void> {
    for (const alert of alerts) {
      await this.handleAlert(alert);
    }
  }

  /**
   * Handle individual alert
   */
  private async handleAlert(alert: CallAlert): Promise<void> {
    try {
      // Log the alert
      console.log(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, {
        type: alert.type,
        data: alert.data
      });

      // Store alert in database
      await supabase
        .from('monitoring_alerts')
        .insert({
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          call_session_id: alert.callSessionId,
          business_id: alert.businessId,
          data: alert.data,
          created_at: alert.timestamp
        });

      // Handle critical alerts
      if (alert.severity === 'critical') {
        await this.handleCriticalAlert(alert);
      }

      // Send notifications based on alert type and severity
      await this.sendNotification(alert);

    } catch (error) {
      console.error('Error handling alert:', error);
    }
  }

  /**
   * Handle critical alerts with immediate action
   */
  private async handleCriticalAlert(alert: CallAlert): Promise<void> {
    switch (alert.type) {
      case 'duration_exceeded':
        if (alert.callSessionId) {
          // Force end the call
          await this.forceEndCall(alert.callSessionId);
          console.log(`Force-ended call ${alert.callSessionId} due to duration exceeded`);
        }
        break;

      case 'cost_exceeded':
        if (alert.callSessionId) {
          // Force end the call to prevent further costs
          await this.forceEndCall(alert.callSessionId);
          console.log(`Force-ended call ${alert.callSessionId} due to cost exceeded`);
        }
        break;

      case 'provider_failure':
        // Could trigger provider failover logic
        console.log(`Provider ${alert.data?.provider} experiencing critical failures`);
        break;

      case 'error_rate_high':
        // Could trigger system-wide protective measures
        console.log('System error rate critically high - consider protective measures');
        break;
    }
  }

  /**
   * Force end a call session
   */
  private async forceEndCall(callSessionId: string): Promise<void> {
    try {
      await supabase
        .from('call_sessions')
        .update({
          status: 'timeout',
          ended_at: new Date().toISOString()
        })
        .eq('id', callSessionId);

      await this.logger.logEvent(callSessionId, 'timeout', {
        reason: 'force_ended_by_monitor',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error force-ending call ${callSessionId}:`, error);
    }
  }

  /**
   * Send notification for alert
   */
  private async sendNotification(alert: CallAlert): Promise<void> {
    // In a production system, this would integrate with:
    // - Email notifications
    // - Slack/Discord webhooks
    // - SMS alerts for critical issues
    // - PagerDuty/OpsGenie for critical system alerts

    const notification = {
      to: process.env.ALERT_EMAIL || 'alerts@vocilia.com',
      subject: `[${alert.severity.toUpperCase()}] ${alert.type.replace('_', ' ')} Alert`,
      body: `${alert.message}\n\nTimestamp: ${alert.timestamp.toISOString()}\nData: ${JSON.stringify(alert.data, null, 2)}`
    };

    console.log('Notification would be sent:', notification);
  }

  /**
   * Check if we should create an alert (respects cooldown)
   */
  private shouldCreateAlert(alertKey: string): boolean {
    const lastAlert = this.alertHistory.get(alertKey);
    if (!lastAlert) {
      return true;
    }

    const now = new Date();
    const timeSinceLastAlert = (now.getTime() - lastAlert.getTime()) / 1000;
    
    return timeSinceLastAlert > this.thresholds.alertCooldown;
  }

  /**
   * Update monitoring thresholds
   */
  updateThresholds(newThresholds: Partial<MonitoringThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Get monitoring health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    activeAlerts: number;
    lastCheck: Date;
    uptime: number;
  }> {
    const alerts = await this.monitorActiveCalls();
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts = alerts.filter(a => a.severity === 'high');

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (highAlerts.length > 0 || alerts.length > 5) {
      status = 'warning';
    }

    return {
      status,
      activeAlerts: alerts.length,
      lastCheck: new Date(),
      uptime: process.uptime()
    };
  }
}