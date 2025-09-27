import { SystemMetricModel, MetricType, ServiceName, MetricData } from '@vocilia/database/monitoring/system-metrics';
import { ErrorLogModel, ErrorLogData } from '@vocilia/database/monitoring/error-logs';
import { UsageAnalyticsModel, UsageAnalyticsData } from '@vocilia/database/monitoring/usage-analytics';
import { ValidationError, InternalServerError } from '../../middleware/errorHandler';
import { loggingService } from '../loggingService';

export interface MetricsQueryParams {
  service?: ServiceName;
  metric_type?: MetricType;
  start_time?: string;
  end_time?: string;
  granularity?: 'minute' | 'hour' | 'day';
  limit?: number;
  offset?: number;
}

export interface ErrorLogQueryParams {
  severity?: 'critical' | 'warning' | 'info';
  service?: string;
  search?: string;
  status?: 'open' | 'investigating' | 'resolved';
  limit?: number;
  offset?: number;
}

export interface UsageQueryParams {
  service?: string;
  start_date?: string;
  end_date?: string;
}

export interface MetricsSummary {
  total_data_points: number;
  average_value: number;
  min_value: number;
  max_value: number;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
    monitoring: 'healthy' | 'unhealthy';
  };
  metrics: {
    uptime_seconds: number;
    response_time_ms: number;
    error_rate: number;
  };
}

export class MonitoringService {
  /**
   * Record a new system metric
   */
  async recordMetric(metricData: MetricData): Promise<void> {
    try {
      // Validate metric data
      this.validateMetricData(metricData);

      // Record the metric
      const metric = await SystemMetricModel.record(metricData);

      if (!metric) {
        throw new InternalServerError('Failed to record system metric');
      }

      // Log the metric recording
      loggingService.debug('System metric recorded', {
        metricType: metricData.metricType,
        serviceName: metricData.serviceName,
        value: metricData.metricValue,
      });

    } catch (error) {
      loggingService.error('Error recording system metric', error as Error, {
        metricData,
      });
      throw error;
    }
  }

  /**
   * Get system metrics with filtering and aggregation
   */
  async getMetrics(params: MetricsQueryParams): Promise<{
    metrics: any[];
    summary: MetricsSummary;
  }> {
    try {
      // Validate query parameters
      this.validateMetricsQuery(params);

      // Apply default pagination
      const limit = Math.min(params.limit || 100, 1000);
      const page = Math.floor((params.offset || 0) / limit) + 1;

      // Build filters
      const filters = {
        metricType: params.metric_type,
        serviceName: params.service,
        startTime: params.start_time,
        endTime: params.end_time,
      };

      // Get metrics from database
      const { metrics, total } = await SystemMetricModel.getMetrics(filters, page, limit);

      // Calculate summary statistics
      const summary = this.calculateMetricsSummary(metrics);

      return {
        metrics: this.formatMetricsForResponse(metrics, params.granularity),
        summary,
      };

    } catch (error) {
      loggingService.error('Error fetching system metrics', error as Error, { params });
      throw error;
    }
  }

  /**
   * Record an error log entry
   */
  async recordError(errorData: ErrorLogData): Promise<void> {
    try {
      // Validate error data
      this.validateErrorData(errorData);

      // Record the error
      const errorLog = await ErrorLogModel.record(errorData);

      if (!errorLog) {
        throw new InternalServerError('Failed to record error log');
      }

      // Log the error recording
      loggingService.info('Error log recorded', {
        severity: errorData.severity,
        serviceName: errorData.serviceName,
        message: errorData.errorMessage,
      });

    } catch (error) {
      loggingService.error('Error recording error log', error as Error, {
        errorData,
      });
      throw error;
    }
  }

