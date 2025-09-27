import { Request, Response, NextFunction } from 'express';
import { AuditLoggingService } from '../../services/security/auditLoggingService';

const auditService = new AuditLoggingService();

// Extend Request interface to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        correlationId: string;
        startTime: number;
        operation: string;
        sensitiveData?: boolean;
        skipAudit?: boolean;
      };
    }
  }
}

interface AuditMiddlewareOptions {
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  sensitiveFields?: string[];
  excludeRoutes?: string[];
  auditLevel?: 'minimal' | 'standard' | 'detailed';
  logSuccessfulRequests?: boolean;
  logFailedRequests?: boolean;
  customEventType?: string;
}

/**
 * Comprehensive audit middleware for all requests
 */
export function auditMiddleware(options: AuditMiddlewareOptions = {}) {
  const {
    includeRequestBody = false,
    includeResponseBody = false,
    sensitiveFields = ['password', 'token', 'key', 'secret', 'pin'],
    excludeRoutes = ['/health', '/metrics', '/favicon.ico'],
    auditLevel = 'standard',
    logSuccessfulRequests = true,
    logFailedRequests = true,
    customEventType
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip audit logging for excluded routes
    if (excludeRoutes.some(route => req.path.includes(route))) {
      return next();
    }

    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    // Attach audit context to request
    req.auditContext = {
      correlationId,
      startTime,
      operation: `${req.method} ${req.path}`,
      sensitiveData: containsSensitiveData(req, sensitiveFields)
    };

    // Log request initiation for detailed audit level
    if (auditLevel === 'detailed') {
      await auditService.logEvent({
        event_type: customEventType as any || 'data_access',
        user_id: req.user?.id,
        user_type: getUserType(req),
        action_performed: 'request_initiated',
        resource_type: getResourceType(req.path),
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        correlation_id: correlationId,
        result_status: 'success',
        event_metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          request_body: includeRequestBody ? sanitizeData(req.body, sensitiveFields) : undefined,
          headers: sanitizeHeaders(req.headers, sensitiveFields),
          content_length: req.headers['content-length']
        }
      });
    }

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    let statusCode = 200;
    let responseBody: any;

    // Override status method
    res.status = function(code: number) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Override send method
    res.send = function(data: any) {
      responseBody = data;
      logResponseAudit();
      return originalSend.call(this, data);
    };

    // Override json method
    res.json = function(data: any) {
      responseBody = data;
      logResponseAudit();
      return originalJson.call(this, data);
    };

    // Function to log response audit
    const logResponseAudit = async () => {
      try {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const isSuccess = statusCode < 400;
        const isError = statusCode >= 400;

        // Skip logging based on success/failure preferences
        if (!logSuccessfulRequests && isSuccess) return;
        if (!logFailedRequests && isError) return;

        const eventType = determineEventType(req, statusCode, customEventType);
        const resultStatus = determineResultStatus(statusCode);
        const actionPerformed = determineActionPerformed(req, statusCode);

        await auditService.logEvent({
          event_type: eventType,
          user_id: req.user?.id,
          user_type: getUserType(req),
          action_performed: actionPerformed,
          resource_type: getResourceType(req.path),
          resource_id: extractResourceId(req, responseBody),
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          correlation_id: correlationId,
          result_status: resultStatus,
          event_metadata: {
            method: req.method,
            path: req.path,
            status_code: statusCode,
            duration_ms: duration,
            query: auditLevel === 'detailed' ? req.query : undefined,
            request_body: (includeRequestBody && auditLevel !== 'minimal') 
              ? sanitizeData(req.body, sensitiveFields) 
              : undefined,
            response_body: (includeResponseBody && auditLevel === 'detailed') 
              ? sanitizeData(responseBody, sensitiveFields) 
              : undefined,
            sensitive_data_present: req.auditContext?.sensitiveData,
            response_size: JSON.stringify(responseBody || '').length,
            referrer: req.headers.referer,
            session_id: extractSessionId(req)
          }
        });

        // Log additional security events for sensitive operations
        if (req.auditContext?.sensitiveData || isAdminOperation(req)) {
          await auditService.logEvent({
            event_type: 'security_violation',
            user_id: req.user?.id,
            user_type: getUserType(req),
            action_performed: 'sensitive_data_access',
            resource_type: getResourceType(req.path),
            ip_address: req.ip,
            correlation_id: correlationId,
            result_status: resultStatus,
            event_metadata: {
              operation: req.auditContext.operation,
              admin_operation: isAdminOperation(req),
              sensitive_fields_accessed: identifySensitiveFields(req.body, sensitiveFields)
            }
          });
        }

        // Log failed authentication attempts specifically
        if (statusCode === 401 || statusCode === 403) {
          await auditService.logEvent({
            event_type: 'authentication',
            user_id: req.user?.id,
            user_type: getUserType(req),
            action_performed: statusCode === 401 ? 'authentication_failed' : 'authorization_failed',
            ip_address: req.ip,
            correlation_id: correlationId,
            result_status: 'failure',
            event_metadata: {
              attempted_resource: req.path,
              auth_method: req.headers.authorization ? 'bearer_token' : 'session',
              failure_reason: statusCode === 401 ? 'invalid_credentials' : 'insufficient_privileges'
            }
          });
        }
      } catch (error) {
        console.error('Audit logging error:', error);
        // Don't throw - audit failures shouldn't break requests
      }
    };

    next();
  };
}

/**
 * Specialized audit middleware for admin operations
 */
