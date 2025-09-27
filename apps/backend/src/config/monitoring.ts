/**
 * Configuration for monitoring background services
 */

export interface MonitoringConfig {
  alertProcessor: {
    enabled: boolean;
    evaluationInterval: number;
    batchSize: number;
    alertCooldownMs: number;
    monitoredServices: string[];
    monitoredMetrics: string[];
  };
  dataAggregator: {
    enabled: boolean;
    aggregationInterval: number;
    dataRetentionDays: number;
    batchSize: number;
    autoCleanup: boolean;
    aggregatedServices: string[];
    aggregatedMetrics: string[];
  };
}

/**
 * Get monitoring configuration from environment variables with defaults
 */
export function getMonitoringConfig(): MonitoringConfig {
  return {
    alertProcessor: {
      enabled: process.env.ALERT_PROCESSOR_ENABLED !== 'false',
      evaluationInterval: parseInt(process.env.ALERT_EVALUATION_INTERVAL || '30000'), // 30 seconds
      batchSize: parseInt(process.env.ALERT_BATCH_SIZE || '100'),
      alertCooldownMs: parseInt(process.env.ALERT_COOLDOWN_MS || '300000'), // 5 minutes
      monitoredServices: (process.env.MONITORED_SERVICES || 'backend,customer_app,business_app,admin_app').split(','),
      monitoredMetrics: (process.env.MONITORED_METRICS || 'api_response_time,cpu_usage,memory_usage,error_rate').split(','),
    },
    dataAggregator: {
      enabled: process.env.DATA_AGGREGATOR_ENABLED !== 'false',
      aggregationInterval: parseInt(process.env.DATA_AGGREGATION_INTERVAL || '3600000'), // 1 hour
      dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '90'),
      batchSize: parseInt(process.env.AGGREGATION_BATCH_SIZE || '1000'),
      autoCleanup: process.env.DATA_AUTO_CLEANUP !== 'false',
      aggregatedServices: (process.env.AGGREGATED_SERVICES || 'backend,customer_app,business_app,admin_app').split(','),
      aggregatedMetrics: (process.env.AGGREGATED_METRICS || 'api_response_time,cpu_usage,memory_usage,error_rate').split(','),
    },
  };
}

/**
 * Validate monitoring configuration
 */