  /**
   * Get error logs with filtering and search
   */
  async getErrorLogs(params: ErrorLogQueryParams): Promise<{
    errors: any[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  }> {
    try {
      // Validate query parameters
      this.validateErrorLogQuery(params);

      // Apply default pagination
      const limit = Math.min(params.limit || 50, 100);
      const offset = params.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      // Build filters
      const filters = {
        severity: params.severity,
        serviceName: params.service,
        searchTerm: params.search,
        resolutionStatus: params.status,
      };

      // Get error logs from database
      const { errors, total } = await ErrorLogModel.getErrorLogs(filters, page, limit);

      return {
        errors: this.formatErrorLogsForResponse(errors),
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + limit < total,
        },
      };

    } catch (error) {
      loggingService.error('Error fetching error logs', error as Error, { params });
      throw error;
    }
  }

  /**
   * Update error log resolution status
   */
  async updateErrorStatus(errorId: string, status: 'open' | 'investigating' | 'resolved'): Promise<void> {
    try {
      if (!errorId) {
        throw new ValidationError('Error ID is required');
      }

      if (!['open', 'investigating', 'resolved'].includes(status)) {
        throw new ValidationError('Invalid status value');
      }

      const updated = await ErrorLogModel.updateStatus(errorId, status);

      if (!updated) {
        throw new InternalServerError('Failed to update error status');
      }

      loggingService.info('Error log status updated', {
        errorId,
        newStatus: status,
      });

    } catch (error) {
      loggingService.error('Error updating error status', error as Error, {
        errorId,
        status,
      });
      throw error;
    }
  }

  /**
   * Record usage analytics
   */
  async recordUsage(usageData: UsageAnalyticsData): Promise<void> {
    try {
      // Validate usage data
      this.validateUsageData(usageData);

      // Record the usage analytics
      const analytics = await UsageAnalyticsModel.record(usageData);

      if (!analytics) {
        throw new InternalServerError('Failed to record usage analytics');
      }

      loggingService.debug('Usage analytics recorded', {
        date: usageData.date,
        serviceName: usageData.serviceName,
        activeUsers: usageData.dailyActiveUsers,
        apiCalls: usageData.apiCallVolume,
      });

    } catch (error) {
      loggingService.error('Error recording usage analytics', error as Error, {
        usageData,
      });
      throw error;
    }
  }

