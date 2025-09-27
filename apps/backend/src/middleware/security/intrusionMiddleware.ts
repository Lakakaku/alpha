import { Request, Response, NextFunction } from 'express';
import { IntrusionDetectionService } from '../../services/security/intrusionDetectionService';
import { AuditLoggingService } from '../../services/security/auditLoggingService';

const intrusionService = new IntrusionDetectionService();
const auditService = new AuditLoggingService();

// Extend Request interface to include intrusion analysis
declare global {
  namespace Express {
    interface Request {
      intrusionAnalysis?: {
        threatLevel: number;
        detectedThreats: string[];
        shouldBlock: boolean;
        riskScore: number;
        analysisId: string;
        blockingReasons: string[];
      };
    }
  }
}

interface IntrusionDetectionOptions {
  enableBlocking?: boolean;
  threatThreshold?: number;
  exemptIPs?: string[];
  exemptUserAgents?: string[];
  enableRealTimeBlocking?: boolean;
  logAllAnalyses?: boolean;
  customThreatHandlers?: Record<string, (req: Request, threatData: any) => Promise<boolean>>;
  blockDuration?: number; // in seconds
}

/**
 * Main intrusion detection middleware
 */
export function intrusionDetectionMiddleware(options: IntrusionDetectionOptions = {}) {
  const {
    enableBlocking = true,
    threatThreshold = 7,
    exemptIPs = [],
    exemptUserAgents = [],
    enableRealTimeBlocking = true,
    logAllAnalyses = false,
    customThreatHandlers = {},
    blockDuration = 3600
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip analysis for exempt IPs
      if (exemptIPs.includes(req.ip)) {
        return next();
      }

      // Skip analysis for exempt user agents
      if (exemptUserAgents.some(ua => req.headers['user-agent']?.includes(ua))) {
        return next();
      }

      const correlationId = crypto.randomUUID();
      const startTime = Date.now();

      // Check if IP is already blocked
      const blockingStatus = await intrusionService.getBlockingStatus(req.ip);
      if (blockingStatus.isBlocked && enableBlocking) {
        await auditService.logEvent({
          event_type: 'security_violation',
          action_performed: 'blocked_ip_access_attempt',
          resource_type: 'intrusion_detection',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          correlation_id: correlationId,
          result_status: 'blocked',
          event_metadata: {
            path: req.path,
            method: req.method,
            block_reason: blockingStatus.blockReason,
            remaining_block_time: blockingStatus.remainingBlockTime
          }
        });

        return res.status(403).json({
          success: false,
          error: 'Access temporarily restricted',
          details: {
            reason: 'security_block',
            retryAfter: blockingStatus.remainingBlockTime
          }
        });
      }

      // Perform intrusion analysis
      const analysisResult = await intrusionService.analyzeRequest(req, {
        success: true, // Will be updated based on response
        timestamp: new Date(),
        correlationId
      });

      const analysisTime = Date.now() - startTime;

      // Attach analysis results to request
      req.intrusionAnalysis = {
        threatLevel: analysisResult.threatLevel,
        detectedThreats: analysisResult.detectedThreats,
        shouldBlock: analysisResult.shouldBlock,
        riskScore: analysisResult.riskScore,
        analysisId: analysisResult.analysisId,
        blockingReasons: analysisResult.blockingReasons || []
      };

      // Log analysis if required
      if (logAllAnalyses || analysisResult.threatLevel >= threatThreshold) {
        await auditService.logEvent({
          event_type: 'security_violation',
          user_id: req.user?.id,
          user_type: req.user ? 'customer' : 'system',
          action_performed: 'intrusion_analysis_completed',
          resource_type: 'intrusion_detection',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          correlation_id: correlationId,
          result_status: analysisResult.shouldBlock ? 'blocked' : 'warning',
          event_metadata: {
            threat_level: analysisResult.threatLevel,
            detected_threats: analysisResult.detectedThreats,
            risk_score: analysisResult.riskScore,
            analysis_time_ms: analysisTime,
            path: req.path,
            method: req.method,
            query_params: req.query,
            suspicious_patterns: analysisResult.suspiciousPatterns
          }
        });
      }

      // Handle custom threat handlers
      for (const [threatType, handler] of Object.entries(customThreatHandlers)) {
        if (analysisResult.detectedThreats.includes(threatType)) {
          const customResult = await handler(req, analysisResult);
          if (customResult) {
            req.intrusionAnalysis.shouldBlock = true;
            req.intrusionAnalysis.blockingReasons.push(`custom_handler_${threatType}`);
          }
        }
      }

      // Block request if threat level is high
      if (enableBlocking && analysisResult.shouldBlock) {
        // Create intrusion event
        await intrusionService.createIntrusionEvent({
          event_type: determinePrimaryThreatType(analysisResult.detectedThreats),
          source_ip: req.ip,
          target_resource: req.path,
          attack_pattern: analysisResult.attackSignature,
          severity_level: Math.min(10, Math.max(1, analysisResult.threatLevel)),
          detection_method: 'middleware_analysis',
          automated_response: {
            actions: ['immediate_block', 'audit_log'],
            block_duration: blockDuration,
            escalation_triggered: analysisResult.threatLevel >= 9
          },
          admin_notified: analysisResult.threatLevel >= 8
        });

        // Apply real-time blocking if enabled
        if (enableRealTimeBlocking) {
          await intrusionService.applyRealTimeBlock(req.ip, {
            duration: blockDuration,
            reason: req.intrusionAnalysis.blockingReasons.join(', '),
            threatLevel: analysisResult.threatLevel
          });
        }

        // Log the blocking action
        await auditService.logEvent({
          event_type: 'security_violation',
          user_id: req.user?.id,
          action_performed: 'request_blocked_by_intrusion_detection',
          resource_type: 'intrusion_detection',
          ip_address: req.ip,
          correlation_id: correlationId,
          result_status: 'blocked',
          event_metadata: {
            threat_level: analysisResult.threatLevel,
            detected_threats: analysisResult.detectedThreats,
            blocking_reasons: req.intrusionAnalysis.blockingReasons,
            block_duration: blockDuration
          }
        });

        return res.status(403).json({
          success: false,
          error: 'Request blocked due to security concerns',
          details: {
            reason: 'intrusion_detected',
            threatLevel: analysisResult.threatLevel,
            analysisId: analysisResult.analysisId,
            retryAfter: blockDuration
          }
        });
      }

      // Add security headers for suspicious requests
      if (analysisResult.threatLevel >= 5) {
        res.setHeader('X-Security-Threat-Level', analysisResult.threatLevel.toString());
        res.setHeader('X-Intrusion-Analysis-Id', analysisResult.analysisId);
        res.setHeader('X-Security-Warning', 'Request flagged for security review');
      }

      // Hook into response to update analysis results
      const originalSend = res.send;
      res.send = function(data: any) {
        // Update analysis with response success/failure
        setImmediate(async () => {
          try {
            await intrusionService.updateAnalysisResult(analysisResult.analysisId, {
              success: res.statusCode < 400,
              responseCode: res.statusCode,
              completedAt: new Date()
            });
          } catch (error) {
            console.error('Error updating intrusion analysis:', error);
          }
        });
        
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Intrusion detection middleware error:', error);

      // Log the error
      await auditService.logEvent({
        event_type: 'system_event',
        action_performed: 'intrusion_detection_error',
        resource_type: 'intrusion_detection_middleware',
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method
        }
      });

      // Continue processing - don't let intrusion detection errors break the request
      next();
    }
  };
}

