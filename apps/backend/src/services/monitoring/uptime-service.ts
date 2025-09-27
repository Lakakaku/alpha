import { Database } from '@vocilia/database';
import { MonitoringData, UptimeStatus, ServiceHealthCheck } from '@vocilia/types';

interface UptimeMetrics {
  serviceId: string;
  status: UptimeStatus;
  responseTime: number;
  timestamp: Date;
  errorMessage?: string;
}

interface UptimeThresholds {
  responseTimeWarning: number; // ms
  responseTimeCritical: number; // ms
  consecutiveFailures: number;
}

export class UptimeService {
  private database: Database;
  private thresholds: UptimeThresholds;
  private monitoringInterval: NodeJS.Timer | null = null;

  constructor(database: Database) {
    this.database = database;
    this.thresholds = {
      responseTimeWarning: 2000, // 2 seconds
      responseTimeCritical: 5000, // 5 seconds
      consecutiveFailures: 3
    };
  }

  /**
   * Start continuous uptime monitoring
   */
  public startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);

    console.log(`Uptime monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop uptime monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Uptime monitoring stopped');
    }
  }

  /**
   * Perform health checks on all monitored services
   */
  public async performHealthChecks(): Promise<UptimeMetrics[]> {
    const services = await this.getMonitoredServices();
    const metrics: UptimeMetrics[] = [];

    for (const service of services) {
      try {
        const metric = await this.checkService(service);
        metrics.push(metric);
        await this.recordUptimeMetric(metric);
      } catch (error) {
        console.error(`Failed to check service ${service.id}:`, error);
        
        const errorMetric: UptimeMetrics = {
          serviceId: service.id,
          status: 'critical',
          responseTime: 0,
          timestamp: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
        
        metrics.push(errorMetric);
        await this.recordUptimeMetric(errorMetric);
      }
    }

    return metrics;
  }

  /**
   * Get uptime statistics for a service
   */
  public async getUptimeStats(
    serviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    uptime: number;
    downtime: number;
    availability: number;
    averageResponseTime: number;
    incidents: number;
  }> {
    const metrics = await this.database
      .from('monitoring_data')
      .select('*')
      .eq('service_id', serviceId)
      .eq('metric_type', 'uptime')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (!metrics.data || metrics.data.length === 0) {
      return {
        uptime: 0,
        downtime: 0,
        availability: 0,
        averageResponseTime: 0,
        incidents: 0
      };
    }

    const totalChecks = metrics.data.length;
    const successfulChecks = metrics.data.filter(m => m.status === 'healthy').length;
    const failedChecks = totalChecks - successfulChecks;
    
    const totalResponseTime = metrics.data.reduce((sum, m) => sum + (m.response_time || 0), 0);
    const averageResponseTime = totalResponseTime / totalChecks;

    // Calculate incidents (consecutive failures)
    let incidents = 0;
    let consecutiveFailures = 0;
    
    for (const metric of metrics.data) {
      if (metric.status !== 'healthy') {
        consecutiveFailures++;
      } else {
        if (consecutiveFailures >= this.thresholds.consecutiveFailures) {
          incidents++;
        }
        consecutiveFailures = 0;
      }
    }

    const timeRange = endDate.getTime() - startDate.getTime();
    const checkInterval = timeRange / totalChecks;
    const uptime = successfulChecks * checkInterval;
    const downtime = failedChecks * checkInterval;
    const availability = (successfulChecks / totalChecks) * 100;

    return {
      uptime,
      downtime,
      availability,
      averageResponseTime,
      incidents
    };
  }

  /**
   * Get current service status
   */
  public async getServiceStatus(serviceId: string): Promise<UptimeStatus> {
    const latestMetric = await this.database
      .from('monitoring_data')
      .select('status')
      .eq('service_id', serviceId)
      .eq('metric_type', 'uptime')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return latestMetric.data?.status || 'unknown';
  }

  /**
   * Check if service meets SLA requirements
   */
  public async checkSLA(
    serviceId: string,
    startDate: Date,
    endDate: Date,
    targetAvailability: number = 99.5
  ): Promise<{
    meets_sla: boolean;
    actual_availability: number;
    target_availability: number;
    downtime_minutes: number;
  }> {
    const stats = await this.getUptimeStats(serviceId, startDate, endDate);
    const downtimeMinutes = stats.downtime / (1000 * 60);
    
    return {
      meets_sla: stats.availability >= targetAvailability,
      actual_availability: stats.availability,
      target_availability: targetAvailability,
      downtime_minutes: downtimeMinutes
    };
  }

  private async getMonitoredServices(): Promise<ServiceHealthCheck[]> {
    // In production, this would come from a configuration table
    return [
      {
        id: 'backend-api',
        name: 'Backend API',
        url: process.env.BACKEND_URL || 'https://api.vocilia.com',
        checkPath: '/health',
        expectedStatus: 200,
        timeout: 10000
      },
      {
        id: 'customer-app',
        name: 'Customer Application',
        url: process.env.CUSTOMER_URL || 'https://vocilia.com',
        checkPath: '/',
        expectedStatus: 200,
        timeout: 10000
      },
      {
        id: 'business-app',
        name: 'Business Application',
        url: process.env.BUSINESS_URL || 'https://business.vocilia.com',
        checkPath: '/',
        expectedStatus: 200,
        timeout: 10000
      },
      {
        id: 'admin-app',
        name: 'Admin Application',
        url: process.env.ADMIN_URL || 'https://admin.vocilia.com',
        checkPath: '/',
        expectedStatus: 200,
        timeout: 10000
      }
    ];
  }

  private async checkService(service: ServiceHealthCheck): Promise<UptimeMetrics> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service.timeout);

      const response = await fetch(`${service.url}${service.checkPath}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Vocilia-Uptime-Monitor/1.0'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let status: UptimeStatus = 'healthy';
      let errorMessage: string | undefined;

      if (response.status !== service.expectedStatus) {
        status = 'critical';
        errorMessage = `Expected status ${service.expectedStatus}, got ${response.status}`;
      } else if (responseTime > this.thresholds.responseTimeCritical) {
        status = 'critical';
        errorMessage = `Response time ${responseTime}ms exceeds critical threshold ${this.thresholds.responseTimeCritical}ms`;
      } else if (responseTime > this.thresholds.responseTimeWarning) {
        status = 'warning';
        errorMessage = `Response time ${responseTime}ms exceeds warning threshold ${this.thresholds.responseTimeWarning}ms`;
      }

      return {
        serviceId: service.id,
        status,
        responseTime,
        timestamp: new Date(),
        errorMessage
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        serviceId: service.id,
        status: 'critical',
        responseTime,
        timestamp: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  private async recordUptimeMetric(metric: UptimeMetrics): Promise<void> {
    const monitoringData: Partial<MonitoringData> = {
      service_id: metric.serviceId,
      metric_type: 'uptime',
      status: metric.status,
      response_time: metric.responseTime,
      timestamp: metric.timestamp.toISOString(),
      error_message: metric.errorMessage,
      metadata: {
        check_type: 'http_health_check',
        user_agent: 'Vocilia-Uptime-Monitor/1.0'
      }
    };

    await this.database
      .from('monitoring_data')
      .insert(monitoringData);
  }
}