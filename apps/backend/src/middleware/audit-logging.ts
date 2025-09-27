import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface AuditLogEntry {
  timestamp: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  sessionToken?: string;
  requestId: string;
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
  securityEvent?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log audit entry
 */
function logAuditEntry(entry: AuditLogEntry): void {
  const logLevel = entry.riskLevel === 'critical' || entry.riskLevel === 'high' ? 'warn' : 'info';
  
  console[logLevel]('AUDIT_LOG:', JSON.stringify(entry, null, 2));
  
  // In production, you would send this to a proper logging service
  // such as CloudWatch, Datadog, or a dedicated security monitoring system
}

/**
 * Audit logging middleware for security monitoring
 */
export function auditLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = generateRequestId();
    const startTime = performance.now();
    
    // Add request ID to request object for tracing
    (req as any).requestId = requestId;
    
    // Get client information
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const sessionToken = req.headers['x-session-token'] as string;
    
    // Log request start
    const requestEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      ip,
      userAgent,
      sessionToken,
      requestId,
      riskLevel: 'low'
    };
    
    // Assess risk level based on request characteristics
    if (req.originalUrl.includes('/verification/') || req.originalUrl.includes('/qr/')) {
      requestEntry.riskLevel = 'medium';
    }
    
    // Log suspicious patterns
    if (userAgent === 'unknown' || userAgent.length < 10) {
      requestEntry.securityEvent = 'suspicious_user_agent';
      requestEntry.riskLevel = 'high';
    }
    
    logAuditEntry(requestEntry);
    
    // Capture response details
    const originalSend = res.send;
    res.send = function(body: any) {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      const responseEntry: AuditLogEntry = {
        ...requestEntry,
        timestamp: new Date().toISOString(),
        responseTime,
        statusCode: res.statusCode
      };
      
      // Log errors and security events
      if (res.statusCode >= 400) {
        responseEntry.riskLevel = res.statusCode >= 500 ? 'high' : 'medium';
        
        if (res.statusCode === 401 || res.statusCode === 403) {
          responseEntry.securityEvent = 'authentication_failure';
          responseEntry.riskLevel = 'high';
        }
        
        if (res.statusCode === 429) {
          responseEntry.securityEvent = 'rate_limit_exceeded';
          responseEntry.riskLevel = 'high';
        }
        
        try {
          const responseBody = typeof body === 'string' ? JSON.parse(body) : body;
          if (responseBody && responseBody.error) {
            responseEntry.errorMessage = responseBody.message || responseBody.error;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      // Log slow requests
      if (responseTime > 5000) {
        responseEntry.securityEvent = 'slow_response';
        responseEntry.riskLevel = 'medium';
      }
      
      logAuditEntry(responseEntry);
      
      return originalSend.call(this, body);
    };
    
    next();
  };
}

/**
 * Log security events
 */
export function logSecurityEvent(
  req: Request,
  eventType: string,
  riskLevel: 'low' | 'medium' | 'high' | 'critical',
  details?: any
): void {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const sessionToken = req.headers['x-session-token'] as string;
  const requestId = (req as any).requestId || 'unknown';
  
  const securityEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip,
    userAgent,
    sessionToken,
    requestId,
    securityEvent: eventType,
    riskLevel,
    errorMessage: details ? JSON.stringify(details) : undefined
  };
  
  logAuditEntry(securityEntry);
  
  // For critical events, you might want to trigger alerts
  if (riskLevel === 'critical') {
    console.error('CRITICAL_SECURITY_EVENT:', securityEntry);
    // Trigger alert system here
  }
}

/**
 * Middleware specifically for verification endpoint auditing
 */
export function verificationAuditLogging() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Enhanced logging for verification endpoints
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (req.path.includes('/submit')) {
      logSecurityEvent(req, 'verification_submission_attempt', 'medium', {
        hasSessionToken: !!sessionToken,
        bodyKeys: Object.keys(req.body || {})
      });
    }
    
    if (req.path.includes('/verify/')) {
      logSecurityEvent(req, 'qr_verification_attempt', 'medium', {
        storeId: req.params.storeId,
        qrVersion: req.query.v,
        timestamp: req.query.t
      });
    }
    
    next();
  };
}