/**
 * SQL Injection specific detection middleware
 */
export function sqlInjectionDetection() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
        /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
        /(\'|\")(\s*)(;|--|\*|\/\*)/i,
        /(\bSCHEMA\b|\bTABLE\b|\bCOLUMN\b)/i
      ];

      const checkData = {
        ...req.query,
        ...req.body,
        ...req.params
      };

      const suspiciousInputs = [];
      
      for (const [key, value] of Object.entries(checkData)) {
        if (typeof value === 'string') {
          for (const pattern of sqlPatterns) {
            if (pattern.test(value)) {
              suspiciousInputs.push({ field: key, pattern: pattern.source, value });
            }
          }
        }
      }

      if (suspiciousInputs.length > 0) {
        await auditService.logEvent({
          event_type: 'security_violation',
          user_id: req.user?.id,
          action_performed: 'sql_injection_attempt_detected',
          resource_type: 'sql_injection_detection',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          result_status: 'blocked',
          event_metadata: {
            suspicious_inputs: suspiciousInputs,
            path: req.path,
            method: req.method
          }
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: {
            reason: 'security_validation_failed'
          }
        });
      }

      next();
    } catch (error) {
      console.error('SQL injection detection error:', error);
      next(); // Continue on error
    }
  };
}

/**
 * Brute force detection middleware
 */
