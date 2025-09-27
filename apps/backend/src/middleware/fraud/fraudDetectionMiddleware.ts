import { Request, Response, NextFunction } from 'express';
import { FraudDetectionService } from '../../services/fraud/fraudDetectionService';
import { AuditLoggingService } from '../../services/security/auditLoggingService';

const fraudDetectionService = new FraudDetectionService();
const auditService = new AuditLoggingService();

// Extend Request interface to include fraud analysis
declare global {
  namespace Express {
    interface Request {
      fraudAnalysis?: {
        score: number;
        isBlocked: boolean;
        reasons: string[];
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        analysisId: string;
      };
    }
  }
}

interface FraudDetectionOptions {
  enableBlocking?: boolean;
  scoreThreshold?: number;
  skipRoutes?: string[];
  logAllAnalyses?: boolean;
  enableRealTimeBlocking?: boolean;
  customValidation?: (req: Request) => boolean;
}

/**
 * Middleware factory for fraud detection on feedback submissions
 */
export function fraudDetectionMiddleware(options: FraudDetectionOptions = {}) {
  const {
    enableBlocking = true,
    scoreThreshold = 70,
    skipRoutes = [],
    logAllAnalyses = true,
    enableRealTimeBlocking = true,
    customValidation
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip fraud detection for certain routes
      if (skipRoutes.some(route => req.path.includes(route))) {
        return next();
      }

      // Apply custom validation if provided
      if (customValidation && !customValidation(req)) {
        return next();
      }

      // Only analyze feedback-related endpoints
      const feedbackEndpoints = [
        '/api/feedback/submit',
        '/api/customer/feedback',
        '/api/business/feedback'
      ];

      if (!feedbackEndpoints.some(endpoint => req.path.includes(endpoint))) {
        return next();
      }

      const correlationId = crypto.randomUUID();
      const startTime = Date.now();

      // Extract feedback content and context
      const feedbackData = extractFeedbackData(req);
      
      if (!feedbackData) {
        // No feedback data to analyze, proceed normally
        return next();
      }

      // Perform fraud analysis
      const analysisResult = await fraudDetectionService.analyzeFeedback({
        content: feedbackData.content,
        customerId: feedbackData.customerId,
        storeId: feedbackData.storeId,
        phoneNumber: feedbackData.phoneNumber,
        sessionContext: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
          correlationId
        }
      });

      const analysisTime = Date.now() - startTime;

      // Attach fraud analysis to request
      req.fraudAnalysis = {
        score: analysisResult.overallScore,
        isBlocked: analysisResult.isBlocked,
        reasons: analysisResult.flaggedReasons,
        riskLevel: calculateRiskLevel(analysisResult.overallScore),
        analysisId: analysisResult.analysisId
      };

      // Log the fraud analysis
      if (logAllAnalyses || analysisResult.isBlocked) {
        await auditService.logEvent({
          event_type: 'fraud_detection',
          user_id: feedbackData.customerId,
          user_type: 'customer',
          action_performed: 'fraud_analysis_completed',
          resource_type: 'feedback_submissions',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          correlation_id: correlationId,
          result_status: analysisResult.isBlocked ? 'blocked' : 'success',
          event_metadata: {
            fraud_score: analysisResult.overallScore,
            risk_level: req.fraudAnalysis.riskLevel,
            analysis_time_ms: analysisTime,
            blocked_reasons: analysisResult.flaggedReasons,
            store_id: feedbackData.storeId,
            analysis_breakdown: {
              context_score: analysisResult.contextScore,
              keyword_score: analysisResult.keywordScore,
              behavioral_score: analysisResult.behavioralScore,
              transaction_score: analysisResult.transactionScore
            }
          }
        });
      }

      // Block request if fraud detected and blocking is enabled
      if (enableBlocking && analysisResult.isBlocked) {
        // Log the blocked request
        await auditService.logEvent({
          event_type: 'security_violation',
          user_id: feedbackData.customerId,
          user_type: 'customer',
          action_performed: 'fraud_detected_request_blocked',
          resource_type: 'feedback_submissions',
          ip_address: req.ip,
          correlation_id: correlationId,
          result_status: 'blocked',
          event_metadata: {
            fraud_score: analysisResult.overallScore,
            blocked_reasons: analysisResult.flaggedReasons,
            block_threshold: scoreThreshold
          }
        });

        return res.status(403).json({
          success: false,
          error: 'Submission blocked due to security concerns',
          details: {
            reason: 'fraud_detected',
            riskLevel: req.fraudAnalysis.riskLevel,
            analysisId: req.fraudAnalysis.analysisId
          }
        });
      }

      // Add security headers for suspicious requests
      if (analysisResult.overallScore < 85) {
        res.setHeader('X-Security-Risk-Level', req.fraudAnalysis.riskLevel);
        res.setHeader('X-Fraud-Analysis-Id', req.fraudAnalysis.analysisId);
      }

      next();
    } catch (error) {
      console.error('Fraud detection middleware error:', error);

      // Log the error
      await auditService.logEvent({
        event_type: 'system_event',
        user_type: 'system',
        action_performed: 'fraud_detection_error',
        resource_type: 'fraud_detection_middleware',
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method
        }
      });

      // Continue processing - don't let fraud detection errors break the request
      next();
    }
  };
}

