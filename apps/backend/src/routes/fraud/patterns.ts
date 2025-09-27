/**
 * Fraud Patterns API Routes
 * Task: T050 - GET /api/fraud/patterns/{phone_hash} endpoint
 * 
 * Provides behavioral pattern analysis for phone numbers to detect fraudulent calling patterns.
 * Supports Swedish market fraud detection with time-based pattern analysis.
 */

import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { FraudDetectionService } from '../../services/fraud/fraudDetectionService';
import { BehavioralPatternService } from '../../services/fraud/behavioralPatternService';
import { AuditLoggingService } from '../../services/security/auditLoggingService';
import { IntrusionDetectionService } from '../../services/security/intrusionDetectionService';
import { adminAuth } from '../../middleware/admin-auth';

const router = Router();

// Rate limiting for fraud pattern requests
const patternAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs (patterns are expensive to compute)
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many pattern analysis requests. Try again later.',
    retry_after: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Admin rate limiting (higher limits for admin users)
const adminPatternLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 200, // Higher limit for admin users
  message: {
    error: 'admin_rate_limit_exceeded',
    message: 'Admin rate limit exceeded. Try again later.',
    retry_after: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation middleware for pattern analysis
const validatePatternRequest = [
  param('phone_hash')
    .isLength({ min: 8, max: 64 })
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Phone hash must be alphanumeric, 8-64 characters'),
  
  query('time_window')
    .optional()
    .isIn(['30m', '24h', '7d', '30d'])
    .withMessage('Time window must be one of: 30m, 24h, 7d, 30d'),
    
  query('pattern_types')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const types = value.split(',');
        const validTypes = ['call_frequency', 'time_pattern', 'location_pattern', 'similarity_pattern'];
        return types.every(type => validTypes.includes(type.trim()));
      }
      return false;
    })
    .withMessage('Pattern types must be comma-separated list of: call_frequency, time_pattern, location_pattern, similarity_pattern'),

  query('include_details')
    .optional()
    .isBoolean()
    .withMessage('Include details must be boolean')
];

/**
 * GET /api/fraud/patterns/{phone_hash}
 * Retrieves behavioral patterns for a specific phone number hash
 */
