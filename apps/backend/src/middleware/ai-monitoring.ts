import { Request, Response, NextFunction } from 'express';
import { loggingService } from '../services/loggingService.js';

interface AICallMetrics {
  sessionId: string;
  storeId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorCode?: string;
  retryCount?: number;
  metadata?: Record<string, any>;
}

interface OpenAIMetrics {
  sessionId: string;
  model: string;
  operation: 'realtime_connect' | 'chat_completion' | 'analysis';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  cost?: number;
}

interface PhoneServiceMetrics {
  sessionId: string;
  phoneNumber: string;
  operation: 'call_initiate' | 'call_connect' | 'call_end';
  durationSeconds?: number;
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  cost?: number;
}

class AIMetricsCollector {
  private callMetrics: Map<string, AICallMetrics> = new Map();
  private openaiMetrics: OpenAIMetrics[] = [];
  private phoneMetrics: PhoneServiceMetrics[] = [];

  startCallSession(sessionId: string, storeId: string, operation: string): void {
    const metrics: AICallMetrics = {
      sessionId,
      storeId,
      operation,
      startTime: Date.now(),
      success: false
    };
    this.callMetrics.set(sessionId, metrics);
  }

  endCallSession(sessionId: string, success: boolean, errorCode?: string, metadata?: Record<string, any>): void {
    const metrics = this.callMetrics.get(sessionId);
    if (metrics) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = success;
      metrics.errorCode = errorCode;
      metrics.metadata = metadata;

      // Log metrics
      this.logCallMetrics(metrics);
      
      // Remove from active tracking
      this.callMetrics.delete(sessionId);
    }
  }

  recordOpenAIUsage(metrics: OpenAIMetrics): void {
    this.openaiMetrics.push(metrics);
    this.logOpenAIMetrics(metrics);
    
    // Keep only last 1000 metrics in memory
    if (this.openaiMetrics.length > 1000) {
      this.openaiMetrics.shift();
    }
  }

  recordPhoneUsage(metrics: PhoneServiceMetrics): void {
    this.phoneMetrics.push(metrics);
    this.logPhoneMetrics(metrics);
    
    // Keep only last 1000 metrics in memory
    if (this.phoneMetrics.length > 1000) {
      this.phoneMetrics.shift();
    }
  }

  private logCallMetrics(metrics: AICallMetrics): void {
    loggingService.log('info', 'AI call metrics', {
      type: 'ai_call_metrics',
      sessionId: metrics.sessionId,
      storeId: metrics.storeId,
      operation: metrics.operation,
      duration: metrics.duration,
      success: metrics.success,
      errorCode: metrics.errorCode,
      retryCount: metrics.retryCount,
      metadata: metrics.metadata,
      timestamp: new Date().toISOString()
    });
  }

  private logOpenAIMetrics(metrics: OpenAIMetrics): void {
    loggingService.log('info', 'OpenAI API metrics', {
      type: 'openai_metrics',
      sessionId: metrics.sessionId,
      model: metrics.model,
      operation: metrics.operation,
      tokenUsage: metrics.tokenUsage,
      latencyMs: metrics.latencyMs,
      cost: metrics.cost,
      timestamp: new Date().toISOString()
    });
  }

  private logPhoneMetrics(metrics: PhoneServiceMetrics): void {
    loggingService.log('info', 'Phone service metrics', {
      type: 'phone_metrics',
      sessionId: metrics.sessionId,
      phoneNumber: metrics.phoneNumber,
      operation: metrics.operation,
      durationSeconds: metrics.durationSeconds,
      connectionQuality: metrics.connectionQuality,
      cost: metrics.cost,
      timestamp: new Date().toISOString()
    });
  }

  getActiveSessionsCount(): number {
    return this.callMetrics.size;
  }

  getRecentMetrics(minutes: number = 60) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    return {
      openai: this.openaiMetrics.filter(m => 
        this.openaiMetrics.indexOf(m) > this.openaiMetrics.length - 100 // Recent entries
      ),
      phone: this.phoneMetrics.filter(m => 
        this.phoneMetrics.indexOf(m) > this.phoneMetrics.length - 100 // Recent entries
      )
    };
  }
}

