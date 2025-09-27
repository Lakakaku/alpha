import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '../services/monitoring/monitoring-service';
import { loggingService } from '../services/loggingService';

export interface MonitoringRequest extends Request {
  startTime?: number;
  monitoringContext?: {
    serviceName: string;
    endpoint: string;
    userId?: string;
  };
}

/**
 * Middleware to collect metrics for all API requests
 * Records API response times, error rates, and endpoint usage
 */
export const monitoringMiddleware = (serviceName: string = 'backend') => {
  return (req: MonitoringRequest, res: Response, next: NextFunction) => {
    // Record start time for response time calculation
    req.startTime = Date.now();
    
    // Set monitoring context
    req.monitoringContext = {
      serviceName,
      endpoint: req.path,
      userId: req.user?.id,
    };

    // Override res.end to capture response data
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      // Call original end method
      originalEnd.call(this, chunk, encoding);
      
      // Collect metrics after response is sent
      collectRequestMetrics(req, res);
    };

    next();
  };
};

/**
 * Collect and record metrics for completed request
 */
async function collectRequestMetrics(req: MonitoringRequest, res: Response) {
  try {
    const endTime = Date.now();
    const startTime = req.startTime || endTime;
    const responseTime = endTime - startTime;
    const context = req.monitoringContext!;

    // Record API response time metric
    await MonitoringService.getInstance().recordMetric({
      metricType: 'api_response_time',
      metricValue: responseTime,
      serviceName: context.serviceName,
      additionalData: {
        endpoint: context.endpoint,
        method: req.method,
        statusCode: res.statusCode,
        userId: context.userId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      },
    });

    // Record error if status code indicates error
    if (res.statusCode >= 400) {
      await MonitoringService.getInstance().logError({
        severity: res.statusCode >= 500 ? 'critical' : 'warning',
        errorMessage: `HTTP ${res.statusCode} - ${req.method} ${context.endpoint}`,
        serviceName: context.serviceName,
        endpoint: context.endpoint,
        userContext: {
          userId: context.userId,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        },
      });
    }

    // Update usage analytics (daily aggregation handled by background service)
    await updateUsageAnalytics(context, req);

  } catch (error) {
    // Don't fail the request if monitoring fails
    loggingService.logError('monitoring-middleware', 'Failed to collect request metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.monitoringContext?.endpoint,
      serviceName: req.monitoringContext?.serviceName,
    });
  }
}

/**
 * Update usage analytics for the request
 */
async function updateUsageAnalytics(
  context: { serviceName: string; endpoint: string; userId?: string },
  req: Request
) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Determine feature usage based on endpoint
    const featureUsage = getFeatureUsage(context.endpoint, req.method);
    
    await MonitoringService.getInstance().recordUsageAnalytics({
      date: today,
      serviceName: context.serviceName,
      dailyActiveUsers: context.userId ? 1 : 0,
      apiCallVolume: 1,
      featureUsage,
    });
  } catch (error) {
    // Log but don't fail - usage analytics are not critical
    loggingService.logError('monitoring-middleware', 'Failed to update usage analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: context.endpoint,
      serviceName: context.serviceName,
    });
  }
}

/**
 * Map endpoint paths to feature usage categories
 */
function getFeatureUsage(endpoint: string, method: string): Record<string, number> {
  const featureUsage: Record<string, number> = {};
  
  // QR code scanning
  if (endpoint.includes('/qr/') || endpoint.includes('/verification')) {
    featureUsage.qr_scans = 1;
  }
  
  // Feedback/calls functionality
  if (endpoint.includes('/calls') || endpoint.includes('/feedback')) {
    featureUsage.feedback_calls = 1;
  }
  
  // Business management
  if (endpoint.includes('/businesses') || endpoint.includes('/stores')) {
    featureUsage.business_management = 1;
  }
  
  // Admin operations
  if (endpoint.includes('/admin/')) {
    featureUsage.admin_operations = 1;
  }
  
  // Monitoring access
  if (endpoint.includes('/monitoring/')) {
    featureUsage.monitoring_access = 1;
  }
  
  // Authentication
  if (endpoint.includes('/auth')) {
    featureUsage.authentication = 1;
  }
  
  return featureUsage;
}

/**
 * Middleware to record system performance metrics
 * Should be called periodically by a background service
 */
export async function recordSystemMetrics(serviceName: string = 'backend') {
  try {
    const metrics = await getSystemPerformanceMetrics();
    
    for (const [metricType, value] of Object.entries(metrics)) {
      await MonitoringService.getInstance().recordMetric({
        metricType,
        metricValue: value,
        serviceName,
        additionalData: {
          timestamp: new Date().toISOString(),
          source: 'system_monitor',
        },
      });
    }
  } catch (error) {
    loggingService.logError('monitoring-middleware', 'Failed to record system metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      serviceName,
    });
  }
}

/**
 * Get current system performance metrics
 */
async function getSystemPerformanceMetrics(): Promise<Record<string, number>> {
  const metrics: Record<string, number> = {};
  
  try {
    // Memory usage (Node.js specific)
    const memUsage = process.memoryUsage();
    metrics.memory_usage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    // CPU usage approximation (would need more sophisticated monitoring in production)
    const cpuUsage = process.cpuUsage();
    metrics.cpu_usage = Math.min(100, Math.round((cpuUsage.user + cpuUsage.system) / 1000000)); // Convert to percentage approximation
    
    // Process uptime
    metrics.uptime_seconds = process.uptime();
    
    // Event loop lag (basic approximation)
    const start = process.hrtime.bigint();
    await new Promise(resolve => setImmediate(resolve));
    const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
    metrics.event_loop_lag_ms = Math.round(lag);
    
  } catch (error) {
    loggingService.logError('monitoring-middleware', 'Failed to get system metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  return metrics;
}

/**
 * Express error handling middleware that logs errors to monitoring system
 */
export const errorMonitoringMiddleware = (
  error: Error,
  req: MonitoringRequest,
  res: Response,
  next: NextFunction
) => {
  // Log error to monitoring system
  MonitoringService.getInstance().logError({
    severity: 'critical',
    errorMessage: error.message,
    stackTrace: error.stack,
    serviceName: req.monitoringContext?.serviceName || 'backend',
    endpoint: req.monitoringContext?.endpoint || req.path,
    userContext: {
      userId: req.monitoringContext?.userId,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    },
  }).catch((monitoringError) => {
    // Don't fail the request if monitoring fails
    loggingService.logError('error-monitoring-middleware', 'Failed to log error to monitoring system', {
      originalError: error.message,
      monitoringError: monitoringError instanceof Error ? monitoringError.message : 'Unknown error',
    });
  });

  // Continue with normal error handling
  next(error);
};

export default monitoringMiddleware;