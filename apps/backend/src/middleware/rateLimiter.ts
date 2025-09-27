import { Request, Response, NextFunction } from 'express';
import { IntrusionDetectionService } from '../services/security/intrusionDetectionService';
import { AuditLoggingService } from '../services/security/auditLoggingService';

const intrusionService = new IntrusionDetectionService();
const auditService = new AuditLoggingService();

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  message?: string;  // Custom error message
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;  // Don't count failed requests
  enableIntrusionDetection?: boolean;  // Log violations as security events
  enableProgressiveBlocking?: boolean;  // Escalate blocks for repeated violations
  securityThreshold?: number;  // Threshold for security alerts (default: 80% of limit)
}

interface ClientSecurityInfo {
  violationCount: number;
  lastViolation: number;
  blockUntil?: number;
  escalationLevel: number;  // 0-3: normal, warning, suspicious, blocked
}

interface RequestInfo {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for production clusters)
const requestCounts = new Map<string, RequestInfo>();
const clientSecurityInfo = new Map<string, ClientSecurityInfo>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of requestCounts.entries()) {
    if (now > info.resetTime) {
      requestCounts.delete(key);
    }
  }
  
  // Clean up expired security info (keep violations for 24 hours)
  for (const [key, secInfo] of clientSecurityInfo.entries()) {
    if (secInfo.blockUntil && now > secInfo.blockUntil && 
        now > secInfo.lastViolation + (24 * 60 * 60 * 1000)) {
      clientSecurityInfo.delete(key);
    }
  }
}, 5 * 60 * 1000);

function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const key = getClientKey(req);
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check if client is currently blocked due to security escalation
    const securityInfo = clientSecurityInfo.get(key);
    if (securityInfo?.blockUntil && now < securityInfo.blockUntil) {
      const blockRemaining = Math.ceil((securityInfo.blockUntil - now) / 1000);
      
      // Log continued attempt during block period
      if (config.enableIntrusionDetection) {
        await intrusionService.createIntrusionEvent({
          event_type: 'rate_limit_violation',
          source_ip: clientIP,
          target_resource: req.path,
          attack_pattern: `Continued requests during block period (${securityInfo.escalationLevel})`,
          severity_level: Math.min(securityInfo.escalationLevel + 2, 10),
          detection_method: 'rate_limiter_progressive_blocking',
          automated_response: {
            action: 'extended_block',
            block_duration_seconds: blockRemaining,
            escalation_level: securityInfo.escalationLevel
          }
        });
      }
      
      res.status(429).json({
        error: 'SECURITY_BLOCK',
        message: 'Access temporarily restricted due to security policy violations',
        details: {
          blockRemaining: blockRemaining,
          escalationLevel: securityInfo.escalationLevel,
        },
      });
      return;
    }
    
    // Get or create request info for this client
    let requestInfo = requestCounts.get(key);
    
    if (!requestInfo || now > requestInfo.resetTime) {
      // Create new window
      requestInfo = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      requestCounts.set(key, requestInfo);
    }
    
    // Increment request count
    requestInfo.count++;
    
    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - requestInfo.count);
    const resetTime = Math.ceil(requestInfo.resetTime / 1000);
    
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Window': config.windowMs.toString(),
    });
    
    // Security threshold check (warn at 80% of limit by default)
    const securityThreshold = config.securityThreshold || Math.floor(config.maxRequests * 0.8);
    if (config.enableIntrusionDetection && requestInfo.count >= securityThreshold && requestInfo.count <= config.maxRequests) {
      await auditService.logEvent({
        event_type: 'security_violation',
        user_id: req.user?.id || null,
        user_type: req.user?.role || 'anonymous',
        action_performed: 'rate_limit_threshold_exceeded',
        resource_type: 'api_endpoint',
        resource_id: req.path,
        ip_address: clientIP,
        user_agent: req.get('User-Agent'),
        event_metadata: {
          current_count: requestInfo.count,
          limit: config.maxRequests,
          threshold: securityThreshold,
          window_ms: config.windowMs,
          remaining_in_window: Math.ceil((requestInfo.resetTime - now) / 1000)
        },
        result_status: 'warning'
      });
    }
    
    // Check if limit exceeded
    if (requestInfo.count > config.maxRequests) {
      const retryAfter = Math.ceil((requestInfo.resetTime - now) / 1000);
      
      // Handle progressive blocking and security escalation
      let escalationResult;
      if (config.enableProgressiveBlocking || config.enableIntrusionDetection) {
        escalationResult = await handleSecurityEscalation(key, clientIP, req, config);
      }
      
      // Log rate limit violation
      if (config.enableIntrusionDetection) {
        await Promise.all([
          intrusionService.createIntrusionEvent({
            event_type: 'rate_limit_violation',
            source_ip: clientIP,
            target_resource: req.path,
            attack_pattern: `Exceeded rate limit: ${requestInfo.count}/${config.maxRequests} requests`,
            severity_level: escalationResult?.escalationLevel || 4,
            detection_method: 'rate_limiter',
            automated_response: {
              action: escalationResult ? 'progressive_block' : 'temporary_block',
              block_duration_seconds: escalationResult?.blockDuration || retryAfter,
              escalation_level: escalationResult?.escalationLevel || 0
            }
          }),
          auditService.logEvent({
            event_type: 'security_violation',
            user_id: req.user?.id || null,
            user_type: req.user?.role || 'anonymous',
            action_performed: 'rate_limit_exceeded',
            resource_type: 'api_endpoint',
            resource_id: req.path,
            ip_address: clientIP,
            user_agent: req.get('User-Agent'),
            event_metadata: {
              requests_count: requestInfo.count,
              limit: config.maxRequests,
              violations_count: escalationResult?.violationCount || 1,
              escalation_level: escalationResult?.escalationLevel || 0,
              block_duration: escalationResult?.blockDuration || retryAfter
            },
            result_status: 'blocked'
          })
        ]);
      }
      
      res.set({
        'Retry-After': (escalationResult?.blockDuration || retryAfter).toString(),
      });
      
      const responseData: any = {
        error: 'RATE_LIMITED',
        message: config.message || 'Too many requests, please try again later',
        details: {
          limit: config.maxRequests,
          window: config.windowMs,
          retryAfter: escalationResult?.blockDuration || retryAfter,
        },
      };
      
      if (escalationResult) {
        responseData.details.escalationLevel = escalationResult.escalationLevel;
        responseData.details.violationCount = escalationResult.violationCount;
        if (escalationResult.escalationLevel >= 2) {
          responseData.error = 'SECURITY_ESCALATION';
          responseData.message = 'Repeated rate limit violations detected. Access restricted.';
        }
      }
      
      res.status(429).json(responseData);
      return;
    }
    
    next();
  };
}

