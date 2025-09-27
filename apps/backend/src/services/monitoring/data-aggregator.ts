import { SystemMetricModel, MetricType, ServiceName } from '@vocilia/database/monitoring/system-metrics';
import { UsageAnalyticsModel } from '@vocilia/database/monitoring/usage-analytics';
import { ErrorLogModel } from '@vocilia/database/monitoring/error-logs';
import { MetricAggregationModel } from '@vocilia/database/monitoring/metric-aggregations';
import { supabase } from '@vocilia/database/client/supabase';
import { loggingService } from '../loggingService';

export interface DataAggregatorConfig {
  /** Interval between aggregation runs in milliseconds */
  aggregationInterval: number;
  /** Enable/disable the aggregator */
  enabled: boolean;
  /** Number of days to keep raw metrics before archiving */
  dataRetentionDays: number;
  /** Batch size for processing metrics */
  batchSize: number;
  /** Services to aggregate data for */
  aggregatedServices: ServiceName[];
  /** Metric types to aggregate */
  aggregatedMetrics: MetricType[];
  /** Auto-cleanup old aggregated data */
  autoCleanup: boolean;
}

export interface AggregationPeriod {
  type: 'hourly' | 'daily' | 'weekly' | 'monthly';
  startTime: string;
  endTime: string;
}

export interface MetricAggregation {
  period: AggregationPeriod;
  serviceName: ServiceName;
  metricType: MetricType;
  count: number;
  sum: number;
  average: number;
  minimum: number;
  maximum: number;
  standardDeviation?: number;
  percentile95?: number;
}

export interface DataAggregatorStats {
  totalAggregations: number;
  processedMetrics: number;
  aggregationErrors: number;
  lastAggregationTime: string;
  averageAggregationTime: number;
  uptime: number;
  dataRetentionCleanups: number;
}

/**
 * Background service that creates daily, weekly, and monthly aggregations
 * from raw metrics data for analytics and reporting purposes
 */
export class DataAggregator {
  private intervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: DataAggregatorConfig;
  private stats: DataAggregatorStats;
  private startTime: number;

  constructor(config?: Partial<DataAggregatorConfig>) {
    this.config = {
      aggregationInterval: 3600000, // 1 hour default
      enabled: true,
      dataRetentionDays: 90,
      batchSize: 1000,
      aggregatedServices: ['backend', 'customer_app', 'business_app', 'admin_app'],
      aggregatedMetrics: ['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'],
      autoCleanup: true,
      ...config,
    };

    this.stats = {
      totalAggregations: 0,
      processedMetrics: 0,
      aggregationErrors: 0,
      lastAggregationTime: new Date().toISOString(),
      averageAggregationTime: 0,
      uptime: 0,
      dataRetentionCleanups: 0,
    };

    this.startTime = Date.now();
  }

  /**
   * Start the data aggregator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      loggingService.warn('Data aggregator is already running');
      return;
    }

    if (!this.config.enabled) {
      loggingService.info('Data aggregator is disabled');
      return;
    }

    try {
      loggingService.info('Starting data aggregator', {
        aggregationInterval: this.config.aggregationInterval,
        batchSize: this.config.batchSize,
        dataRetentionDays: this.config.dataRetentionDays,
        aggregatedServices: this.config.aggregatedServices,
        aggregatedMetrics: this.config.aggregatedMetrics,
      });

      this.isRunning = true;
      this.startTime = Date.now();

      // Start the aggregation loop
      this.intervalId = setInterval(
        () => this.performAggregation(),
        this.config.aggregationInterval
      );

      // Start cleanup loop (runs daily)
      if (this.config.autoCleanup) {
        this.cleanupIntervalId = setInterval(
          () => this.performCleanup(),
          24 * 60 * 60 * 1000 // 24 hours
        );
      }

      // Initial aggregation
      await this.performAggregation();

      loggingService.info('Data aggregator started successfully');
    } catch (error) {
      this.isRunning = false;
      loggingService.error('Failed to start data aggregator', error as Error);
      throw error;
    }
  }

  /**
   * Stop the data aggregator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      loggingService.warn('Data aggregator is not running');
      return;
    }

    try {
      loggingService.info('Stopping data aggregator');

      this.isRunning = false;

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      if (this.cleanupIntervalId) {
        clearInterval(this.cleanupIntervalId);
        this.cleanupIntervalId = null;
      }

      loggingService.info('Data aggregator stopped successfully');
    } catch (error) {
      loggingService.error('Error stopping data aggregator', error as Error);
      throw error;
    }
  }

  /**
   * Restart the data aggregator with new configuration
   */
  async restart(newConfig?: Partial<DataAggregatorConfig>): Promise<void> {
    await this.stop();

    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    await this.start();
  }

