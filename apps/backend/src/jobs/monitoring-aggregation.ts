import * as cron from 'node-cron';
import { Database } from '@vocilia/database';
import { UptimeService } from '../services/monitoring/uptime-service';
import { PerformanceService } from '../services/monitoring/performance-service';
import { BackupService } from '../services/monitoring/backup-service';

interface AggregationJob {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  isRunning: boolean;
}

interface MetricAggregation {
  service_id: string;
  metric_type: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  start_time: Date;
  end_time: Date;
  aggregated_data: {
    count: number;
    average: number;
    min: number;
    max: number;
    sum: number;
    percentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  metadata: Record<string, any>;
}

export class MonitoringAggregationScheduler {
  private database: Database;
  private uptimeService: UptimeService;
  private performanceService: PerformanceService;
  private backupService: BackupService;
  private jobs: Map<string, AggregationJob> = new Map();
  private isInitialized = false;

  constructor(
    database: Database,
    uptimeService: UptimeService,
    performanceService: PerformanceService,
    backupService: BackupService
  ) {
    this.database = database;
    this.uptimeService = uptimeService;
    this.performanceService = performanceService;
    this.backupService = backupService;
  }

  /**
   * Initialize and start all monitoring aggregation jobs
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('Monitoring aggregation scheduler already initialized');
      return;
    }

    this.setupJobs();
    this.startJobs();
    this.isInitialized = true;

    console.log('Monitoring aggregation scheduler initialized');
  }

  /**
   * Stop all running jobs
   */
  public shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    for (const [jobName, job] of this.jobs) {
      if (job.enabled) {
        cron.destroy(jobName);
        console.log(`Stopped aggregation job: ${jobName}`);
      }
    }

    this.jobs.clear();
    this.isInitialized = false;
    console.log('Monitoring aggregation scheduler shut down');
  }