// Handle progressive security escalation for repeat offenders
async function handleSecurityEscalation(
  clientKey: string, 
  clientIP: string, 
  req: Request, 
  config: RateLimitConfig
) {
  const now = Date.now();
  let secInfo = clientSecurityInfo.get(clientKey);
  
  if (!secInfo) {
    secInfo = {
      violationCount: 0,
      lastViolation: now,
      escalationLevel: 0
    };
    clientSecurityInfo.set(clientKey, secInfo);
  }
  
  // Update violation info
  secInfo.violationCount++;
  secInfo.lastViolation = now;
  
  // Determine escalation level based on violation count and frequency
  const timeSinceLastViolation = now - secInfo.lastViolation;
  const hoursSinceLastViolation = timeSinceLastViolation / (1000 * 60 * 60);
  
  // Escalate if violations are frequent (within 6 hours)
  if (hoursSinceLastViolation < 6) {
    if (secInfo.violationCount >= 5) {
      secInfo.escalationLevel = 3; // Blocked
    } else if (secInfo.violationCount >= 3) {
      secInfo.escalationLevel = 2; // Suspicious
    } else if (secInfo.violationCount >= 2) {
      secInfo.escalationLevel = 1; // Warning
    }
  }
  
  // Calculate progressive block duration
  let blockDuration = Math.ceil((config.windowMs / 1000)); // Base window duration
  
  switch (secInfo.escalationLevel) {
    case 1: // Warning - normal retry after
      blockDuration = Math.ceil(config.windowMs / 1000);
      break;
    case 2: // Suspicious - double the wait
      blockDuration = Math.ceil(config.windowMs / 1000) * 2;
      secInfo.blockUntil = now + (blockDuration * 1000);
      break;
    case 3: // Blocked - significant delay
      blockDuration = Math.ceil(config.windowMs / 1000) * 5;
      secInfo.blockUntil = now + (blockDuration * 1000);
      break;
  }
  
  return {
    escalationLevel: secInfo.escalationLevel,
    violationCount: secInfo.violationCount,
    blockDuration: blockDuration
  };
}