  /**
   * Get current aggregator status and statistics
   */
  getStatus(): {
    isRunning: boolean;
    config: DataAggregatorConfig;
    stats: DataAggregatorStats;
  } {
    // Update uptime
    this.stats.uptime = Date.now() - this.startTime;

    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: { ...this.stats },
    };
  }

  /**
   * Update aggregator configuration
   */
  updateConfig(updates: Partial<DataAggregatorConfig>): void {
    this.config = { ...this.config, ...updates };

    loggingService.info('Data aggregator configuration updated', {
      updates,
      newConfig: this.config,
    });
  }

  /**
   * Manually trigger aggregation for specific periods
   */
  async aggregateForPeriod(
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startTime?: string,
    endTime?: string
  ): Promise<MetricAggregation[]> {
    const period = this.calculatePeriod(periodType, startTime, endTime);
    return await this.createAggregationsForPeriod(period);
  }

  /**
   * Get aggregated data for analytics
   */
  async getAggregatedData(
    serviceName?: ServiceName,
    metricType?: MetricType,
    periodType: 'daily' | 'weekly' | 'monthly' = 'daily',
    limit = 30
  ): Promise<any[]> {
    try {
      const filters = {
        periodType: periodType as 'hourly' | 'daily' | 'weekly' | 'monthly',
        serviceName,
        metricType,
      };

      const { aggregations } = await MetricAggregationModel.getAggregations(
        filters,
        1,
        limit
      );

      return aggregations;
    } catch (error) {
      loggingService.error('Error getting aggregated data', error as Error, {
        serviceName,
        metricType,
        periodType,
      });
      return [];
    }
  }

  /**
   * Perform aggregation for all pending periods
   */
  private async performAggregation(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();

    try {
      loggingService.debug('Starting data aggregation cycle');

      // Aggregate for different periods
      await this.aggregateHourlyData();
      await this.aggregateDailyData();
      await this.aggregateWeeklyData();
      await this.aggregateMonthlyData();

      // Update statistics
      this.stats.lastAggregationTime = new Date().toISOString();

      const processingTime = Date.now() - startTime;
      this.stats.averageAggregationTime =
        (this.stats.averageAggregationTime + processingTime) / 2;

      loggingService.debug('Data aggregation cycle completed', {
        processingTime,
        totalAggregations: this.stats.totalAggregations,
      });

    } catch (error) {
      this.stats.aggregationErrors++;
      loggingService.error('Error performing data aggregation', error as Error, {
        processingTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Aggregate hourly data from raw metrics
   */
  private async aggregateHourlyData(): Promise<void> {
    try {
      // Get the last hour that needs aggregation
      const now = new Date();
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      hourStart.setHours(hourStart.getHours() - 1);

      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      const period: AggregationPeriod = {
        type: 'hourly',
        startTime: hourStart.toISOString(),
        endTime: hourEnd.toISOString(),
      };

      // Check if this period has already been aggregated
      const existing = await this.checkExistingAggregation(period);
      if (existing) {
        return;
      }

      await this.createAggregationsForPeriod(period);
    } catch (error) {
      loggingService.error('Error aggregating hourly data', error as Error);
    }
  }

  /**
   * Aggregate daily data from hourly aggregations
   */
  private async aggregateDailyData(): Promise<void> {
    try {
      // Get yesterday's data
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - 1);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const period: AggregationPeriod = {
        type: 'daily',
        startTime: dayStart.toISOString(),
        endTime: dayEnd.toISOString(),
      };

      const existing = await this.checkExistingAggregation(period);
      if (existing) {
        return;
      }

      await this.createAggregationsForPeriod(period);
    } catch (error) {
      loggingService.error('Error aggregating daily data', error as Error);
    }
  }

  /**
   * Aggregate weekly data from daily aggregations
   */
  private async aggregateWeeklyData(): Promise<void> {
    try {
      // Get last week's data
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7 - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const period: AggregationPeriod = {
        type: 'weekly',
        startTime: weekStart.toISOString(),
        endTime: weekEnd.toISOString(),
      };

      const existing = await this.checkExistingAggregation(period);
      if (existing) {
        return;
      }

      await this.createAggregationsForPeriod(period);
    } catch (error) {
      loggingService.error('Error aggregating weekly data', error as Error);
    }
  }

  /**
   * Aggregate monthly data from daily aggregations
   */
  private async aggregateMonthlyData(): Promise<void> {
    try {
      // Get last month's data
      const now = new Date();
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - 1);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const period: AggregationPeriod = {
        type: 'monthly',
        startTime: monthStart.toISOString(),
        endTime: monthEnd.toISOString(),
      };

      const existing = await this.checkExistingAggregation(period);
      if (existing) {
        return;
      }

      await this.createAggregationsForPeriod(period);
    } catch (error) {
      loggingService.error('Error aggregating monthly data', error as Error);
    }
  }

  /**
   * Create aggregations for a specific period
   */
  private async createAggregationsForPeriod(period: AggregationPeriod): Promise<MetricAggregation[]> {
    const aggregations: MetricAggregation[] = [];

    try {
      for (const serviceName of this.config.aggregatedServices) {
        for (const metricType of this.config.aggregatedMetrics) {
          const aggregation = await this.createSingleAggregation(period, serviceName, metricType);
          if (aggregation) {
            aggregations.push(aggregation);
          }
        }
      }

      // Save aggregations to database
      if (aggregations.length > 0) {
        await this.saveAggregations(aggregations);
        this.stats.totalAggregations += aggregations.length;
      }

      loggingService.debug('Created aggregations for period', {
        period: period.type,
        startTime: period.startTime,
        endTime: period.endTime,
        aggregationsCount: aggregations.length,
      });

    } catch (error) {
      loggingService.error('Error creating aggregations for period', error as Error, { period });
    }

    return aggregations;
  }

  /**
   * Create a single aggregation for service/metric combination
   */
  private async createSingleAggregation(
    period: AggregationPeriod,
    serviceName: ServiceName,
    metricType: MetricType
  ): Promise<MetricAggregation | null> {
    try {
      // Get raw metrics for the period
      const { metrics } = await SystemMetricModel.getMetrics(
        {
          serviceName,
          metricType,
          startTime: period.startTime,
          endTime: period.endTime,
        },
        1,
        this.config.batchSize
      );

      if (metrics.length === 0) {
        return null;
      }

      // Calculate aggregations
      const values = metrics.map(m => m.metric_value);
      const sum = values.reduce((a, b) => a + b, 0);
      const average = sum / values.length;
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);

      // Calculate standard deviation
      const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
      const standardDeviation = Math.sqrt(variance);

      // Calculate 95th percentile
      const sorted = values.sort((a, b) => a - b);
      const percentile95Index = Math.floor(0.95 * sorted.length);
      const percentile95 = sorted[percentile95Index];

      const aggregation: MetricAggregation = {
        period,
        serviceName,
        metricType,
        count: values.length,
        sum,
        average,
        minimum,
        maximum,
        standardDeviation,
        percentile95,
      };

      this.stats.processedMetrics += values.length;

      return aggregation;

    } catch (error) {
      loggingService.error('Error creating single aggregation', error as Error, {
        period,
        serviceName,
        metricType,
      });
      return null;
    }
  }

  /**
   * Save aggregations to database
   */
  private async saveAggregations(aggregations: MetricAggregation[]): Promise<void> {
    try {
      const insertData = aggregations.map(agg => ({
        period_type: agg.period.type,
        period_start: agg.period.startTime,
        period_end: agg.period.endTime,
        service_name: agg.serviceName,
        metric_type: agg.metricType,
        metric_count: agg.count,
        metric_sum: agg.sum,
        metric_average: agg.average,
        metric_minimum: agg.minimum,
        metric_maximum: agg.maximum,
        standard_deviation: agg.standardDeviation || 0,
        percentile_95: agg.percentile95 || 0,
      }));

      await MetricAggregationModel.createMany(insertData);

      loggingService.debug('Saved aggregations to database', {
        aggregationsCount: aggregations.length,
      });

    } catch (error) {
      loggingService.error('Error saving aggregations', error as Error, {
        aggregationsCount: aggregations.length,
      });
      throw error;
    }
  }

  /**
   * Check if aggregation already exists for period
   */
  private async checkExistingAggregation(period: AggregationPeriod): Promise<boolean> {
    try {
      return await MetricAggregationModel.existsForPeriod(
        period.type,
        period.startTime
      );
    } catch (error) {
      loggingService.error('Error checking existing aggregation', error as Error, { period });
      return false;
    }
  }

  /**
   * Calculate period boundaries
   */
  private calculatePeriod(
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startTime?: string,
    endTime?: string
  ): AggregationPeriod {
    if (startTime && endTime) {
      return {
        type: periodType,
        startTime,
        endTime,
      };
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    switch (periodType) {
      case 'hourly':
        start = new Date(now);
        start.setMinutes(0, 0, 0);
        start.setHours(start.getHours() - 1);
        end = new Date(start);
        end.setHours(end.getHours() + 1);
        break;

      case 'daily':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;

      case 'weekly':
        start = new Date(now);
        start.setDate(start.getDate() - 7 - start.getDay());
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;

      case 'monthly':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        break;
    }

    return {
      type: periodType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }

  /**
   * Perform data retention cleanup
   */
  private async performCleanup(): Promise<void> {
    if (!this.config.autoCleanup) {
      return;
    }

    try {
      loggingService.info('Starting data retention cleanup');

      // Clean up old raw metrics
      const deletedMetrics = await SystemMetricModel.deleteOlderThan(this.config.dataRetentionDays);

      // Clean up old aggregations (keep aggregations longer than raw data)
      const aggregationRetentionDays = this.config.dataRetentionDays * 3; // Keep aggregations 3x longer
      const deletedAggregations = await this.deleteOldAggregations(aggregationRetentionDays);

      this.stats.dataRetentionCleanups++;

      loggingService.info('Data retention cleanup completed', {
        deletedMetrics,
        deletedAggregations,
        retentionDays: this.config.dataRetentionDays,
      });

    } catch (error) {
      loggingService.error('Error performing data cleanup', error as Error);
    }
  }

  /**
   * Delete old aggregations
   */
  private async deleteOldAggregations(days: number): Promise<number> {
    try {
      return await MetricAggregationModel.deleteOlderThan(days);
    } catch (error) {
      loggingService.error('Error deleting old aggregations', error as Error);
      return 0;
    }
  }

  /**
   * Perform health check on the aggregator
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    lastAggregation: string;
    uptime: number;
  }> {
    const issues: string[] = [];

    // Check if aggregator is running
    if (!this.isRunning) {
      issues.push('Data aggregator is not running');
    }

    // Check if configuration is valid
    if (!this.config.enabled) {
      issues.push('Data aggregator is disabled');
    }

    if (this.config.aggregationInterval < 60000) {
      issues.push('Aggregation interval is too short (minimum 1 minute)');
    }

    // Check if aggregation is current
    const lastAggregationAge = Date.now() - new Date(this.stats.lastAggregationTime).getTime();
    if (lastAggregationAge > this.config.aggregationInterval * 2) {
      issues.push('Data aggregation is behind schedule');
    }

    // Check error rate
    const errorRate = this.stats.aggregationErrors / Math.max(this.stats.totalAggregations, 1);
    if (errorRate > 0.1) { // More than 10% error rate
      issues.push('High error rate in data aggregation');
    }

    return {
      healthy: issues.length === 0,
      issues,
      lastAggregation: this.stats.lastAggregationTime,
      uptime: this.stats.uptime,
    };
  }

  /**
   * Get detailed aggregator metrics for monitoring
   */
  getMetrics(): {
    totalAggregationsCount: number;
    processedMetricsTotal: number;
    aggregationErrorsTotal: number;
    averageAggregationTimeMs: number;
    dataRetentionCleanups: number;
    uptimeMs: number;
    isRunning: boolean;
    configuredInterval: number;
  } {
    return {
      totalAggregationsCount: this.stats.totalAggregations,
      processedMetricsTotal: this.stats.processedMetrics,
      aggregationErrorsTotal: this.stats.aggregationErrors,
      averageAggregationTimeMs: this.stats.averageAggregationTime,
      dataRetentionCleanups: this.stats.dataRetentionCleanups,
      uptimeMs: Date.now() - this.startTime,
      isRunning: this.isRunning,
      configuredInterval: this.config.aggregationInterval,
    };
  }
}

// Singleton instance with default configuration
export const dataAggregator = new DataAggregator({
  aggregationInterval: parseInt(process.env.DATA_AGGREGATION_INTERVAL || '3600000'), // 1 hour
  dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '90'),
  batchSize: parseInt(process.env.AGGREGATION_BATCH_SIZE || '1000'),
  enabled: process.env.DATA_AGGREGATOR_ENABLED !== 'false',
  autoCleanup: process.env.DATA_AUTO_CLEANUP !== 'false',
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  loggingService.info('Received SIGTERM, stopping data aggregator');
  await dataAggregator.stop();
});

process.on('SIGINT', async () => {
  loggingService.info('Received SIGINT, stopping data aggregator');
  await dataAggregator.stop();
});