export function adminAuditMiddleware() {
  return auditMiddleware({
    includeRequestBody: true,
    includeResponseBody: false,
    auditLevel: 'detailed',
    customEventType: 'admin_action',
    logSuccessfulRequests: true,
    logFailedRequests: true,
    sensitiveFields: ['password', 'token', 'key', 'secret', 'pin', 'admin_key']
  });
}

/**
 * Specialized audit middleware for data modifications
 */
export function dataModificationAuditMiddleware() {
  return auditMiddleware({
    includeRequestBody: true,
    includeResponseBody: false,
    auditLevel: 'detailed',
    customEventType: 'data_modification',
    logSuccessfulRequests: true,
    logFailedRequests: true
  });
}

/**
 * Lightweight audit middleware for high-volume endpoints
 */
export function lightweightAuditMiddleware() {
  return auditMiddleware({
    includeRequestBody: false,
    includeResponseBody: false,
    auditLevel: 'minimal',
    logSuccessfulRequests: false,
    logFailedRequests: true
  });
}

/**
 * Audit middleware for security-sensitive operations
 */
export function securityAuditMiddleware() {
  return auditMiddleware({
    includeRequestBody: true,
    includeResponseBody: true,
    auditLevel: 'detailed',
    customEventType: 'security_violation',
    logSuccessfulRequests: true,
    logFailedRequests: true,
    sensitiveFields: ['password', 'token', 'key', 'secret', 'pin', 'otp', 'hash']
  });
}

// Helper functions

function containsSensitiveData(req: Request, sensitiveFields: string[]): boolean {
  const dataToCheck = { ...req.body, ...req.query };
  return Object.keys(dataToCheck).some(key => 
    sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
  );
}

function getUserType(req: Request): 'customer' | 'business' | 'admin' | 'system' {
  if (!req.user) return 'system';
  if (req.path.includes('/admin/')) return 'admin';
  if (req.path.includes('/business/')) return 'business';
  return 'customer';
}

function getResourceType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2) {
    return segments[1]; // e.g., /api/users -> users
  }
  return 'unknown';
}

function determineEventType(req: Request, statusCode: number, customEventType?: string): any {
  if (customEventType) return customEventType;
  
  if (statusCode >= 400) return 'security_violation';
  if (req.method === 'GET') return 'data_access';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return 'data_modification';
  if (req.path.includes('/auth/')) return 'authentication';
  if (req.path.includes('/admin/')) return 'admin_action';
  
  return 'system_event';
}

function determineResultStatus(statusCode: number): 'success' | 'failure' | 'blocked' | 'warning' {
  if (statusCode < 300) return 'success';
  if (statusCode === 403) return 'blocked';
  if (statusCode >= 400 && statusCode < 500) return 'failure';
  if (statusCode >= 500) return 'failure';
  return 'warning';
}

function determineActionPerformed(req: Request, statusCode: number): string {
  const method = req.method.toLowerCase();
  const resource = getResourceType(req.path);
  const status = statusCode >= 400 ? 'failed' : 'completed';
  
  const actionMap: Record<string, string> = {
    'get': `view_${resource}`,
    'post': `create_${resource}`,
    'put': `update_${resource}`,
    'patch': `modify_${resource}`,
    'delete': `delete_${resource}`
  };
  
  const baseAction = actionMap[method] || `${method}_${resource}`;
  return statusCode >= 400 ? `${baseAction}_${status}` : baseAction;
}

function extractResourceId(req: Request, responseBody: any): string | undefined {
  // Try to extract ID from URL parameters
  const pathSegments = req.path.split('/');
  const possibleId = pathSegments[pathSegments.length - 1];
  
  if (possibleId && /^[a-f0-9\-]{36}$/.test(possibleId)) {
    return possibleId; // UUID format
  }
  
  if (possibleId && /^\d+$/.test(possibleId)) {
    return possibleId; // Numeric ID
  }
  
  // Try to extract from response body
  if (responseBody && typeof responseBody === 'object') {
    return responseBody.id || responseBody.data?.id;
  }
  
  // Try to extract from request body
  if (req.body && typeof req.body === 'object') {
    return req.body.id;
  }
  
  return undefined;
}

function extractSessionId(req: Request): string | undefined {
  return req.headers['x-session-id'] as string || 
         req.cookies?.sessionId ||
         req.session?.id;
}

function sanitizeData(data: any, sensitiveFields: string[]): any {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key], sensitiveFields);
    }
  }
  
  return sanitized;
}

function sanitizeHeaders(headers: any, sensitiveFields: string[]): any {
  const sanitized = { ...headers };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase())) ||
        key.toLowerCase().includes('authorization') ||
        key.toLowerCase().includes('cookie')) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function isAdminOperation(req: Request): boolean {
  return req.path.includes('/admin/') || 
         req.path.includes('/api/admin/') ||
         req.headers['x-admin-operation'] === 'true';
}

function identifySensitiveFields(data: any, sensitiveFields: string[]): string[] {
  if (!data || typeof data !== 'object') return [];
  
  const foundFields: string[] = [];
  
  for (const key in data) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      foundFields.push(key);
    }
  }
  
  return foundFields;
}

// Export pre-configured middleware instances
export const standardAudit = auditMiddleware();
export const adminAudit = adminAuditMiddleware();
export const dataModificationAudit = dataModificationAuditMiddleware();
export const lightweightAudit = lightweightAuditMiddleware();
export const securityAudit = securityAuditMiddleware();