// Generate client key for rate limiting (IP + User ID if authenticated)
function getClientKey(req: Request): string {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.user?.id;
  
  if (userId) {
    return `user:${userId}`;
  }
  
  return `ip:${ip}`;
}

// Different rate limiters for different endpoints

// General API rate limiter (100 requests per 15 minutes)
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many API requests, please try again later',
  enableIntrusionDetection: true,
  enableProgressiveBlocking: true,
  securityThreshold: 80 // Alert at 80 requests
});

// Authentication rate limiter (5 login attempts per 15 minutes) - Very strict
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later',
  enableIntrusionDetection: true,
  enableProgressiveBlocking: true,
  securityThreshold: 3 // Alert at 3 attempts (60% of limit)
});

// Strict rate limiter for sensitive operations (10 requests per hour)
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Rate limit exceeded for sensitive operations',
  enableIntrusionDetection: true,
  enableProgressiveBlocking: true,
  securityThreshold: 7 // Alert at 7 requests
});

// Permissive rate limiter for health checks (1000 requests per minute) - Monitoring only
export const healthCheckRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,
  message: 'Health check rate limit exceeded',
  enableIntrusionDetection: false, // No intrusion detection for health checks
  enableProgressiveBlocking: false,
  securityThreshold: 900
});

// Fraud detection rate limiter - Special handling for fraud analysis endpoints
export const fraudDetectionRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 50,
  message: 'Fraud detection rate limit exceeded',
  enableIntrusionDetection: true,
  enableProgressiveBlocking: true,
  securityThreshold: 35 // Alert at 35 requests (70% of limit)
});

// Security monitoring rate limiter - For security-related endpoints
export const securityMonitoringRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 25,
  message: 'Security monitoring rate limit exceeded',
  enableIntrusionDetection: true,
  enableProgressiveBlocking: true,
  securityThreshold: 20 // Alert at 20 requests (80% of limit)
});

// Default rate limiter middleware with enhanced routing
export const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Apply different rate limits based on endpoint
  const path = req.path;
  const method = req.method;
  
  // Health checks - most permissive
  if (path.startsWith('/health') || path.startsWith('/api/health')) {
    return healthCheckRateLimiter(req, res, next);
  }
  
  // Authentication endpoints - very strict
  if (path.startsWith('/auth/login') || path.startsWith('/auth/refresh') || 
      path.startsWith('/api/auth/login') || path.startsWith('/api/auth/refresh')) {
    return authRateLimiter(req, res, next);
  }
  
  // Fraud detection endpoints - specialized rate limiting
  if (path.startsWith('/api/fraud/')) {
    return fraudDetectionRateLimiter(req, res, next);
  }
  
  // Security endpoints - specialized rate limiting
  if (path.startsWith('/api/security/')) {
    return securityMonitoringRateLimiter(req, res, next);
  }
  
  // Admin endpoints with destructive operations - strict
  if (path.startsWith('/api/admin/') && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    return strictRateLimiter(req, res, next);
  }
  
  // Business operations (create/delete) - strict
  if (path.includes('/businesses') && (method === 'POST' || method === 'DELETE')) {
    return strictRateLimiter(req, res, next);
  }
  
  // Store management operations - strict
  if (path.includes('/stores') && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    return strictRateLimiter(req, res, next);
  }
  
  // Default general rate limiter for all other endpoints
  return generalRateLimiter(req, res, next);
};

// Custom rate limiter factory for specific needs
export function customRateLimiter(
  windowMs: number,
  maxRequests: number,
  message?: string
) {
  return createRateLimiter({
    windowMs,
    maxRequests,
    message: message || 'Rate limit exceeded',
  });
}

// Rate limiter for development (very permissive)
export const developmentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,
  message: 'Development rate limit exceeded (very permissive)',
  enableIntrusionDetection: false, // Disable security features in development
  enableProgressiveBlocking: false,
  securityThreshold: 900
});