export const aiMetricsCollector = new AIMetricsCollector();

export const aiMonitoringMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only monitor AI-related endpoints
  const isAIEndpoint = req.path.startsWith('/api/ai/') || 
                       req.path.startsWith('/api/webhooks/phone-events');
  
  if (!isAIEndpoint) {
    return next();
  }

  const startTime = Date.now();
  const sessionId = req.params.sessionId || req.body?.sessionId || req.headers['x-session-id'] as string;
  const storeId = req.params.storeId || req.body?.storeId || req.headers['x-store-id'] as string;
  
  if (sessionId) {
    aiMetricsCollector.startCallSession(sessionId, storeId, `${req.method} ${req.path}`);
  }

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const success = res.statusCode < 400;
    
    if (sessionId) {
      const errorCode = success ? undefined : res.statusMessage;
      const metadata = {
        httpMethod: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        responseTime: duration,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      };
      
      aiMetricsCollector.endCallSession(sessionId, success, errorCode, metadata);
    }

    // Log all AI endpoint calls
    loggingService.log('info', 'AI endpoint call', {
      type: 'ai_endpoint_metrics',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      success,
      sessionId,
      storeId,
      timestamp: new Date().toISOString()
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Helper functions for service-specific metrics
export const recordOpenAICall = (
  sessionId: string,
  model: string,
  operation: OpenAIMetrics['operation'],
  startTime: number,
  tokenUsage?: OpenAIMetrics['tokenUsage']
): void => {
  const latencyMs = Date.now() - startTime;
  
  // Estimate cost based on model and tokens (approximate rates)
  let cost = 0;
  if (tokenUsage && model.includes('gpt-4o-mini')) {
    cost = (tokenUsage.promptTokens * 0.00015 + tokenUsage.completionTokens * 0.0006) / 1000;
  }

  aiMetricsCollector.recordOpenAIUsage({
    sessionId,
    model,
    operation,
    tokenUsage,
    latencyMs,
    cost
  });
};

export const recordPhoneCall = (
  sessionId: string,
  phoneNumber: string,
  operation: PhoneServiceMetrics['operation'],
  durationSeconds?: number,
  connectionQuality?: PhoneServiceMetrics['connectionQuality']
): void => {
  // Estimate cost based on 46elks rates (approximate)
  let cost = 0;
  if (durationSeconds && operation === 'call_end') {
    cost = Math.ceil(durationSeconds / 60) * 0.35; // SEK per minute
  }

  aiMetricsCollector.recordPhoneUsage({
    sessionId,
    phoneNumber,
    operation,
    durationSeconds,
    connectionQuality,
    cost
  });
};

// Health check endpoint for monitoring
export const getAIHealthMetrics = () => {
  const activeSessionsCount = aiMetricsCollector.getActiveSessionsCount();
  const recentMetrics = aiMetricsCollector.getRecentMetrics(60);
  
  // Calculate success rates
  const recentOpenAICalls = recentMetrics.openai.length;
  const recentPhoneCalls = recentMetrics.phone.length;
  
  return {
    status: 'healthy',
    activeSessionsCount,
    metrics: {
      openai: {
        recentCalls: recentOpenAICalls,
        averageLatency: recentMetrics.openai.reduce((sum, m) => sum + m.latencyMs, 0) / Math.max(recentOpenAICalls, 1)
      },
      phone: {
        recentCalls: recentPhoneCalls,
        connectionQuality: recentMetrics.phone.reduce((acc, m) => {
          if (m.connectionQuality) {
            acc[m.connectionQuality] = (acc[m.connectionQuality] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    },
    timestamp: new Date().toISOString()
  };
};