router.get('/:phone_hash',
  adminAuth, // Only admin users can access pattern analysis
  patternAnalysisLimiter,
  validatePatternRequest,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string || 
                         `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validation check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await AuditLoggingService.getInstance().logEvent({
          eventType: 'data_access',
          userId: (req as any).user?.id || 'anonymous',
          userType: 'admin',
          action: 'get_fraud_patterns',
          resourceType: 'fraud_patterns',
          resourceId: req.params.phone_hash,
          result: 'failure',
          metadata: {
            correlation_id: correlationId,
            validation_errors: errors.array(),
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          },
          context: {
            correlationId,
            endpoint: '/api/fraud/patterns/:phone_hash',
            method: 'GET'
          }
        });

        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request parameters',
          details: errors.array()
        });
      }

      // Intrusion detection check
      const intrusionService = IntrusionDetectionService.getInstance();
      const intrusionResult = await intrusionService.analyzeRequest({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        query: req.query,
        params: req.params,
        ip: req.ip,
        userAgent: req.get('User-Agent') || '',
        correlationId
      });

      if (intrusionResult.threatDetected) {
        await AuditLoggingService.getInstance().logEvent({
          eventType: 'security_violation',
          userId: (req as any).user?.id || 'anonymous',
          userType: 'admin',
          action: 'get_fraud_patterns',
          resourceType: 'fraud_patterns',
          resourceId: req.params.phone_hash,
          result: 'blocked',
          metadata: {
            correlation_id: correlationId,
            intrusion_details: intrusionResult,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          },
          context: {
            correlationId,
            endpoint: '/api/fraud/patterns/:phone_hash',
            method: 'GET',
            threat_level: intrusionResult.threatLevel
          }
        });

        return res.status(403).json({
          error: 'security_violation',
          message: 'Request blocked due to security concerns'
        });
      }

      const { phone_hash } = req.params;
      const timeWindow = req.query.time_window as string || '24h';
      const patternTypesQuery = req.query.pattern_types as string;
      const includeDetails = req.query.include_details === 'true';

      // Parse pattern types filter
      const requestedPatternTypes = patternTypesQuery 
        ? patternTypesQuery.split(',').map(t => t.trim())
        : ['call_frequency', 'time_pattern', 'location_pattern', 'similarity_pattern'];

      // Get behavioral patterns service
      const behavioralService = BehavioralPatternService.getInstance();

      // Convert time window to milliseconds
      const timeWindowMs = this.parseTimeWindow(timeWindow);
      const endTime = new Date();
      const startTimePattern = new Date(endTime.getTime() - timeWindowMs);

      // Retrieve patterns for the phone hash
      const patterns = await behavioralService.analyzePatterns({
        phone_hash,
        time_window: {
          start: startTimePattern,
          end: endTime
        },
        pattern_types: requestedPatternTypes as ('call_frequency' | 'time_pattern' | 'location_pattern' | 'similarity_pattern')[],
        include_details: includeDetails
      });

      // Check if patterns exist
      if (!patterns || patterns.length === 0) {
        await AuditLoggingService.getInstance().logEvent({
          eventType: 'data_access',
          userId: (req as any).user?.id || 'anonymous',
          userType: 'admin',
          action: 'get_fraud_patterns',
          resourceType: 'fraud_patterns',
          resourceId: phone_hash,
          result: 'success',
          metadata: {
            correlation_id: correlationId,
            patterns_found: 0,
            time_window: timeWindow,
            processing_time_ms: Date.now() - startTime,
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          },
          context: {
            correlationId,
            endpoint: '/api/fraud/patterns/:phone_hash',
            method: 'GET'
          }
        });

        return res.status(404).json({
          error: 'patterns_not_found',
          message: 'No behavioral patterns found for the specified phone hash',
          phone_hash,
          time_window: timeWindow
        });
      }

      // Calculate overall risk level
      const overallRiskScore = patterns.reduce((sum, pattern) => sum + pattern.risk_score, 0) / patterns.length;
      const overallRiskLevel = this.calculateRiskLevel(overallRiskScore);

      // Format response according to contract
      const response = {
        phone_hash,
        patterns: patterns.map(pattern => ({
          pattern_type: pattern.pattern_type,
          risk_score: pattern.risk_score,
          violation_count: pattern.violation_count,
          first_detected: pattern.first_detected.toISOString(),
          last_updated: pattern.last_updated.toISOString(),
          ...(includeDetails && pattern.details ? { details: pattern.details } : {})
        })),
        overall_risk_level: overallRiskLevel,
        time_window: timeWindow,
        analysis_timestamp: new Date().toISOString()
      };

      // Success audit log
      await AuditLoggingService.getInstance().logEvent({
        eventType: 'data_access',
        userId: (req as any).user?.id || 'anonymous',
        userType: 'admin',
        action: 'get_fraud_patterns',
        resourceType: 'fraud_patterns',
        resourceId: phone_hash,
        result: 'success',
        metadata: {
          correlation_id: correlationId,
          patterns_found: patterns.length,
          overall_risk_level: overallRiskLevel,
          overall_risk_score: overallRiskScore,
          time_window: timeWindow,
          processing_time_ms: Date.now() - startTime,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        },
        context: {
          correlationId,
          endpoint: '/api/fraud/patterns/:phone_hash',
          method: 'GET'
        }
      });

      return res.status(200).json(response);

    } catch (error) {
      // Error audit log
      await AuditLoggingService.getInstance().logEvent({
        eventType: 'system_event',
        userId: (req as any).user?.id || 'anonymous',
        userType: 'admin',
        action: 'get_fraud_patterns',
        resourceType: 'fraud_patterns',
        resourceId: req.params.phone_hash,
        result: 'failure',
        metadata: {
          correlation_id: correlationId,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_stack: error instanceof Error ? error.stack : undefined,
          processing_time_ms: Date.now() - startTime,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        },
        context: {
          correlationId,
          endpoint: '/api/fraud/patterns/:phone_hash',
          method: 'GET'
        }
      });

      console.error('[Fraud Patterns API] Error retrieving patterns:', {
        phone_hash: req.params.phone_hash,
        error: error instanceof Error ? error.message : error,
        correlation_id: correlationId
      });

      return res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to retrieve behavioral patterns',
        correlation_id: correlationId
      });
    }
  }
);

/**
 * Helper method to parse time window strings to milliseconds
 */
function parseTimeWindow(timeWindow: string): number {
  const timeWindowMap: Record<string, number> = {
    '30m': 30 * 60 * 1000,        // 30 minutes
    '24h': 24 * 60 * 60 * 1000,   // 24 hours
    '7d': 7 * 24 * 60 * 60 * 1000,  // 7 days
    '30d': 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  return timeWindowMap[timeWindow] || timeWindowMap['24h']; // Default to 24h
}

/**
 * Helper method to calculate risk level from score
 */
function calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore >= 90) return 'critical';
  if (riskScore >= 70) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}

// Apply helper functions to router context
(router as any).parseTimeWindow = parseTimeWindow;
(router as any).calculateRiskLevel = calculateRiskLevel;

export default router;