export function bruteForceDetection(options: { 
  maxAttempts?: number;
  windowMs?: number;
  blockDurationMs?: number;
} = {}) {
  const { maxAttempts = 5, windowMs = 15 * 60 * 1000, blockDurationMs = 30 * 60 * 1000 } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${req.ip}:${req.path}`;
      
      const attemptCount = await intrusionService.getAttemptCount(key, windowMs);
      
      if (attemptCount >= maxAttempts) {
        await intrusionService.createIntrusionEvent({
          event_type: 'brute_force',
          source_ip: req.ip,
          target_resource: req.path,
          severity_level: 8,
          detection_method: 'rate_limiting_pattern',
          automated_response: {
            actions: ['temporary_block'],
            block_duration: blockDurationMs / 1000
          }
        });

        await auditService.logEvent({
          event_type: 'security_violation',
          user_id: req.user?.id,
          action_performed: 'brute_force_detected',
          resource_type: 'brute_force_detection',
          ip_address: req.ip,
          result_status: 'blocked',
          event_metadata: {
            attempt_count: attemptCount,
            max_attempts: maxAttempts,
            window_ms: windowMs,
            path: req.path
          }
        });

        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          details: {
            reason: 'brute_force_detected',
            retryAfter: Math.ceil(blockDurationMs / 1000)
          }
        });
      }

      // Record this attempt
      await intrusionService.recordAttempt(key, windowMs);

      next();
    } catch (error) {
      console.error('Brute force detection error:', error);
      next(); // Continue on error
    }
  };
}

/**
 * Geographic restriction middleware
 */
export function geographicRestriction(options: {
  allowedCountries?: string[];
  blockedCountries?: string[];
  allowedRegions?: string[];
  blockedRegions?: string[];
} = {}) {
  const { allowedCountries = [], blockedCountries = [], allowedRegions = [], blockedRegions = [] } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const geoInfo = await intrusionService.getGeoLocation(req.ip);
      
      if (!geoInfo) {
        return next(); // Continue if geo info unavailable
      }

      let isBlocked = false;
      let blockReason = '';

      // Check country restrictions
      if (blockedCountries.length > 0 && blockedCountries.includes(geoInfo.country)) {
        isBlocked = true;
        blockReason = `Country ${geoInfo.country} is blocked`;
      }

      if (allowedCountries.length > 0 && !allowedCountries.includes(geoInfo.country)) {
        isBlocked = true;
        blockReason = `Country ${geoInfo.country} is not in allowed list`;
      }

      // Check region restrictions
      if (blockedRegions.length > 0 && blockedRegions.includes(geoInfo.region)) {
        isBlocked = true;
        blockReason = `Region ${geoInfo.region} is blocked`;
      }

      if (allowedRegions.length > 0 && !allowedRegions.includes(geoInfo.region)) {
        isBlocked = true;
        blockReason = `Region ${geoInfo.region} is not in allowed list`;
      }

      if (isBlocked) {
        await auditService.logEvent({
          event_type: 'security_violation',
          user_id: req.user?.id,
          action_performed: 'geographic_restriction_violation',
          resource_type: 'geographic_restriction',
          ip_address: req.ip,
          result_status: 'blocked',
          event_metadata: {
            country: geoInfo.country,
            region: geoInfo.region,
            city: geoInfo.city,
            block_reason: blockReason,
            path: req.path
          }
        });

        return res.status(403).json({
          success: false,
          error: 'Access not permitted from your location',
          details: {
            reason: 'geographic_restriction'
          }
        });
      }

      // Add geo info to request for other middleware
      req.geoInfo = geoInfo;
      
      next();
    } catch (error) {
      console.error('Geographic restriction error:', error);
      next(); // Continue on error
    }
  };
}

// Helper functions

function determinePrimaryThreatType(threats: string[]): any {
  const threatPriority: Record<string, any> = {
    'sql_injection': 'sql_injection',
    'brute_force': 'brute_force',
    'privilege_escalation': 'privilege_escalation',
    'data_exfiltration': 'data_exfiltration',
    'rate_limit_violation': 'rate_limit_violation',
    'authentication_bypass': 'authentication_bypass',
    'unusual_access': 'unusual_access'
  };

  for (const threat of threats) {
    if (threatPriority[threat]) {
      return threatPriority[threat];
    }
  }

  return 'unusual_access'; // Default
}

// Export pre-configured middleware instances
export const standardIntrusionDetection = intrusionDetectionMiddleware({
  enableBlocking: true,
  threatThreshold: 7,
  enableRealTimeBlocking: true,
  logAllAnalyses: false,
  blockDuration: 3600
});

export const strictIntrusionDetection = intrusionDetectionMiddleware({
  enableBlocking: true,
  threatThreshold: 5,
  enableRealTimeBlocking: true,
  logAllAnalyses: true,
  blockDuration: 7200
});

export const monitoringOnlyIntrusionDetection = intrusionDetectionMiddleware({
  enableBlocking: false,
  threatThreshold: 3,
  enableRealTimeBlocking: false,
  logAllAnalyses: true,
  blockDuration: 0
});

// Export individual detection middleware
export const sqlInjection = sqlInjectionDetection();
export const bruteForce = bruteForceDetection();
export const geoRestriction = geographicRestriction();