// Enhanced rate limiter with custom security options
export function createSecurityAwareRateLimiter(
  windowMs: number,
  maxRequests: number,
  options: {
    message?: string;
    enableSecurity?: boolean;
    escalationThreshold?: number;
    blockMultiplier?: number;
  } = {}
) {
  const {
    message = 'Rate limit exceeded',
    enableSecurity = true,
    escalationThreshold = Math.floor(maxRequests * 0.8),
    blockMultiplier = 2
  } = options;

  return createRateLimiter({
    windowMs,
    maxRequests,
    message,
    enableIntrusionDetection: enableSecurity,
    enableProgressiveBlocking: enableSecurity,
    securityThreshold: escalationThreshold
  });
}

// Environment-aware rate limiter
export const getEnvironmentRateLimiter = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development' || env === 'test') {
    console.log('Rate Limiter: Using development configuration (very permissive)');
    return developmentRateLimiter;
  }
  
  console.log('Rate Limiter: Using production configuration');
  return rateLimiterMiddleware;
};

// Utility functions for rate limiter management and monitoring

// Get current rate limit status for a client
export function getRateLimitStatus(req: Request): {
  requestCount: number;
  limit: number;
  remaining: number;
  resetTime: number;
  securityInfo?: ClientSecurityInfo;
} {
  const key = getClientKey(req);
  const requestInfo = requestCounts.get(key);
  const securityInfo = clientSecurityInfo.get(key);
  
  if (!requestInfo) {
    return {
      requestCount: 0,
      limit: 100, // Default general limit
      remaining: 100,
      resetTime: Date.now() + (15 * 60 * 1000), // Default 15 min window
      securityInfo
    };
  }
  
  const remaining = Math.max(0, 100 - requestInfo.count);
  
  return {
    requestCount: requestInfo.count,
    limit: 100,
    remaining,
    resetTime: requestInfo.resetTime,
    securityInfo
  };
}

// Clear rate limit for a specific client (admin function)
export function clearRateLimit(clientKey: string): boolean {
  const hadRequestInfo = requestCounts.has(clientKey);
  const hadSecurityInfo = clientSecurityInfo.has(clientKey);
  
  requestCounts.delete(clientKey);
  clientSecurityInfo.delete(clientKey);
  
  return hadRequestInfo || hadSecurityInfo;
}

// Get rate limiter statistics
export function getRateLimiterStats(): {
  activeClients: number;
  blockedClients: number;
  totalRequests: number;
  securityViolations: number;
  escalatedClients: number;
} {
  const now = Date.now();
  let totalRequests = 0;
  let securityViolations = 0;
  let escalatedClients = 0;
  let blockedClients = 0;
  
  // Count active request info
  for (const info of requestCounts.values()) {
    totalRequests += info.count;
  }
  
  // Count security violations and escalations
  for (const secInfo of clientSecurityInfo.values()) {
    securityViolations += secInfo.violationCount;
    if (secInfo.escalationLevel > 0) {
      escalatedClients++;
    }
    if (secInfo.blockUntil && now < secInfo.blockUntil) {
      blockedClients++;
    }
  }
  
  return {
    activeClients: requestCounts.size,
    blockedClients,
    totalRequests,
    securityViolations,
    escalatedClients
  };
}

// Reset all rate limits (emergency function - use with caution)
export function resetAllRateLimits(): void {
  requestCounts.clear();
  clientSecurityInfo.clear();
}

// Check if a client is currently blocked
export function isClientBlocked(req: Request): boolean {
  const key = getClientKey(req);
  const securityInfo = clientSecurityInfo.get(key);
  
  if (!securityInfo?.blockUntil) {
    return false;
  }
  
  return Date.now() < securityInfo.blockUntil;
}

// Get blocked clients list (for monitoring dashboard)
export function getBlockedClients(): Array<{
  clientKey: string;
  blockedUntil: number;
  escalationLevel: number;
  violationCount: number;
}> {
  const now = Date.now();
  const blocked: Array<{
    clientKey: string;
    blockedUntil: number;
    escalationLevel: number;
    violationCount: number;
  }> = [];
  
  for (const [key, secInfo] of clientSecurityInfo.entries()) {
    if (secInfo.blockUntil && now < secInfo.blockUntil) {
      blocked.push({
        clientKey: key,
        blockedUntil: secInfo.blockUntil,
        escalationLevel: secInfo.escalationLevel,
        violationCount: secInfo.violationCount
      });
    }
  }
  
  return blocked;
}

export default getEnvironmentRateLimiter();