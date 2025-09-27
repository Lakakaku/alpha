import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { AuditLoggingService } from '../services/security/auditLoggingService';
import { IntrusionDetectionService } from '../services/security/intrusionDetectionService';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  requestId?: string;
  timestamp: string;
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class FraudDetectionError extends Error {
  constructor(message: string, public riskLevel?: string) {
    super(message);
    this.name = 'FraudDetectionError';
  }
}

export class SessionError extends Error {
  constructor(message: string, public sessionStatus?: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export class SecurityError extends Error {
  constructor(message: string, public securityContext?: any) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class IntrusionDetectionError extends Error {
  constructor(message: string, public threatLevel?: number, public threatTypes?: string[]) {
    super(message);
    this.name = 'IntrusionDetectionError';
  }
}

export class AuditError extends Error {
  constructor(message: string, public auditContext?: any) {
    super(message);
    this.name = 'AuditError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string, public encryptionContext?: any) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DataIntegrityError extends Error {
  constructor(message: string, public integrityContext?: any) {
    super(message);
    this.name = 'DataIntegrityError';
  }
}

// Initialize security services
const auditService = new AuditLoggingService();
const intrusionService = new IntrusionDetectionService();

// Error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);

  // Log error with context
  const errorContext = {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };

  // Handle security-related errors with enhanced logging and intrusion detection
  const isSecurityError = err instanceof SecurityError || 
                         err instanceof IntrusionDetectionError || 
                         err instanceof FraudDetectionError ||
                         err instanceof AuditError ||
                         err instanceof EncryptionError ||
                         err instanceof DataIntegrityError;

  // Handle authentication/authorization errors that might indicate attacks
  const isSuspiciousAuthError = (err instanceof AuthenticationError || 
                               err instanceof AuthorizationError) &&
                               (req.path.includes('/admin') || 
                                req.path.includes('/fraud') || 
                                req.path.includes('/security'));

  // Determine log level based on error type
  if (err instanceof ValidationError || 
      err instanceof NotFoundError) {
    logger.warn('Client error occurred', errorContext);
  } else if (err instanceof AuthenticationError || 
             err instanceof AuthorizationError) {
    logger.warn('Authentication/Authorization error occurred', errorContext);
    
    // Log suspicious auth attempts for security monitoring
    if (isSuspiciousAuthError) {
      handleSecurityAuditLogging(req, err, requestId);
    }
  } else if (isSecurityError) {
    logger.error('Security error occurred', errorContext);
    handleSecurityErrorLogging(req, err, requestId);
  } else {
    logger.error('Server error occurred', errorContext);
  }

  // Don't send error details in production for security
  const isDevelopment = process.env.NODE_ENV === 'development';

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle specific error types
  if (err instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
    details = err.details;
  } else if (err instanceof AuthenticationError) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = err.message;
  } else if (err instanceof AuthorizationError) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = err.message;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = err.message;
  } else if (err instanceof ConflictError) {
    statusCode = 409;
    errorCode = 'CONFLICT';
    message = err.message;
    details = err.details;
  } else if (err instanceof RateLimitError) {
    statusCode = 429;
    errorCode = 'RATE_LIMITED';
    message = err.message;
    if (err.retryAfter) {
      res.set('Retry-After', err.retryAfter.toString());
    }
  } else if (err instanceof FraudDetectionError) {
    statusCode = 403;
    errorCode = 'FRAUD_DETECTION_BLOCKED';
    message = err.message;
    details = { riskLevel: err.riskLevel };
  } else if (err instanceof SessionError) {
    statusCode = 401;
    errorCode = 'SESSION_ERROR';
    message = err.message;
    details = { sessionStatus: err.sessionStatus };
  } else if (err instanceof SecurityError) {
    statusCode = 403;
    errorCode = 'SECURITY_ERROR';
    message = 'Security policy violation detected';
    details = isDevelopment ? err.securityContext : undefined;
  } else if (err instanceof IntrusionDetectionError) {
    statusCode = 403;
    errorCode = 'INTRUSION_DETECTED';
    message = 'Potential security threat detected';
    details = isDevelopment ? {
      threatLevel: err.threatLevel,
      threatTypes: err.threatTypes
    } : { threatLevel: err.threatLevel };
  } else if (err instanceof AuditError) {
    statusCode = 500;
    errorCode = 'AUDIT_ERROR';
    message = 'Security audit logging failed';
    details = isDevelopment ? err.auditContext : undefined;
  } else if (err instanceof EncryptionError) {
    statusCode = 500;
    errorCode = 'ENCRYPTION_ERROR';
    message = 'Data encryption/decryption failed';
    details = isDevelopment ? err.encryptionContext : undefined;
  } else if (err instanceof DataIntegrityError) {
    statusCode = 422;
    errorCode = 'DATA_INTEGRITY_ERROR';
    message = 'Data integrity violation detected';
    details = isDevelopment ? err.integrityContext : undefined;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    // JSON parsing error
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if (err.name === 'MulterError') {
    // File upload error
    statusCode = 400;
    errorCode = 'FILE_UPLOAD_ERROR';
    message = 'File upload failed';
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: errorCode,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Include details in development or for client errors
  if (details && (isDevelopment || statusCode < 500)) {
    errorResponse.details = details;
  }

  // Include stack trace in development for server errors
  if (isDevelopment && statusCode >= 500) {
    errorResponse.details = {
      stack: err.stack?.split('\n'),
      originalError: err.name,
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Handle security error logging and intrusion detection
async function handleSecurityErrorLogging(req: Request, err: Error, requestId: string): Promise<void> {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Log security audit event
    await auditService.logEvent({
      event_type: 'security_violation',
      user_id: req.user?.id || null,
      user_type: req.user?.role || 'anonymous',
      action_performed: `security_error_${err.name.toLowerCase()}`,
      resource_type: 'security_system',
      resource_id: req.path,
      ip_address: clientIP,
      user_agent: req.get('User-Agent'),
      correlation_id: requestId,
      event_metadata: {
        error_type: err.name,
        error_message: err.message,
        request_method: req.method,
        request_path: req.path,
        timestamp: new Date().toISOString()
      },
      result_status: 'failure'
    });

    // Create intrusion event for security errors
    let severityLevel = 5; // Default medium severity
    let eventType = 'security_violation';
    let attackPattern = `Security error: ${err.name}`;

    if (err instanceof IntrusionDetectionError) {
      severityLevel = err.threatLevel || 7;
      eventType = 'unusual_access';
      attackPattern = `Intrusion detection triggered: ${err.threatTypes?.join(', ') || 'unknown threats'}`;
    } else if (err instanceof FraudDetectionError) {
      severityLevel = err.riskLevel === 'critical' ? 9 : err.riskLevel === 'high' ? 7 : 5;
      eventType = 'unusual_access';
      attackPattern = `Fraud detection triggered: ${err.riskLevel || 'unknown'} risk level`;
    } else if (err instanceof EncryptionError) {
      severityLevel = 8;
      eventType = 'data_exfiltration';
      attackPattern = 'Encryption system compromise attempt';
    } else if (err instanceof DataIntegrityError) {
      severityLevel = 7;
      eventType = 'data_exfiltration';
      attackPattern = 'Data integrity violation detected';
    }

    await intrusionService.createIntrusionEvent({
      event_type: eventType,
      source_ip: clientIP,
      target_resource: req.path,
      attack_pattern: attackPattern,
      severity_level: severityLevel,
      detection_method: 'error_handler_middleware',
      automated_response: {
        action: severityLevel >= 8 ? 'immediate_alert' : 'log_and_monitor',
        error_context: {
          error_name: err.name,
          request_id: requestId,
          user_id: req.user?.id || 'anonymous'
        }
      },
      admin_notified: severityLevel >= 8,
      incident_status: 'detected'
    });

  } catch (auditError) {
    // Fallback logging if audit services fail
    logger.error('Failed to log security error to audit services', {
      originalError: err.message,
      auditError: auditError instanceof Error ? auditError.message : 'Unknown audit error',
      requestId
    });
  }
}

// Handle suspicious authentication attempts
async function handleSecurityAuditLogging(req: Request, err: Error, requestId: string): Promise<void> {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    await Promise.all([
      // Log authentication failure
      auditService.logEvent({
        event_type: 'authentication',
        user_id: null,
        user_type: 'anonymous',
        action_performed: 'suspicious_auth_attempt',
        resource_type: 'authentication_system',
        resource_id: req.path,
        ip_address: clientIP,
        user_agent: req.get('User-Agent'),
        correlation_id: requestId,
        event_metadata: {
          error_type: err.name,
          attempted_resource: req.path,
          request_method: req.method,
          is_admin_endpoint: req.path.includes('/admin'),
          is_security_endpoint: req.path.includes('/security') || req.path.includes('/fraud'),
          timestamp: new Date().toISOString()
        },
        result_status: 'failure'
      }),

      // Create potential brute force intrusion event
      intrusionService.createIntrusionEvent({
        event_type: 'brute_force',
        source_ip: clientIP,
        target_resource: req.path,
        attack_pattern: `Suspicious authentication attempt on ${req.path}`,
        severity_level: req.path.includes('/admin') ? 7 : 5,
        detection_method: 'error_handler_auth_monitoring',
        automated_response: {
          action: 'monitor_ip',
          auth_failure_context: {
            endpoint: req.path,
            error_type: err.name,
            request_id: requestId
          }
        },
        incident_status: 'detected'
      })
    ]);

  } catch (auditError) {
    logger.error('Failed to log suspicious authentication attempt', {
      originalError: err.message,
      auditError: auditError instanceof Error ? auditError.message : 'Unknown audit error',
      requestId,
      clientIP: req.ip
    });
  }
}

// Async error wrapper for route handlers
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

// Security-aware error recovery middleware
export function securityErrorRecovery(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle specific security error recovery scenarios
  if (err instanceof IntrusionDetectionError && err.threatLevel && err.threatLevel >= 8) {
    // High threat level - immediate response with minimal information
    res.status(403).json({
      error: 'ACCESS_DENIED',
      message: 'Access denied for security reasons',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (err instanceof FraudDetectionError && err.riskLevel === 'critical') {
    // Critical fraud risk - block with fraud-specific message
    res.status(403).json({
      error: 'TRANSACTION_BLOCKED',
      message: 'Transaction blocked for verification',
      timestamp: new Date().toISOString(),
      details: {
        contactSupport: true,
        referenceId: Math.random().toString(36).substring(2, 15)
      }
    });
    return;
  }

  // Continue with standard error handling
  next(err);
}

// Error monitoring and alerting
export async function monitorCriticalErrors(err: Error, req: Request): Promise<void> {
  const isCritical = err instanceof SecurityError ||
                    err instanceof IntrusionDetectionError ||
                    err instanceof EncryptionError ||
                    err instanceof DataIntegrityError ||
                    (err instanceof FraudDetectionError && err.riskLevel === 'critical');

  if (isCritical) {
    try {
      // Log critical error for monitoring systems
      logger.error('Critical security error detected', {
        errorType: err.name,
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL'
      });

      // Additional monitoring can be added here:
      // - Send to external monitoring services
      // - Trigger immediate alerts
      // - Notify security team
      
    } catch (monitoringError) {
      logger.error('Failed to monitor critical error', {
        originalError: err.message,
        monitoringError: monitoringError instanceof Error ? monitoringError.message : 'Unknown'
      });
    }
  }
}

// Enhanced error factory functions for fraud/security
export function createFraudError(message: string, riskLevel: 'low' | 'medium' | 'high' | 'critical'): FraudDetectionError {
  return new FraudDetectionError(message, riskLevel);
}

export function createSecurityError(message: string, context?: any): SecurityError {
  return new SecurityError(message, context);
}

export function createIntrusionError(message: string, threatLevel: number, threatTypes: string[]): IntrusionDetectionError {
  return new IntrusionDetectionError(message, threatLevel, threatTypes);
}

export function createEncryptionError(message: string, context?: any): EncryptionError {
  return new EncryptionError(message, context);
}

export function createDataIntegrityError(message: string, context?: any): DataIntegrityError {
  return new DataIntegrityError(message, context);
}

// Graceful shutdown handler with enhanced security cleanup
export function setupGracefulShutdown(server: any): void {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    try {
      // Log shutdown event for security monitoring
      await auditService.logEvent({
        event_type: 'system_event',
        user_id: null,
        user_type: 'system',
        action_performed: 'server_shutdown_initiated',
        resource_type: 'system',
        resource_id: 'server',
        event_metadata: {
          signal,
          shutdown_reason: 'graceful_shutdown',
          timestamp: new Date().toISOString()
        },
        result_status: 'success'
      });
    } catch (auditError) {
      logger.error('Failed to log shutdown event', { error: auditError });
    }
    
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions with security logging
  process.on('uncaughtException', async (err) => {
    logger.error('Uncaught exception', { error: err });
    
    try {
      await auditService.logEvent({
        event_type: 'system_event',
        user_id: null,
        user_type: 'system',
        action_performed: 'uncaught_exception',
        resource_type: 'system',
        resource_id: 'process',
        event_metadata: {
          error_name: err.name,
          error_message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        },
        result_status: 'failure'
      });
    } catch (auditError) {
      logger.error('Failed to log uncaught exception', { auditError });
    }
    
    process.exit(1);
  });

  // Handle unhandled promise rejections with security logging
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    
    try {
      await auditService.logEvent({
        event_type: 'system_event',
        user_id: null,
        user_type: 'system',
        action_performed: 'unhandled_promise_rejection',
        resource_type: 'system',
        resource_id: 'process',
        event_metadata: {
          reason: reason instanceof Error ? reason.message : String(reason),
          timestamp: new Date().toISOString()
        },
        result_status: 'failure'
      });
    } catch (auditError) {
      logger.error('Failed to log unhandled rejection', { auditError });
    }
    
    process.exit(1);
  });
}

export { logger };