  /**
   * Get status of all aggregation jobs
   */
  public getJobStatus(): Array<{
    name: string;
    enabled: boolean;
    isRunning: boolean;
    lastRun?: Date;
    nextRun?: Date;
    schedule: string;
  }> {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      enabled: job.enabled,
      isRunning: job.isRunning,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      schedule: job.schedule
    }));
  }

  /**
   * Manually trigger a specific aggregation job
   */
  public async runJob(jobName: string): Promise<void> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job ${jobName} not found`);
    }

    if (job.isRunning) {
      throw new Error(`Job ${jobName} is already running`);
    }

    console.log(`Manually running aggregation job: ${jobName}`);
    await this.executeJob(job);
  }

  /**
   * Enable or disable a specific job
   */
  public setJobEnabled(jobName: string, enabled: boolean): void {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job ${jobName} not found`);
    }

    if (job.enabled === enabled) {
      return;
    }

    job.enabled = enabled;

    if (enabled) {
      this.scheduleJob(jobName, job);
      console.log(`Enabled aggregation job: ${jobName}`);
    } else {
      cron.destroy(jobName);
      console.log(`Disabled aggregation job: ${jobName}`);
    }
  }

  private setupJobs(): void {
    // Hourly aggregation - runs every hour at minute 5
    this.jobs.set('hourly-aggregation', {
      name: 'hourly-aggregation',
      schedule: '5 * * * *',
      task: () => this.aggregateHourlyMetrics(),
      enabled: true,
      isRunning: false
    });

    // Daily aggregation - runs daily at 1:15 AM
    this.jobs.set('daily-aggregation', {
      name: 'daily-aggregation',
      schedule: '15 1 * * *',
      task: () => this.aggregateDailyMetrics(),
      enabled: true,
      isRunning: false
    });

    // Weekly aggregation - runs every Sunday at 2:30 AM
    this.jobs.set('weekly-aggregation', {
      name: 'weekly-aggregation',
      schedule: '30 2 * * 0',
      task: () => this.aggregateWeeklyMetrics(),
      enabled: true,
      isRunning: false
    });

    // Monthly aggregation - runs on the 1st of each month at 3:45 AM
    this.jobs.set('monthly-aggregation', {
      name: 'monthly-aggregation',
      schedule: '45 3 1 * *',
      task: () => this.aggregateMonthlyMetrics(),
      enabled: true,
      isRunning: false
    });

    // Cleanup old raw data - runs daily at 4:00 AM
    this.jobs.set('cleanup-raw-data', {
      name: 'cleanup-raw-data',
      schedule: '0 4 * * *',
      task: () => this.cleanupOldRawData(),
      enabled: true,
      isRunning: false
    });

    // Generate trend reports - runs every 6 hours
    this.jobs.set('trend-analysis', {
      name: 'trend-analysis',
      schedule: '0 */6 * * *',
      task: () => this.generateTrendAnalysis(),
      enabled: true,
      isRunning: false
    });
  }

  private startJobs(): void {
    for (const [jobName, job] of this.jobs) {
      if (job.enabled) {
        this.scheduleJob(jobName, job);
      }
    }
  }

  private scheduleJob(jobName: string, job: AggregationJob): void {
    cron.schedule(job.schedule, async () => {
      await this.executeJob(job);
    }, {
      name: jobName,
      scheduled: true,
      timezone: 'Europe/Stockholm'
    });

    // Calculate next run time
    job.nextRun = this.getNextRunTime(job.schedule);
    console.log(`Scheduled aggregation job: ${jobName} (next run: ${job.nextRun})`);
  }

  private async executeJob(job: AggregationJob): Promise<void> {
    if (job.isRunning) {
      console.log(`Job ${job.name} is already running, skipping execution`);
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date();

    try {
      console.log(`Starting aggregation job: ${job.name}`);
      const startTime = Date.now();
      
      await job.task();
      
      const duration = Date.now() - startTime;
      console.log(`Completed aggregation job: ${job.name} (${duration}ms)`);

      // Update next run time
      job.nextRun = this.getNextRunTime(job.schedule);

    } catch (error) {
      console.error(`Aggregation job ${job.name} failed:`, error);
      
      // Log the error to monitoring data
      await this.logJobError(job.name, error);
      
    } finally {
      job.isRunning = false;
    }
  }

  private async aggregateHourlyMetrics(): Promise<void> {
    const endTime = new Date();
    endTime.setMinutes(0, 0, 0); // Round to start of hour
    
    const startTime = new Date(endTime);
    startTime.setHours(startTime.getHours() - 1); // Previous hour

    await this.aggregateMetricsForPeriod('hourly', startTime, endTime);
  }

  private async aggregateDailyMetrics(): Promise<void> {
    const endTime = new Date();
    endTime.setHours(0, 0, 0, 0); // Start of today
    
    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1); // Previous day

    await this.aggregateMetricsForPeriod('daily', startTime, endTime);
  }

  private async aggregateWeeklyMetrics(): Promise<void> {
    const endTime = new Date();
    endTime.setHours(0, 0, 0, 0);
    endTime.setDate(endTime.getDate() - endTime.getDay()); // Start of this week
    
    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 7); // Previous week

    await this.aggregateMetricsForPeriod('weekly', startTime, endTime);
  }

  private async aggregateMonthlyMetrics(): Promise<void> {
    const endTime = new Date();
    endTime.setDate(1);
    endTime.setHours(0, 0, 0, 0); // Start of this month
    
    const startTime = new Date(endTime);
    startTime.setMonth(startTime.getMonth() - 1); // Previous month

    await this.aggregateMetricsForPeriod('monthly', startTime, endTime);
  }

  private async aggregateMetricsForPeriod(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    const services = ['backend-api', 'customer-app', 'business-app', 'admin-app'];
    const metricTypes = ['uptime', 'performance'];

    for (const serviceId of services) {
      for (const metricType of metricTypes) {
        try {
          const aggregation = await this.calculateAggregation(
            serviceId,
            metricType,
            period,
            startTime,
            endTime
          );

          if (aggregation) {
            await this.storeAggregation(aggregation);
          }
        } catch (error) {
          console.error(`Failed to aggregate ${metricType} for ${serviceId}:`, error);
        }
      }
    }
  }

  private async calculateAggregation(
    serviceId: string,
    metricType: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startTime: Date,
    endTime: Date
  ): Promise<MetricAggregation | null> {
    // Get raw metrics for the time period
    const { data: rawMetrics } = await this.database
      .from('monitoring_data')
      .select('*')
      .eq('service_id', serviceId)
      .eq('metric_type', metricType)
      .gte('timestamp', startTime.toISOString())
      .lt('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: true });

    if (!rawMetrics || rawMetrics.length === 0) {
      return null;
    }

    // Extract response times for calculation
    const values = rawMetrics
      .map(m => m.response_time || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return null;
    }

    // Calculate aggregated statistics
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = values[0];
    const max = values[values.length - 1];

    // Calculate percentiles
    const percentiles = {
      p50: this.calculatePercentile(values, 50),
      p90: this.calculatePercentile(values, 90),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };

    // Calculate additional metadata
    const statusDistribution = rawMetrics.reduce((acc, m) => {
      const status = m.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      service_id: serviceId,
      metric_type: metricType,
      period,
      start_time: startTime,
      end_time: endTime,
      aggregated_data: {
        count,
        average: Math.round(average * 100) / 100,
        min,
        max,
        sum,
        percentiles
      },
      metadata: {
        status_distribution: statusDistribution,
        data_points: count,
        aggregation_timestamp: new Date().toISOString()
      }
    };
  }

  private async storeAggregation(aggregation: MetricAggregation): Promise<void> {
    await this.database
      .from('monitoring_aggregations')
      .upsert({
        service_id: aggregation.service_id,
        metric_type: aggregation.metric_type,
        period: aggregation.period,
        start_time: aggregation.start_time.toISOString(),
        end_time: aggregation.end_time.toISOString(),
        aggregated_data: aggregation.aggregated_data,
        metadata: aggregation.metadata,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'service_id,metric_type,period,start_time'
      });
  }

  private async cleanupOldRawData(): Promise<void> {
    const retentionDays = {
      raw_data: 7, // Keep raw data for 7 days
      hourly_aggregations: 30, // Keep hourly aggregations for 30 days
      daily_aggregations: 365, // Keep daily aggregations for 1 year
      weekly_aggregations: 1095, // Keep weekly aggregations for 3 years
      monthly_aggregations: -1 // Keep monthly aggregations forever
    };

    // Clean up raw monitoring data older than 7 days
    const rawDataCutoff = new Date();
    rawDataCutoff.setDate(rawDataCutoff.getDate() - retentionDays.raw_data);

    const { count: deletedRawData } = await this.database
      .from('monitoring_data')
      .delete()
      .lt('timestamp', rawDataCutoff.toISOString());

    console.log(`Cleaned up ${deletedRawData} old raw monitoring records`);

    // Clean up old hourly aggregations
    const hourlyCutoff = new Date();
    hourlyCutoff.setDate(hourlyCutoff.getDate() - retentionDays.hourly_aggregations);

    const { count: deletedHourly } = await this.database
      .from('monitoring_aggregations')
      .delete()
      .eq('period', 'hourly')
      .lt('start_time', hourlyCutoff.toISOString());

    console.log(`Cleaned up ${deletedHourly} old hourly aggregation records`);

    // Clean up old daily aggregations
    const dailyCutoff = new Date();
    dailyCutoff.setDate(dailyCutoff.getDate() - retentionDays.daily_aggregations);

    const { count: deletedDaily } = await this.database
      .from('monitoring_aggregations')
      .delete()
      .eq('period', 'daily')
      .lt('start_time', dailyCutoff.toISOString());

    console.log(`Cleaned up ${deletedDaily} old daily aggregation records`);
  }

  private async generateTrendAnalysis(): Promise<void> {
    const services = ['backend-api', 'customer-app', 'business-app', 'admin-app'];
    
    for (const serviceId of services) {
      try {
        // Analyze last 24 hours trends
        const trends = await this.analyzeTrends(serviceId, 24);
        
        // Store trend analysis results
        await this.database
          .from('monitoring_trends')
          .upsert({
            service_id: serviceId,
            analysis_period_hours: 24,
            trends: trends,
            analyzed_at: new Date().toISOString()
          }, {
            onConflict: 'service_id,analysis_period_hours'
          });

      } catch (error) {
        console.error(`Failed to generate trend analysis for ${serviceId}:`, error);
      }
    }
  }

  private async analyzeTrends(serviceId: string, hours: number): Promise<Record<string, any>> {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    // Get aggregated data for trend analysis
    const { data: aggregations } = await this.database
      .from('monitoring_aggregations')
      .select('*')
      .eq('service_id', serviceId)
      .eq('period', 'hourly')
      .gte('start_time', startTime.toISOString())
      .lte('end_time', endTime.toISOString())
      .order('start_time', { ascending: true });

    if (!aggregations || aggregations.length < 2) {
      return { trend: 'insufficient_data' };
    }

    // Calculate trends for key metrics
    const responseTimeTrend = this.calculateMetricTrend(
      aggregations.map(a => a.aggregated_data.average)
    );

    const uptimeTrend = this.calculateMetricTrend(
      aggregations.map(a => {
        const total = Object.values(a.metadata.status_distribution || {})
          .reduce((sum: number, count: any) => sum + Number(count), 0);
        const healthy = Number(a.metadata.status_distribution?.healthy || 0);
        return total > 0 ? (healthy / total) * 100 : 0;
      })
    );

    return {
      response_time: responseTimeTrend,
      uptime: uptimeTrend,
      data_points: aggregations.length,
      analysis_timestamp: new Date().toISOString()
    };
  }

  private calculateMetricTrend(values: number[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    change_percent: number;
    volatility: 'low' | 'medium' | 'high';
  } {
    if (values.length < 2) {
      return { direction: 'stable', change_percent: 0, volatility: 'low' };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const changePercent = first !== 0 ? ((last - first) / first) * 100 : 0;

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 5) {
      direction = changePercent > 0 ? 'increasing' : 'decreasing';
    }

    // Calculate volatility based on standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean !== 0 ? (stdDev / mean) * 100 : 0;

    let volatility: 'low' | 'medium' | 'high' = 'low';
    if (coefficientOfVariation > 20) {
      volatility = 'high';
    } else if (coefficientOfVariation > 10) {
      volatility = 'medium';
    }

    return {
      direction,
      change_percent: Math.round(changePercent * 100) / 100,
      volatility
    };
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private getNextRunTime(schedule: string): Date {
    // Simple next run calculation - in a real implementation, use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now);
    
    // For simplicity, add 1 hour as an approximation
    // In production, use a proper cron expression parser
    nextRun.setHours(nextRun.getHours() + 1);
    
    return nextRun;
  }

  private async logJobError(jobName: string, error: any): Promise<void> {
    await this.database
      .from('monitoring_data')
      .insert({
        service_id: 'monitoring-scheduler',
        metric_type: 'job_error',
        status: 'critical',
        timestamp: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          job_name: jobName,
          error_stack: error instanceof Error ? error.stack : undefined,
          error_type: 'aggregation_job_failure'
        }
      });
  }
}