/**
 * Middleware specifically for phone number validation and analysis
 */
export function phoneNumberFraudCheck(options: { strictMode?: boolean } = {}) {
  const { strictMode = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phoneNumber = extractPhoneNumber(req);
      
      if (!phoneNumber) {
        return next();
      }

      // Check phone number against behavioral patterns
      const phoneAnalysis = await fraudDetectionService.analyzePhoneNumber(phoneNumber);

      if (phoneAnalysis.isHighRisk) {
        await auditService.logEvent({
          event_type: 'fraud_detection',
          user_type: 'customer',
          action_performed: 'high_risk_phone_detected',
          resource_type: 'phone_validation',
          ip_address: req.ip,
          result_status: phoneAnalysis.shouldBlock ? 'blocked' : 'warning',
          event_metadata: {
            phone_hash: phoneAnalysis.phoneHash,
            risk_factors: phoneAnalysis.riskFactors,
            pattern_violations: phoneAnalysis.patternViolations
          }
        });

        if (strictMode && phoneAnalysis.shouldBlock) {
          return res.status(429).json({
            success: false,
            error: 'Phone number temporarily restricted',
            details: {
              reason: 'high_risk_pattern',
              retryAfter: phoneAnalysis.blockDuration || 3600
            }
          });
        }
      }

      // Attach phone analysis to request
      req.phoneAnalysis = phoneAnalysis;
      
      next();
    } catch (error) {
      console.error('Phone fraud check error:', error);
      next(); // Continue on error
    }
  };
}

/**
 * Middleware for real-time fraud score monitoring
 */
export function fraudScoreMonitoring() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Hook into response to capture fraud score results
    const originalSend = res.send;
    
    res.send = function(data: any) {
      // Process fraud analysis results after response
      if (req.fraudAnalysis) {
        setImmediate(async () => {
          try {
            await fraudDetectionService.updateFraudMetrics({
              score: req.fraudAnalysis!.score,
              riskLevel: req.fraudAnalysis!.riskLevel,
              isBlocked: req.fraudAnalysis!.isBlocked,
              endpoint: req.path,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Error updating fraud metrics:', error);
          }
        });
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Extract feedback data from request
 */
function extractFeedbackData(req: Request): {
  content: string;
  customerId?: string;
  storeId?: string;
  phoneNumber?: string;
} | null {
  // Extract from POST body
  if (req.method === 'POST' && req.body) {
    return {
      content: req.body.feedback_content || req.body.content || req.body.message,
      customerId: req.body.customer_id || req.user?.id,
      storeId: req.body.store_id,
      phoneNumber: req.body.phone_number || req.headers['x-phone-number'] as string
    };
  }

  // Extract from query parameters for GET requests
  if (req.method === 'GET' && req.query.content) {
    return {
      content: req.query.content as string,
      customerId: req.query.customer_id as string || req.user?.id,
      storeId: req.query.store_id as string,
      phoneNumber: req.query.phone_number as string
    };
  }

  return null;
}

/**
 * Extract phone number from request
 */
function extractPhoneNumber(req: Request): string | null {
  return (
    req.body?.phone_number ||
    req.query?.phone_number ||
    req.headers['x-phone-number'] ||
    req.user?.phone_number
  ) as string || null;
}

/**
 * Calculate risk level based on fraud score
 */
function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 90) return 'low';
  if (score >= 75) return 'medium';
  if (score >= 50) return 'high';
  return 'critical';
}

// Export individual middleware functions
export {
  phoneNumberFraudCheck as phoneNumberValidation,
  fraudScoreMonitoring as fraudMetrics
};

// Export configured middleware instances for common use cases
export const standardFraudDetection = fraudDetectionMiddleware({
  enableBlocking: true,
  scoreThreshold: 70,
  logAllAnalyses: true,
  enableRealTimeBlocking: true
});

export const strictFraudDetection = fraudDetectionMiddleware({
  enableBlocking: true,
  scoreThreshold: 85,
  logAllAnalyses: true,
  enableRealTimeBlocking: true
});

export const monitoringOnlyFraudDetection = fraudDetectionMiddleware({
  enableBlocking: false,
  logAllAnalyses: true,
  enableRealTimeBlocking: false
});