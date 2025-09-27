import { monitoringService } from './monitoring-service';
import { alertService } from './alert-service';
import { SystemMetricModel, MetricType, ServiceName } from '@vocilia/database/monitoring/system-metrics';
import { AlertRuleModel } from '@vocilia/database/monitoring/alert-rules';
import { loggingService } from '../loggingService';

export interface AlertProcessorConfig {
  /** Interval between metric evaluations in milliseconds */
  evaluationInterval: number;
  /** Maximum number of metrics to process per batch */
  batchSize: number;
  /** Services to monitor */
  monitoredServices: ServiceName[];
  /** Metric types to monitor */
  monitoredMetrics: MetricType[];
  /** Enable/disable the processor */
  enabled: boolean;
  /** Minimum time between alerts for the same rule (cooldown period) */
  alertCooldownMs: number;
}

export interface AlertProcessorStats {
  processedMetrics: number;
  triggeredAlerts: number;
  evaluationErrors: number;
  lastProcessingTime: string;
  averageProcessingTime: number;
  uptime: number;
}

export interface AlertCooldown {
  ruleId: string;
  lastTriggered: number;
}

/**
 * Background service that continuously monitors system metrics
 * and processes alerts when thresholds are exceeded
 */
export class AlertProcessor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: AlertProcessorConfig;
  private stats: AlertProcessorStats;
  private alertCooldowns = new Map<string, number>();
  private startTime: number;

  constructor(config?: Partial<AlertProcessorConfig>) {
    this.config = {
      evaluationInterval: 30000, // 30 seconds default
      batchSize: 100,
      monitoredServices: ['backend', 'customer_app', 'business_app', 'admin_app'],
      monitoredMetrics: ['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'],
      enabled: true,
      alertCooldownMs: 300000, // 5 minutes default cooldown
      ...config,
    };

    this.stats = {
      processedMetrics: 0,
      triggeredAlerts: 0,
      evaluationErrors: 0,
      lastProcessingTime: new Date().toISOString(),
      averageProcessingTime: 0,
      uptime: 0,
    };

    this.startTime = Date.now();
  }

  /**
   * Start the alert processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      loggingService.warn('Alert processor is already running');
      return;
    }

    if (!this.config.enabled) {
      loggingService.info('Alert processor is disabled');
      return;
    }

    try {
      loggingService.info('Starting alert processor', {
        evaluationInterval: this.config.evaluationInterval,
        batchSize: this.config.batchSize,
        monitoredServices: this.config.monitoredServices,
        monitoredMetrics: this.config.monitoredMetrics,
      });

      this.isRunning = true;
      this.startTime = Date.now();

      // Start the processing loop
      this.intervalId = setInterval(
        () => this.processMetrics(),
        this.config.evaluationInterval
      );

      // Initial processing
      await this.processMetrics();

      loggingService.info('Alert processor started successfully');
    } catch (error) {
      this.isRunning = false;
      loggingService.error('Failed to start alert processor', error as Error);
      throw error;
    }
  }

  /**
   * Stop the alert processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      loggingService.warn('Alert processor is not running');
      return;
    }

    try {
      loggingService.info('Stopping alert processor');

      this.isRunning = false;

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      // Clean up resources
      this.alertCooldowns.clear();

      loggingService.info('Alert processor stopped successfully');
    } catch (error) {
      loggingService.error('Error stopping alert processor', error as Error);
      throw error;
    }
  }

  /**
   * Restart the alert processor with new configuration
   */
  async restart(newConfig?: Partial<AlertProcessorConfig>): Promise<void> {
    await this.stop();

    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    await this.start();
  }

  /**
   * Get current processor status and statistics
   */
  getStatus(): {
    isRunning: boolean;
    config: AlertProcessorConfig;
    stats: AlertProcessorStats;
    activeCooldowns: number;
  } {
    // Update uptime
    this.stats.uptime = Date.now() - this.startTime;

    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: { ...this.stats },
      activeCooldowns: this.alertCooldowns.size,
    };
  }

  /**
   * Update processor configuration
   */
  updateConfig(updates: Partial<AlertProcessorConfig>): void {
    this.config = { ...this.config, ...updates };

    loggingService.info('Alert processor configuration updated', {
      updates,
      newConfig: this.config,
    });
  }

  /**
   * Process metrics and evaluate against alert rules
   */
  private async processMetrics(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();

    try {
      loggingService.debug('Starting metric processing cycle');

      // Get recent metrics for evaluation
      const recentMetrics = await this.getRecentMetrics();

      if (recentMetrics.length === 0) {
        loggingService.debug('No recent metrics to process');
        return;
      }

      // Group metrics by type for batch processing
      const metricsByType = this.groupMetricsByType(recentMetrics);

      // Process each metric type
      for (const [metricType, metrics] of metricsByType) {
        await this.processMetricType(metricType as MetricType, metrics);
      }

      // Update statistics
      this.stats.processedMetrics += recentMetrics.length;
      this.stats.lastProcessingTime = new Date().toISOString();

      const processingTime = Date.now() - startTime;
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime + processingTime) / 2;

      loggingService.debug('Metric processing cycle completed', {
        processedMetrics: recentMetrics.length,
        processingTime,
        triggeredAlerts: this.stats.triggeredAlerts,
      });

    } catch (error) {
      this.stats.evaluationErrors++;
      loggingService.error('Error processing metrics', error as Error, {
        processingTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Get recent metrics that need evaluation
   */
  private async getRecentMetrics(): Promise<any[]> {
    try {
      // Get metrics from the last evaluation interval + buffer
      const since = new Date();
      since.setMilliseconds(since.getMilliseconds() - (this.config.evaluationInterval + 10000));

      const { metrics } = await SystemMetricModel.getMetrics(
        {
          startTime: since.toISOString(),
        },
        1,
        this.config.batchSize
      );

      // Filter by monitored services and metrics
      return metrics.filter(metric =>
        this.config.monitoredServices.includes(metric.service_name as ServiceName) &&
        this.config.monitoredMetrics.includes(metric.metric_type as MetricType)
      );

    } catch (error) {
      loggingService.error('Error fetching recent metrics', error as Error);
      return [];
    }
  }

  /**
   * Group metrics by type for batch processing
   */
  private groupMetricsByType(metrics: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    metrics.forEach(metric => {
      const metricType = metric.metric_type;
      if (!grouped.has(metricType)) {
        grouped.set(metricType, []);
      }
      grouped.get(metricType)!.push(metric);
    });

    return grouped;
  }

  /**
   * Process metrics of a specific type
   */
  private async processMetricType(metricType: MetricType, metrics: any[]): Promise<void> {
    try {
      // Get active alert rules for this metric type
      const alertRules = await AlertRuleModel.getByMetricType(metricType);

      if (alertRules.length === 0) {
        return;
      }

      // Evaluate each metric against the rules
      for (const metric of metrics) {
        await this.evaluateMetricAgainstRules(metric, alertRules);
      }

    } catch (error) {
      loggingService.error('Error processing metric type', error as Error, {
        metricType,
        metricCount: metrics.length,
      });
    }
  }

  /**
   * Evaluate a single metric against alert rules
   */
  private async evaluateMetricAgainstRules(metric: any, alertRules: any[]): Promise<void> {
    for (const rule of alertRules) {
      try {
        // Check if rule is in cooldown period
        if (this.isRuleInCooldown(rule.id)) {
          continue;
        }

        // Evaluate the metric against the rule
        const isTriggered = this.evaluateRule(rule, metric.metric_value);

        if (isTriggered) {
          await this.triggerAlert(rule, metric);
        }

      } catch (error) {
        loggingService.error('Error evaluating metric against rule', error as Error, {
          ruleId: rule.id,
          metricId: metric.id,
          metricValue: metric.metric_value,
        });
      }
    }
  }

  /**
   * Evaluate if a rule should trigger based on metric value
   */
  private evaluateRule(rule: any, metricValue: number): boolean {
    switch (rule.comparison_operator) {
      case '>':
        return metricValue > rule.threshold_value;
      case '<':
        return metricValue < rule.threshold_value;
      case '>=':
        return metricValue >= rule.threshold_value;
      case '<=':
        return metricValue <= rule.threshold_value;
      case '=':
        return metricValue === rule.threshold_value;
      default:
        return false;
    }
  }

  /**
   * Check if a rule is in cooldown period
   */
  private isRuleInCooldown(ruleId: string): boolean {
    const lastTriggered = this.alertCooldowns.get(ruleId);
    if (!lastTriggered) {
      return false;
    }

    const now = Date.now();
    const cooldownExpired = now - lastTriggered > this.config.alertCooldownMs;

    if (cooldownExpired) {
      this.alertCooldowns.delete(ruleId);
      return false;
    }

    return true;
  }

  /**
   * Trigger an alert for a rule
   */
  private async triggerAlert(rule: any, metric: any): Promise<void> {
    try {
      // Create alert notification
      await alertService.createAlertNotification({
        alert_rule_id: rule.id,
        metric_value: metric.metric_value,
        notification_channels: rule.notification_channels,
      });

      // Add rule to cooldown
      this.alertCooldowns.set(rule.id, Date.now());

      // Update statistics
      this.stats.triggeredAlerts++;

      loggingService.warn('Alert triggered', {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        metricType: rule.metric_type,
        metricValue: metric.metric_value,
        thresholdValue: rule.threshold_value,
        serviceName: metric.service_name,
        timestamp: metric.timestamp,
      });

    } catch (error) {
      loggingService.error('Error triggering alert', error as Error, {
        ruleId: rule.id,
        metricId: metric.id,
      });
    }
  }

  /**
   * Clean up expired cooldowns periodically
   */
  private cleanupCooldowns(): void {
    const now = Date.now();
    const expiredRules: string[] = [];

    for (const [ruleId, lastTriggered] of this.alertCooldowns) {
      if (now - lastTriggered > this.config.alertCooldownMs) {
        expiredRules.push(ruleId);
      }
    }

    expiredRules.forEach(ruleId => {
      this.alertCooldowns.delete(ruleId);
    });

    if (expiredRules.length > 0) {
      loggingService.debug('Cleaned up expired alert cooldowns', {
        expiredCount: expiredRules.length,
        remainingCooldowns: this.alertCooldowns.size,
      });
    }
  }

  /**
   * Perform health check on the processor
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    lastProcessing: string;
    uptime: number;
  }> {
    const issues: string[] = [];

    // Check if processor is running
    if (!this.isRunning) {
      issues.push('Alert processor is not running');
    }

    // Check if configuration is valid
    if (!this.config.enabled) {
      issues.push('Alert processor is disabled');
    }

    if (this.config.evaluationInterval < 5000) {
      issues.push('Evaluation interval is too short (minimum 5 seconds)');
    }

    if (this.config.batchSize > 1000) {
      issues.push('Batch size is too large (maximum 1000)');
    }

    // Check if processing is current
    const lastProcessingAge = Date.now() - new Date(this.stats.lastProcessingTime).getTime();
    if (lastProcessingAge > this.config.evaluationInterval * 2) {
      issues.push('Metric processing is behind schedule');
    }

    // Check error rate
    const errorRate = this.stats.evaluationErrors / Math.max(this.stats.processedMetrics, 1);
    if (errorRate > 0.1) { // More than 10% error rate
      issues.push('High error rate in metric processing');
    }

    return {
      healthy: issues.length === 0,
      issues,
      lastProcessing: this.stats.lastProcessingTime,
      uptime: this.stats.uptime,
    };
  }

  /**
   * Get detailed processor metrics for monitoring
   */
  getMetrics(): {
    processedMetricsTotal: number;
    triggeredAlertsTotal: number;
    evaluationErrorsTotal: number;
    averageProcessingTimeMs: number;
    activeCooldownsCount: number;
    uptimeMs: number;
    isRunning: boolean;
    configuredInterval: number;
  } {
    return {
      processedMetricsTotal: this.stats.processedMetrics,
      triggeredAlertsTotal: this.stats.triggeredAlerts,
      evaluationErrorsTotal: this.stats.evaluationErrors,
      averageProcessingTimeMs: this.stats.averageProcessingTime,
      activeCooldownsCount: this.alertCooldowns.size,
      uptimeMs: Date.now() - this.startTime,
      isRunning: this.isRunning,
      configuredInterval: this.config.evaluationInterval,
    };
  }
}

// Singleton instance with default configuration
export const alertProcessor = new AlertProcessor({
  evaluationInterval: parseInt(process.env.ALERT_EVALUATION_INTERVAL || '30000'),
  batchSize: parseInt(process.env.ALERT_BATCH_SIZE || '100'),
  alertCooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS || '300000'),
  enabled: process.env.ALERT_PROCESSOR_ENABLED !== 'false',
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  loggingService.info('Received SIGTERM, stopping alert processor');
  await alertProcessor.stop();
});

process.on('SIGINT', async () => {
  loggingService.info('Received SIGINT, stopping alert processor');
  await alertProcessor.stop();
});