import { Database } from '@vocilia/database';
import { MonitoringData, PerformanceMetrics, PerformanceThresholds } from '@vocilia/types';

interface PerformanceSnapshot {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  heapUsed: number;
  heapTotal: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
}

interface PerformanceTrend {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  severity: 'low' | 'medium' | 'high';
}

export class PerformanceService {
  private database: Database;
  private thresholds: PerformanceThresholds;
  private metricsBuffer: PerformanceSnapshot[] = [];
  private monitoringInterval: NodeJS.Timer | null = null;
  private startTime: number;

  constructor(database: Database) {
    this.database = database;
    this.startTime = Date.now();
    this.thresholds = {
      responseTime: {
        warning: 2000, // 2 seconds
        critical: 5000 // 5 seconds
      },
      cpuUsage: {
        warning: 70, // 70%
        critical: 90 // 90%
      },
      memoryUsage: {
        warning: 80, // 80%
        critical: 95 // 95%
      },
      errorRate: {
        warning: 1, // 1%
        critical: 5 // 5%
      },
      throughput: {
        warning: 100, // requests per minute
        critical: 50 // requests per minute
      }
    };
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(async () => {
      await this.capturePerformanceSnapshot();
    }, intervalMs);

    console.log(`Performance monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Performance monitoring stopped');
    }
  }

  /**
   * Capture current performance snapshot
   */
  public async capturePerformanceSnapshot(): Promise<PerformanceSnapshot> {
    const memUsage = process.memoryUsage();
    const cpuUsage = await this.getCPUUsage();
    
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      cpuUsage,
      memoryUsage: (memUsage.rss / 1024 / 1024), // MB
      heapUsed: (memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: (memUsage.heapTotal / 1024 / 1024), // MB
      responseTime: await this.getAverageResponseTime(),
      throughput: await this.getCurrentThroughput(),
      errorRate: await this.getCurrentErrorRate(),
      activeConnections: await this.getActiveConnections()
    };

    // Add to buffer (keep last 100 snapshots in memory)
    this.metricsBuffer.push(snapshot);
    if (this.metricsBuffer.length > 100) {
      this.metricsBuffer.shift();
    }

    // Store in database
    await this.storePerformanceMetrics(snapshot);

    return snapshot;
  }

  /**
   * Get performance statistics for a time range
   */
  public async getPerformanceStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    averages: PerformanceSnapshot;
    peaks: PerformanceSnapshot;
    trends: PerformanceTrend[];
    violations: Array<{
      timestamp: Date;
      metric: string;
      value: number;
      threshold: number;
      severity: 'warning' | 'critical';
    }>;
  }> {
    const metrics = await this.database
      .from('monitoring_data')
      .select('*')
      .eq('metric_type', 'performance')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (!metrics.data || metrics.data.length === 0) {
      return {
        averages: this.getEmptySnapshot(),
        peaks: this.getEmptySnapshot(),
        trends: [],
        violations: []
      };
    }

    const data = metrics.data.map(m => ({
      timestamp: new Date(m.timestamp),
      cpuUsage: m.metadata?.cpuUsage || 0,
      memoryUsage: m.metadata?.memoryUsage || 0,
      heapUsed: m.metadata?.heapUsed || 0,
      heapTotal: m.metadata?.heapTotal || 0,
      responseTime: m.response_time || 0,
      throughput: m.metadata?.throughput || 0,
      errorRate: m.metadata?.errorRate || 0,
      activeConnections: m.metadata?.activeConnections || 0
    }));

    const averages = this.calculateAverages(data);
    const peaks = this.calculatePeaks(data);
    const trends = this.calculateTrends(data);
    const violations = this.detectViolations(data);

    return { averages, peaks, trends, violations };
  }

  /**
   * Get current system health status
   */
  public getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: PerformanceSnapshot | null;
  } {
    const latest = this.metricsBuffer[this.metricsBuffer.length - 1];
    if (!latest) {
      return { status: 'warning', issues: ['No recent metrics available'], metrics: null };
    }

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check CPU usage
    if (latest.cpuUsage >= this.thresholds.cpuUsage.critical) {
      status = 'critical';
      issues.push(`CPU usage critical: ${latest.cpuUsage.toFixed(1)}%`);
    } else if (latest.cpuUsage >= this.thresholds.cpuUsage.warning) {
      if (status !== 'critical') status = 'warning';
      issues.push(`CPU usage high: ${latest.cpuUsage.toFixed(1)}%`);
    }

    // Check memory usage
    if (latest.memoryUsage >= this.thresholds.memoryUsage.critical) {
      status = 'critical';
      issues.push(`Memory usage critical: ${latest.memoryUsage.toFixed(1)}MB`);
    } else if (latest.memoryUsage >= this.thresholds.memoryUsage.warning) {
      if (status !== 'critical') status = 'warning';
      issues.push(`Memory usage high: ${latest.memoryUsage.toFixed(1)}MB`);
    }

    // Check response time
    if (latest.responseTime >= this.thresholds.responseTime.critical) {
      status = 'critical';
      issues.push(`Response time critical: ${latest.responseTime}ms`);
    } else if (latest.responseTime >= this.thresholds.responseTime.warning) {
      if (status !== 'critical') status = 'warning';
      issues.push(`Response time high: ${latest.responseTime}ms`);
    }

    // Check error rate
    if (latest.errorRate >= this.thresholds.errorRate.critical) {
      status = 'critical';
      issues.push(`Error rate critical: ${latest.errorRate.toFixed(2)}%`);
    } else if (latest.errorRate >= this.thresholds.errorRate.warning) {
      if (status !== 'critical') status = 'warning';
      issues.push(`Error rate high: ${latest.errorRate.toFixed(2)}%`);
    }

    // Check throughput
    if (latest.throughput <= this.thresholds.throughput.critical) {
      status = 'critical';
      issues.push(`Throughput critical: ${latest.throughput} req/min`);
    } else if (latest.throughput <= this.thresholds.throughput.warning) {
      if (status !== 'critical') status = 'warning';
      issues.push(`Throughput low: ${latest.throughput} req/min`);
    }

    return { status, issues, metrics: latest };
  }

  /**
   * Get system uptime
   */
  public getUptime(): { seconds: number; formatted: string } {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const formatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    return { seconds: uptimeSeconds, formatted };
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);

        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000; // microseconds
        const totalUsage = currentUsage.user + currentUsage.system;
        const cpuPercent = (totalUsage / totalTime) * 100;

        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private async getAverageResponseTime(): Promise<number> {
    // In a real implementation, this would track actual request response times
    // For now, return a simulated value based on recent metrics
    if (this.metricsBuffer.length > 0) {
      const recent = this.metricsBuffer.slice(-10);
      return recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    }
    return 0;
  }

  private async getCurrentThroughput(): Promise<number> {
    // In a real implementation, this would track actual request rates
    // For now, return a simulated value
    return Math.floor(Math.random() * 200) + 50; // 50-250 requests per minute
  }

  private async getCurrentErrorRate(): Promise<number> {
    // In a real implementation, this would track actual error rates
    // For now, return a simulated value
    return Math.random() * 2; // 0-2% error rate
  }

  private async getActiveConnections(): Promise<number> {
    // In a real implementation, this would track actual connection counts
    // For now, return a simulated value
    return Math.floor(Math.random() * 100) + 10; // 10-110 connections
  }

  private async storePerformanceMetrics(snapshot: PerformanceSnapshot): Promise<void> {
    const monitoringData: Partial<MonitoringData> = {
      service_id: 'backend-api',
      metric_type: 'performance',
      response_time: snapshot.responseTime,
      timestamp: snapshot.timestamp.toISOString(),
      status: this.getSystemHealth().status,
      metadata: {
        cpuUsage: snapshot.cpuUsage,
        memoryUsage: snapshot.memoryUsage,
        heapUsed: snapshot.heapUsed,
        heapTotal: snapshot.heapTotal,
        throughput: snapshot.throughput,
        errorRate: snapshot.errorRate,
        activeConnections: snapshot.activeConnections
      }
    };

    await this.database
      .from('monitoring_data')
      .insert(monitoringData);
  }

  private getEmptySnapshot(): PerformanceSnapshot {
    return {
      timestamp: new Date(),
      cpuUsage: 0,
      memoryUsage: 0,
      heapUsed: 0,
      heapTotal: 0,
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      activeConnections: 0
    };
  }

  private calculateAverages(data: PerformanceSnapshot[]): PerformanceSnapshot {
    if (data.length === 0) return this.getEmptySnapshot();

    const sums = data.reduce((acc, curr) => ({
      cpuUsage: acc.cpuUsage + curr.cpuUsage,
      memoryUsage: acc.memoryUsage + curr.memoryUsage,
      heapUsed: acc.heapUsed + curr.heapUsed,
      heapTotal: acc.heapTotal + curr.heapTotal,
      responseTime: acc.responseTime + curr.responseTime,
      throughput: acc.throughput + curr.throughput,
      errorRate: acc.errorRate + curr.errorRate,
      activeConnections: acc.activeConnections + curr.activeConnections
    }), {
      cpuUsage: 0,
      memoryUsage: 0,
      heapUsed: 0,
      heapTotal: 0,
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      activeConnections: 0
    });

    const count = data.length;
    return {
      timestamp: new Date(),
      cpuUsage: sums.cpuUsage / count,
      memoryUsage: sums.memoryUsage / count,
      heapUsed: sums.heapUsed / count,
      heapTotal: sums.heapTotal / count,
      responseTime: sums.responseTime / count,
      throughput: sums.throughput / count,
      errorRate: sums.errorRate / count,
      activeConnections: sums.activeConnections / count
    };
  }

  private calculatePeaks(data: PerformanceSnapshot[]): PerformanceSnapshot {
    if (data.length === 0) return this.getEmptySnapshot();

    return data.reduce((peaks, curr) => ({
      timestamp: curr.timestamp,
      cpuUsage: Math.max(peaks.cpuUsage, curr.cpuUsage),
      memoryUsage: Math.max(peaks.memoryUsage, curr.memoryUsage),
      heapUsed: Math.max(peaks.heapUsed, curr.heapUsed),
      heapTotal: Math.max(peaks.heapTotal, curr.heapTotal),
      responseTime: Math.max(peaks.responseTime, curr.responseTime),
      throughput: Math.max(peaks.throughput, curr.throughput),
      errorRate: Math.max(peaks.errorRate, curr.errorRate),
      activeConnections: Math.max(peaks.activeConnections, curr.activeConnections)
    }), this.getEmptySnapshot());
  }

  private calculateTrends(data: PerformanceSnapshot[]): PerformanceTrend[] {
    if (data.length < 2) return [];

    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);

    const firstAvg = this.calculateAverages(firstHalf);
    const secondAvg = this.calculateAverages(secondHalf);

    const trends: PerformanceTrend[] = [];
    const metrics = ['cpuUsage', 'memoryUsage', 'responseTime', 'errorRate'] as const;

    for (const metric of metrics) {
      const change = ((secondAvg[metric] - firstAvg[metric]) / firstAvg[metric]) * 100;
      const trend = Math.abs(change) < 5 ? 'stable' : change > 0 ? 'increasing' : 'decreasing';
      const severity = Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low';

      trends.push({
        metric,
        trend,
        changePercent: Math.abs(change),
        severity
      });
    }

    return trends;
  }

  private detectViolations(data: PerformanceSnapshot[]): Array<{
    timestamp: Date;
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
  }> {
    const violations = [];

    for (const snapshot of data) {
      // CPU violations
      if (snapshot.cpuUsage >= this.thresholds.cpuUsage.critical) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'cpuUsage',
          value: snapshot.cpuUsage,
          threshold: this.thresholds.cpuUsage.critical,
          severity: 'critical' as const
        });
      } else if (snapshot.cpuUsage >= this.thresholds.cpuUsage.warning) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'cpuUsage',
          value: snapshot.cpuUsage,
          threshold: this.thresholds.cpuUsage.warning,
          severity: 'warning' as const
        });
      }

      // Memory violations
      if (snapshot.memoryUsage >= this.thresholds.memoryUsage.critical) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'memoryUsage',
          value: snapshot.memoryUsage,
          threshold: this.thresholds.memoryUsage.critical,
          severity: 'critical' as const
        });
      } else if (snapshot.memoryUsage >= this.thresholds.memoryUsage.warning) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'memoryUsage',
          value: snapshot.memoryUsage,
          threshold: this.thresholds.memoryUsage.warning,
          severity: 'warning' as const
        });
      }

      // Response time violations
      if (snapshot.responseTime >= this.thresholds.responseTime.critical) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'responseTime',
          value: snapshot.responseTime,
          threshold: this.thresholds.responseTime.critical,
          severity: 'critical' as const
        });
      } else if (snapshot.responseTime >= this.thresholds.responseTime.warning) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'responseTime',
          value: snapshot.responseTime,
          threshold: this.thresholds.responseTime.warning,
          severity: 'warning' as const
        });
      }

      // Error rate violations
      if (snapshot.errorRate >= this.thresholds.errorRate.critical) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'errorRate',
          value: snapshot.errorRate,
          threshold: this.thresholds.errorRate.critical,
          severity: 'critical' as const
        });
      } else if (snapshot.errorRate >= this.thresholds.errorRate.warning) {
        violations.push({
          timestamp: snapshot.timestamp,
          metric: 'errorRate',
          value: snapshot.errorRate,
          threshold: this.thresholds.errorRate.warning,
          severity: 'warning' as const
        });
      }
    }

    return violations;
  }
}