  /**
   * Get usage analytics with filtering
   */
  async getUsageAnalytics(params: UsageQueryParams): Promise<{
    analytics: any[];
  }> {
    try {
      // Validate query parameters
      this.validateUsageQuery(params);

      // Build filters
      const filters = {
        serviceName: params.service,
        startDate: params.start_date,
        endDate: params.end_date,
      };

      // Get usage analytics from database
      const analytics = await UsageAnalyticsModel.getUsageAnalytics(filters);

      return {
        analytics: this.formatUsageAnalyticsForResponse(analytics),
      };

    } catch (error) {
      loggingService.error('Error fetching usage analytics', error as Error, { params });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      // Get system health summary from metrics
      const healthSummary = await SystemMetricModel.getHealthSummary();

      // Check database connectivity
      const dbHealthy = await this.checkDatabaseHealth();

      // Calculate overall system status
      const overallStatus = this.calculateOverallHealth(healthSummary, dbHealthy);

      // Get system uptime
      const uptimeSeconds = process.uptime();

      // Get latest response time and error rate
      const { avgResponseTime, errorRate } = await this.getLatestPerformanceMetrics();

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealthy ? 'healthy' : 'unhealthy',
          api: avgResponseTime < 2000 ? 'healthy' : 'unhealthy',
          monitoring: 'healthy', // If we're responding, monitoring is healthy
        },
        metrics: {
          uptime_seconds: Math.floor(uptimeSeconds),
          response_time_ms: avgResponseTime,
          error_rate: errorRate,
        },
      };

    } catch (error) {
      loggingService.error('Error getting health status', error as Error);

      // Return unhealthy status if we can't determine health
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'unhealthy',
          api: 'unhealthy',
          monitoring: 'unhealthy',
        },
        metrics: {
          uptime_seconds: Math.floor(process.uptime()),
          response_time_ms: 0,
          error_rate: 100,
        },
      };
    }
  }

  /**
   * Record API response time metric
   */
  async recordApiResponseTime(
    serviceName: ServiceName,
    responseTime: number,
    endpoint?: string,
    statusCode?: number
  ): Promise<void> {
    await this.recordMetric({
      metricType: 'api_response_time',
      metricValue: responseTime,
      serviceName,
      additionalData: {
        endpoint,
        status_code: statusCode,
      },
    });
  }

  /**
   * Record resource usage metric
   */
  async recordResourceUsage(
    serviceName: ServiceName,
    metricType: 'cpu_usage' | 'memory_usage',
    value: number,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.recordMetric({
      metricType,
      metricValue: value,
      serviceName,
      additionalData: additionalInfo,
    });
  }

  /**
   * Record error rate metric
   */
  async recordErrorRate(
    serviceName: ServiceName,
    errorRate: number,
    totalRequests?: number,
    errorCount?: number
  ): Promise<void> {
    await this.recordMetric({
      metricType: 'error_rate',
      metricValue: errorRate,
      serviceName,
      additionalData: {
        total_requests: totalRequests,
        error_count: errorCount,
      },
    });
  }

  // Private validation methods
  private validateMetricData(data: MetricData): void {
    if (!data.metricType) {
      throw new ValidationError('Metric type is required');
    }

    if (typeof data.metricValue !== 'number' || data.metricValue < 0) {
      throw new ValidationError('Metric value must be a non-negative number');
    }

    if (!data.serviceName) {
      throw new ValidationError('Service name is required');
    }

    // Validate metric type specific constraints
    if ((data.metricType === 'cpu_usage' || data.metricType === 'memory_usage') && data.metricValue > 100) {
      throw new ValidationError('CPU and memory usage cannot exceed 100%');
    }

    if (data.metricType === 'error_rate' && data.metricValue > 100) {
      throw new ValidationError('Error rate cannot exceed 100%');
    }
  }

  private validateErrorData(data: ErrorLogData): void {
    if (!data.severity || !['critical', 'warning', 'info'].includes(data.severity)) {
      throw new ValidationError('Valid severity level is required');
    }

    if (!data.errorMessage) {
      throw new ValidationError('Error message is required');
    }

    if (!data.serviceName) {
      throw new ValidationError('Service name is required');
    }
  }

  private validateUsageData(data: UsageAnalyticsData): void {
    if (!data.date) {
      throw new ValidationError('Date is required');
    }

    if (!data.serviceName) {
      throw new ValidationError('Service name is required');
    }

    if (typeof data.dailyActiveUsers !== 'number' || data.dailyActiveUsers < 0) {
      throw new ValidationError('Daily active users must be a non-negative number');
    }

    if (typeof data.apiCallVolume !== 'number' || data.apiCallVolume < 0) {
      throw new ValidationError('API call volume must be a non-negative number');
    }
  }

  private validateMetricsQuery(params: MetricsQueryParams): void {
    if (params.start_time && params.end_time) {
      const startTime = new Date(params.start_time);
      const endTime = new Date(params.end_time);

      if (startTime >= endTime) {
        throw new ValidationError('Start time must be before end time');
      }

      // Limit query range to prevent excessive data retrieval
      const daysDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        throw new ValidationError('Query range cannot exceed 90 days');
      }
    }

    if (params.limit && (params.limit < 1 || params.limit > 1000)) {
      throw new ValidationError('Limit must be between 1 and 1000');
    }

    if (params.offset && params.offset < 0) {
      throw new ValidationError('Offset must be non-negative');
    }
  }

  private validateErrorLogQuery(params: ErrorLogQueryParams): void {
    if (params.limit && (params.limit < 1 || params.limit > 100)) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    if (params.offset && params.offset < 0) {
      throw new ValidationError('Offset must be non-negative');
    }
  }

  private validateUsageQuery(params: UsageQueryParams): void {
    if (params.start_date && params.end_date) {
      const startDate = new Date(params.start_date);
      const endDate = new Date(params.end_date);

      if (startDate >= endDate) {
        throw new ValidationError('Start date must be before end date');
      }
    }
  }

  // Private utility methods
  private calculateMetricsSummary(metrics: any[]): MetricsSummary {
    if (metrics.length === 0) {
      return {
        total_data_points: 0,
        average_value: 0,
        min_value: 0,
        max_value: 0,
        trend_direction: 'stable',
      };
    }

    const values = metrics.map(m => m.metric_value);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate trend (simplified)
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (metrics.length >= 2) {
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));

      const firstAvg = firstHalf.reduce((acc, val) => acc + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((acc, val) => acc + val, 0) / secondHalf.length;

      const change = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (change > 5) trendDirection = 'up';
      else if (change < -5) trendDirection = 'down';
    }

    return {
      total_data_points: metrics.length,
      average_value: avg,
      min_value: min,
      max_value: max,
      trend_direction: trendDirection,
    };
  }

  private formatMetricsForResponse(metrics: any[], granularity?: string): any[] {
    return metrics.map(metric => ({
      id: metric.id,
      timestamp: metric.timestamp,
      metric_type: metric.metric_type,
      metric_value: metric.metric_value,
      service_name: metric.service_name,
      additional_data: metric.additional_data,
    }));
  }

  private formatErrorLogsForResponse(errors: any[]): any[] {
    return errors.map(error => ({
      id: error.id,
      timestamp: error.timestamp,
      severity: error.severity,
      error_message: error.error_message,
      stack_trace: error.stack_trace,
      service_name: error.service_name,
      endpoint: error.endpoint,
      user_context: error.user_context,
      resolution_status: error.resolution_status,
    }));
  }

  private formatUsageAnalyticsForResponse(analytics: any[]): any[] {
    return analytics.map(item => ({
      date: item.date,
      service_name: item.service_name,
      daily_active_users: item.daily_active_users,
      api_call_volume: item.api_call_volume,
      feature_usage: item.feature_usage,
    }));
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Simple health check by trying to record a test metric
      await SystemMetricModel.getHealthSummary();
      return true;
    } catch (error) {
      return false;
    }
  }

  private calculateOverallHealth(healthSummary: any, dbHealthy: boolean): 'healthy' | 'degraded' | 'unhealthy' {
    if (!dbHealthy) {
      return 'unhealthy';
    }

    const services = Object.values(healthSummary.services || {});
    const criticalServices = services.filter((s: any) => s.status === 'critical').length;
    const warningServices = services.filter((s: any) => s.status === 'warning').length;

    if (criticalServices > 0) {
      return 'unhealthy';
    } else if (warningServices > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private async getLatestPerformanceMetrics(): Promise<{
    avgResponseTime: number;
    errorRate: number;
  }> {
    try {
      // Get latest response time metrics across all services
      const responseTimeMetrics = await SystemMetricModel.getServiceMetrics(1); // Last hour

      let totalResponseTime = 0;
      let responseTimeCount = 0;
      let totalErrorRate = 0;
      let errorRateCount = 0;

      Object.values(responseTimeMetrics).forEach((serviceMetrics: any) => {
        if (serviceMetrics.api_response_time !== undefined) {
          totalResponseTime += serviceMetrics.api_response_time;
          responseTimeCount++;
        }
        if (serviceMetrics.error_rate !== undefined) {
          totalErrorRate += serviceMetrics.error_rate;
          errorRateCount++;
        }
      });

      return {
        avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
        errorRate: errorRateCount > 0 ? totalErrorRate / errorRateCount : 0,
      };
    } catch (error) {
      return {
        avgResponseTime: 0,
        errorRate: 0,
      };
    }
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();