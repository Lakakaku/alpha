import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface PerformanceRequest extends Request {
  performanceStart?: number;
  performanceMetrics?: {
    startTime: number;
    endTime?: number;
    duration?: number;
    endpoint: string;
    method: string;
    statusCode?: number;
    userId?: string;
    businessContextId?: string;
  };
}

// In-memory performance metrics storage (in production, use Redis or database)
const performanceMetrics = new Map<string, Array<{
  timestamp: number;
  duration: number;
  endpoint: string;
  method: string;
  statusCode: number;
  userId?: string;
  businessContextId?: string;
}>>();

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  QUESTION_EVALUATION: 500,
  RULE_CREATION: 1000,
  TRIGGER_CREATION: 1000,
  HARMONIZER_CREATION: 500,
  ANALYTICS_QUERY: 2000,
  DEFAULT: 1000
};

// Performance monitoring middleware
export const questionPerformanceMiddleware = (req: PerformanceRequest, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  req.performanceStart = startTime;

  // Extract context information
  const endpoint = req.route?.path || req.path;
  const method = req.method;
  const userId = (req as any).user?.id;
  const businessContextId = req.params.businessContextId || 
                           req.body?.business_context_id || 
                           req.query?.business_context_id;

  req.performanceMetrics = {
    startTime,
    endpoint,
    method,
    userId,
    businessContextId
  };

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    req.performanceMetrics!.endTime = endTime;
    req.performanceMetrics!.duration = duration;
    req.performanceMetrics!.statusCode = res.statusCode;

    // Log performance metrics
    recordPerformanceMetrics(req.performanceMetrics!);

    // Check if duration exceeds threshold
    const threshold = getPerformanceThreshold(endpoint);
    if (duration > threshold) {
      console.warn(`Performance warning: ${method} ${endpoint} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`, {
        duration,
        threshold,
        endpoint,
        method,
        statusCode: res.statusCode,
        userId,
        businessContextId
      });

      // Add performance warning header
      res.setHeader('X-Performance-Warning', `Duration ${duration.toFixed(2)}ms exceeded threshold ${threshold}ms`);
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    res.setHeader('X-Performance-Threshold', `${threshold}ms`);

    originalEnd.apply(res, args);
  };

  next();
};

// Specific performance monitoring for question evaluation (most critical endpoint)
export const questionEvaluationPerformanceMiddleware = (req: PerformanceRequest, res: Response, next: NextFunction) => {
  const startTime = performance.now();

  // Track sub-operation timings
  const subTimings: { [key: string]: number } = {};

  // Enhance request with timing utilities
  (req as any).startSubTiming = (operation: string) => {
    subTimings[`${operation}_start`] = performance.now();
  };

  (req as any).endSubTiming = (operation: string) => {
    const startKey = `${operation}_start`;
    if (subTimings[startKey]) {
      subTimings[operation] = performance.now() - subTimings[startKey];
      delete subTimings[startKey];
    }
  };

  const originalJson = res.json;
  res.json = function(body: any) {
    const totalDuration = performance.now() - startTime;

    // Enhance response with performance data
    const enhancedBody = {
      ...body,
      performance_metadata: {
        total_duration_ms: parseFloat(totalDuration.toFixed(2)),
        sub_timings_ms: Object.fromEntries(
          Object.entries(subTimings).map(([key, value]) => [key, parseFloat(value.toFixed(2))])
        ),
        threshold_ms: PERFORMANCE_THRESHOLDS.QUESTION_EVALUATION,
        threshold_exceeded: totalDuration > PERFORMANCE_THRESHOLDS.QUESTION_EVALUATION,
        timestamp: new Date().toISOString()
      }
    };

    // Log detailed performance if threshold exceeded
    if (totalDuration > PERFORMANCE_THRESHOLDS.QUESTION_EVALUATION) {
      console.warn('Question evaluation performance exceeded threshold:', {
        total_duration_ms: totalDuration,
        threshold_ms: PERFORMANCE_THRESHOLDS.QUESTION_EVALUATION,
        sub_timings_ms: subTimings,
        endpoint: req.path,
        business_context_id: req.body?.business_context_id,
        user_id: (req as any).user?.id
      });
    }

    return originalJson.call(this, enhancedBody);
  };

  next();
};

// Performance analytics middleware for admin endpoints
export const performanceAnalyticsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add performance data to response for analytics endpoints
  if (req.path.includes('/admin/') && req.path.includes('performance')) {
    const originalJson = res.json;
    res.json = function(body: any) {
      const performanceData = getPerformanceAnalytics(req.query);
      
      const enhancedBody = {
        ...body,
        performance_analytics: performanceData
      };

      return originalJson.call(this, enhancedBody);
    };
  }

  next();
};