export function validateMonitoringConfig(config: MonitoringConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate alert processor configuration
  if (config.alertProcessor.evaluationInterval < 5000) {
    errors.push('Alert processor evaluation interval must be at least 5 seconds');
  }

  if (config.alertProcessor.batchSize < 1 || config.alertProcessor.batchSize > 1000) {
    errors.push('Alert processor batch size must be between 1 and 1000');
  }

  if (config.alertProcessor.alertCooldownMs < 30000) {
    errors.push('Alert processor cooldown must be at least 30 seconds');
  }

  // Validate data aggregator configuration
  if (config.dataAggregator.aggregationInterval < 60000) {
    errors.push('Data aggregator interval must be at least 1 minute');
  }

  if (config.dataAggregator.dataRetentionDays < 1 || config.dataAggregator.dataRetentionDays > 3650) {
    errors.push('Data retention days must be between 1 and 3650 (10 years)');
  }

  if (config.dataAggregator.batchSize < 1 || config.dataAggregator.batchSize > 10000) {
    errors.push('Data aggregator batch size must be between 1 and 10000');
  }

  // Validate service names
  const validServices = ['backend', 'customer_app', 'business_app', 'admin_app'];
  const invalidMonitoredServices = config.alertProcessor.monitoredServices.filter(
    service => !validServices.includes(service)
  );
  const invalidAggregatedServices = config.dataAggregator.aggregatedServices.filter(
    service => !validServices.includes(service)
  );

  if (invalidMonitoredServices.length > 0) {
    errors.push(`Invalid monitored services: ${invalidMonitoredServices.join(', ')}`);
  }

  if (invalidAggregatedServices.length > 0) {
    errors.push(`Invalid aggregated services: ${invalidAggregatedServices.join(', ')}`);
  }

  // Validate metric types
  const validMetrics = ['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'];
  const invalidMonitoredMetrics = config.alertProcessor.monitoredMetrics.filter(
    metric => !validMetrics.includes(metric)
  );
  const invalidAggregatedMetrics = config.dataAggregator.aggregatedMetrics.filter(
    metric => !validMetrics.includes(metric)
  );

  if (invalidMonitoredMetrics.length > 0) {
    errors.push(`Invalid monitored metrics: ${invalidMonitoredMetrics.join(', ')}`);
  }

  if (invalidAggregatedMetrics.length > 0) {
    errors.push(`Invalid aggregated metrics: ${invalidAggregatedMetrics.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get production-optimized monitoring configuration
 */
export function getProductionMonitoringConfig(): Partial<MonitoringConfig> {
  return {
    alertProcessor: {
      enabled: true,
      evaluationInterval: 60000, // 1 minute for production
      batchSize: 200,
      alertCooldownMs: 900000, // 15 minutes for production
      monitoredServices: ['backend', 'customer_app', 'business_app', 'admin_app'],
      monitoredMetrics: ['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'],
    },
    dataAggregator: {
      enabled: true,
      aggregationInterval: 3600000, // 1 hour
      dataRetentionDays: 365, // 1 year in production
      batchSize: 2000,
      autoCleanup: true,
      aggregatedServices: ['backend', 'customer_app', 'business_app', 'admin_app'],
      aggregatedMetrics: ['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'],
    },
  };
}

/**
 * Get development-optimized monitoring configuration
 */
export function getDevelopmentMonitoringConfig(): Partial<MonitoringConfig> {
  return {
    alertProcessor: {
      enabled: true,
      evaluationInterval: 15000, // 15 seconds for development
      batchSize: 50,
      alertCooldownMs: 60000, // 1 minute for development
      monitoredServices: ['backend'],
      monitoredMetrics: ['api_response_time', 'error_rate'],
    },
    dataAggregator: {
      enabled: true,
      aggregationInterval: 300000, // 5 minutes for development
      dataRetentionDays: 7, // 1 week in development
      batchSize: 100,
      autoCleanup: true,
      aggregatedServices: ['backend'],
      aggregatedMetrics: ['api_response_time', 'error_rate'],
    },
  };
}

/**
 * Merge configuration objects with environment-specific overrides
 */
export function mergeMonitoringConfig(
  base: MonitoringConfig,
  override: Partial<MonitoringConfig>
): MonitoringConfig {
  return {
    alertProcessor: {
      ...base.alertProcessor,
      ...override.alertProcessor,
    },
    dataAggregator: {
      ...base.dataAggregator,
      ...override.dataAggregator,
    },
  };
}

/**
 * Log monitoring configuration (safely, without sensitive data)
 */
export function logMonitoringConfig(config: MonitoringConfig): void {
  console.log('Monitoring Configuration:');
  console.log('Alert Processor:', {
    enabled: config.alertProcessor.enabled,
    evaluationInterval: `${config.alertProcessor.evaluationInterval}ms`,
    batchSize: config.alertProcessor.batchSize,
    alertCooldown: `${config.alertProcessor.alertCooldownMs}ms`,
    monitoredServicesCount: config.alertProcessor.monitoredServices.length,
    monitoredMetricsCount: config.alertProcessor.monitoredMetrics.length,
  });
  console.log('Data Aggregator:', {
    enabled: config.dataAggregator.enabled,
    aggregationInterval: `${config.dataAggregator.aggregationInterval}ms`,
    dataRetentionDays: config.dataAggregator.dataRetentionDays,
    batchSize: config.dataAggregator.batchSize,
    autoCleanup: config.dataAggregator.autoCleanup,
    aggregatedServicesCount: config.dataAggregator.aggregatedServices.length,
    aggregatedMetricsCount: config.dataAggregator.aggregatedMetrics.length,
  });
}