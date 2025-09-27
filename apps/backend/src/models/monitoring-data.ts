export interface MonitoringData {
  monitoring_id: string;
  environment_id: string;
  app_name: string;
  metric_type: 'uptime' | 'performance' | 'error_rate' | 'response_time' | 'memory' | 'cpu' | 'disk';
  metric_value: number;
  metric_unit: string;
  timestamp: Date;
  status: 'normal' | 'warning' | 'critical';
  threshold_exceeded: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface UptimeMetrics {
  availability_percent: number;
  downtime_minutes: number;
  incident_count: number;
  mttr_minutes: number; // Mean Time To Recovery
  sla_target: number;
  sla_status: 'meeting' | 'at_risk' | 'breach';
}

export interface PerformanceMetrics {
  response_time_p50: number;
  response_time_p95: number;
  response_time_p99: number;
  throughput_rps: number;
  error_rate_percent: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  disk_usage_percent: number;
}

export interface AlertThresholds {
  metric_type: string;
  warning_threshold: number;
  critical_threshold: number;
  duration_minutes: number;
  enabled: boolean;
}

export class MonitoringDataModel {
  private static readonly SLA_TARGET = 99.5; // 99.5% uptime
  private static readonly RESPONSE_TIME_TARGET = 2000; // 2 seconds
  private static readonly ERROR_RATE_TARGET = 1.0; // 1% error rate

  static validate(data: Partial<MonitoringData>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.monitoring_id) {
      errors.push('monitoring_id is required');
    }

    if (!data.environment_id) {
      errors.push('environment_id is required');
    }

    if (!data.app_name) {
      errors.push('app_name is required');
    }

    if (!data.metric_type || !['uptime', 'performance', 'error_rate', 'response_time', 'memory', 'cpu', 'disk'].includes(data.metric_type)) {
      errors.push('metric_type must be uptime, performance, error_rate, response_time, memory, cpu, or disk');
    }

    if (data.metric_value === undefined || data.metric_value === null) {
      errors.push('metric_value is required');
    }

    if (typeof data.metric_value === 'number' && data.metric_value < 0) {
      errors.push('metric_value cannot be negative');
    }

    if (!data.metric_unit) {
      errors.push('metric_unit is required');
    }

    if (!data.timestamp) {
      errors.push('timestamp is required');
    }

    if (!data.status || !['normal', 'warning', 'critical'].includes(data.status)) {
      errors.push('status must be normal, warning, or critical');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static determineStatus(metricType: string, value: number): 'normal' | 'warning' | 'critical' {
    const thresholds = this.getDefaultThresholds(metricType);
    
    if (value >= thresholds.critical_threshold) {
      return 'critical';
    } else if (value >= thresholds.warning_threshold) {
      return 'warning';
    }
    
    return 'normal';
  }

  static getDefaultThresholds(metricType: string): AlertThresholds {
    const thresholds: Record<string, AlertThresholds> = {
      'uptime': {
        metric_type: 'uptime',
        warning_threshold: 99.0,
        critical_threshold: 98.0,
        duration_minutes: 5,
        enabled: true
      },
      'response_time': {
        metric_type: 'response_time',
        warning_threshold: 2000,
        critical_threshold: 5000,
        duration_minutes: 2,
        enabled: true
      },
      'error_rate': {
        metric_type: 'error_rate',
        warning_threshold: 1.0,
        critical_threshold: 5.0,
        duration_minutes: 5,
        enabled: true
      },
      'cpu': {
        metric_type: 'cpu',
        warning_threshold: 70.0,
        critical_threshold: 90.0,
        duration_minutes: 10,
        enabled: true
      },
      'memory': {
        metric_type: 'memory',
        warning_threshold: 80.0,
        critical_threshold: 95.0,
        duration_minutes: 5,
        enabled: true
      },
      'disk': {
        metric_type: 'disk',
        warning_threshold: 85.0,
        critical_threshold: 95.0,
        duration_minutes: 30,
        enabled: true
      }
    };

    return thresholds[metricType] || {
      metric_type: metricType,
      warning_threshold: 80.0,
      critical_threshold: 95.0,
      duration_minutes: 15,
      enabled: false
    };
  }

  static calculateUptimeMetrics(dataPoints: MonitoringData[], periodHours: number = 24): UptimeMetrics {
    const uptimeData = dataPoints.filter(d => d.metric_type === 'uptime');
    
    if (uptimeData.length === 0) {
      return {
        availability_percent: 0,
        downtime_minutes: periodHours * 60,
        incident_count: 0,
        mttr_minutes: 0,
        sla_target: this.SLA_TARGET,
        sla_status: 'breach'
      };
    }

    const totalMinutes = periodHours * 60;
    const uptimeSum = uptimeData.reduce((sum, d) => sum + d.metric_value, 0);
    const availability = (uptimeSum / uptimeData.length);
    const downtime = totalMinutes * (1 - availability / 100);
    
    const incidents = uptimeData.filter(d => d.status !== 'normal').length;
    const mttr = incidents > 0 ? downtime / incidents : 0;

    let slaStatus: 'meeting' | 'at_risk' | 'breach' = 'meeting';
    if (availability < this.SLA_TARGET - 1.0) {
      slaStatus = 'breach';
    } else if (availability < this.SLA_TARGET) {
      slaStatus = 'at_risk';
    }

    return {
      availability_percent: availability,
      downtime_minutes: downtime,
      incident_count: incidents,
      mttr_minutes: mttr,
      sla_target: this.SLA_TARGET,
      sla_status: slaStatus
    };
  }

  static calculatePerformanceMetrics(dataPoints: MonitoringData[]): PerformanceMetrics {
    const responseTimeData = dataPoints.filter(d => d.metric_type === 'response_time').map(d => d.metric_value);
    const errorRateData = dataPoints.filter(d => d.metric_type === 'error_rate');
    const cpuData = dataPoints.filter(d => d.metric_type === 'cpu');
    const memoryData = dataPoints.filter(d => d.metric_type === 'memory');
    const diskData = dataPoints.filter(d => d.metric_type === 'disk');

    const calculatePercentile = (values: number[], percentile: number): number => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const average = (values: number[]): number => {
      return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    };

    return {
      response_time_p50: calculatePercentile(responseTimeData, 50),
      response_time_p95: calculatePercentile(responseTimeData, 95),
      response_time_p99: calculatePercentile(responseTimeData, 99),
      throughput_rps: 0, // This would need to be calculated from request logs
      error_rate_percent: average(errorRateData.map(d => d.metric_value)),
      cpu_usage_percent: average(cpuData.map(d => d.metric_value)),
      memory_usage_percent: average(memoryData.map(d => d.metric_value)),
      disk_usage_percent: average(diskData.map(d => d.metric_value))
    };
  }

  static createMetric(
    environmentId: string,
    appName: string,
    metricType: MonitoringData['metric_type'],
    value: number,
    unit: string,
    metadata?: Record<string, any>
  ): MonitoringData {
    const now = new Date();
    const status = this.determineStatus(metricType, value);
    const thresholds = this.getDefaultThresholds(metricType);

    return {
      monitoring_id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      environment_id: environmentId,
      app_name: appName,
      metric_type: metricType,
      metric_value: value,
      metric_unit: unit,
      timestamp: now,
      status,
      threshold_exceeded: value >= thresholds.warning_threshold,
      metadata,
      created_at: now
    };
  }

  static needsAlert(data: MonitoringData): boolean {
    return data.status === 'critical' || 
           (data.status === 'warning' && data.threshold_exceeded);
  }

  static formatMetricValue(data: MonitoringData): string {
    const value = data.metric_value;
    const unit = data.metric_unit;

    if (data.metric_type === 'uptime') {
      return `${value.toFixed(2)}%`;
    }

    if (data.metric_type === 'response_time') {
      return `${value}ms`;
    }

    if (unit === 'percent') {
      return `${value.toFixed(1)}%`;
    }

    if (unit === 'bytes') {
      const mb = value / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    }

    return `${value} ${unit}`;
  }
}