// Circuit breaker middleware for performance protection
export const performanceCircuitBreakerMiddleware = (
  maxFailures: number = 10,
  resetTimeoutMs: number = 60000
) => {
  let failureCount = 0;
  let lastFailureTime = 0;
  let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  return (req: PerformanceRequest, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Reset circuit breaker after timeout
    if (state === 'OPEN' && now - lastFailureTime > resetTimeoutMs) {
      state = 'HALF_OPEN';
      failureCount = 0;
    }

    // Block requests if circuit is open
    if (state === 'OPEN') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Performance circuit breaker is open',
        retry_after: Math.ceil((resetTimeoutMs - (now - lastFailureTime)) / 1000)
      });
    }

    // Monitor response for performance failures
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = req.performanceMetrics?.duration || 0;
      const threshold = getPerformanceThreshold(req.performanceMetrics?.endpoint || '');

      if (duration > threshold * 2) { // Consider it a failure if 2x threshold
        failureCount++;
        lastFailureTime = now;

        if (failureCount >= maxFailures) {
          state = 'OPEN';
          console.error(`Performance circuit breaker opened after ${failureCount} failures`);
        }
      } else if (state === 'HALF_OPEN') {
        // Success in half-open state, reset to closed
        state = 'CLOSED';
        failureCount = 0;
      }

      // Add circuit breaker status header
      res.setHeader('X-Circuit-Breaker-State', state);

      originalEnd.apply(res, args);
    };

    next();
  };
};

// Helper function to get performance threshold for an endpoint
function getPerformanceThreshold(endpoint: string): number {
  if (endpoint.includes('/evaluate')) {
    return PERFORMANCE_THRESHOLDS.QUESTION_EVALUATION;
  } else if (endpoint.includes('/rules') && endpoint.includes('POST')) {
    return PERFORMANCE_THRESHOLDS.RULE_CREATION;
  } else if (endpoint.includes('/triggers') && endpoint.includes('POST')) {
    return PERFORMANCE_THRESHOLDS.TRIGGER_CREATION;
  } else if (endpoint.includes('/harmonizers')) {
    return PERFORMANCE_THRESHOLDS.HARMONIZER_CREATION;
  } else if (endpoint.includes('/analytics') || endpoint.includes('/effectiveness')) {
    return PERFORMANCE_THRESHOLDS.ANALYTICS_QUERY;
  }
  
  return PERFORMANCE_THRESHOLDS.DEFAULT;
}

// Helper function to record performance metrics
function recordPerformanceMetrics(metrics: {
  startTime: number;
  endTime?: number;
  duration?: number;
  endpoint: string;
  method: string;
  statusCode?: number;
  userId?: string;
  businessContextId?: string;
}) {
  if (!metrics.duration || !metrics.statusCode) return;

  const key = `${metrics.method}:${metrics.endpoint}`;
  const record = {
    timestamp: Date.now(),
    duration: metrics.duration,
    endpoint: metrics.endpoint,
    method: metrics.method,
    statusCode: metrics.statusCode,
    userId: metrics.userId,
    businessContextId: metrics.businessContextId
  };

  if (!performanceMetrics.has(key)) {
    performanceMetrics.set(key, []);
  }

  const records = performanceMetrics.get(key)!;
  records.push(record);

  // Keep only last 1000 records per endpoint
  if (records.length > 1000) {
    records.splice(0, records.length - 1000);
  }

  // Clean up old records (older than 24 hours)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  performanceMetrics.set(key, records.filter(r => r.timestamp > oneDayAgo));
}

// Helper function to get performance analytics
function getPerformanceAnalytics(query: any) {
  const endpoint = query.endpoint;
  const timeWindow = parseInt(query.time_window) || 3600000; // 1 hour default
  const now = Date.now();
  const cutoff = now - timeWindow;

  let allRecords: Array<{
    timestamp: number;
    duration: number;
    endpoint: string;
    method: string;
    statusCode: number;
    userId?: string;
    businessContextId?: string;
  }> = [];

  // Collect records from all endpoints or specific endpoint
  for (const [key, records] of performanceMetrics.entries()) {
    if (!endpoint || key.includes(endpoint)) {
      allRecords.push(...records.filter(r => r.timestamp > cutoff));
    }
  }

  if (allRecords.length === 0) {
    return {
      total_requests: 0,
      average_duration_ms: 0,
      p95_duration_ms: 0,
      p99_duration_ms: 0,
      threshold_violations: 0,
      error_rate: 0
    };
  }

  // Sort by duration for percentile calculations
  const durations = allRecords.map(r => r.duration).sort((a, b) => a - b);
  const errorCount = allRecords.filter(r => r.statusCode >= 400).length;
  
  // Calculate threshold violations
  const thresholdViolations = allRecords.filter(record => {
    const threshold = getPerformanceThreshold(record.endpoint);
    return record.duration > threshold;
  }).length;

  return {
    total_requests: allRecords.length,
    average_duration_ms: parseFloat((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)),
    p95_duration_ms: parseFloat(durations[Math.floor(durations.length * 0.95)].toFixed(2)),
    p99_duration_ms: parseFloat(durations[Math.floor(durations.length * 0.99)].toFixed(2)),
    min_duration_ms: parseFloat(durations[0].toFixed(2)),
    max_duration_ms: parseFloat(durations[durations.length - 1].toFixed(2)),
    threshold_violations: thresholdViolations,
    threshold_violation_rate: parseFloat((thresholdViolations / allRecords.length * 100).toFixed(2)),
    error_rate: parseFloat((errorCount / allRecords.length * 100).toFixed(2)),
    time_window_ms: timeWindow
  };
}

// Export performance data getter for external use
export function getPerformanceData(endpoint?: string, timeWindowMs: number = 3600000) {
  return getPerformanceAnalytics({ endpoint, time_window: timeWindowMs });
}