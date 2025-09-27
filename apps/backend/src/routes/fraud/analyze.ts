/**
 * Fraud Analysis API Route
 * Task: T049 - POST /api/fraud/analyze endpoint
 * 
 * Handles fraud analysis requests for customer feedback data.
 * Integrates with all fraud detection services for comprehensive analysis.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { FraudDetectionService } from '../../services/fraud/fraudDetectionService';
import { AuditLoggingService } from '../../services/security/auditLoggingService';
import { IntrusionDetectionService } from '../../services/security/intrusionDetectionService';
import { FraudAnalysisRequest, FraudAnalysisResponse } from '@vocilia/types';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for fraud analysis endpoint
const fraudAnalysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many fraud analysis requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.headers.authorization?.includes('admin-token') || false;
  }
});

// Validation middleware for fraud analysis request
const validateFraudAnalysisRequest = [
  body('phone_hash')
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage('Phone hash must be between 8 and 64 characters'),
  
  body('message_text')
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message text must be between 1 and 2000 characters'),
  
  body('store_id')
    .isUUID()
    .withMessage('Store ID must be a valid UUID'),
  
  body('call_duration')
    .optional()
    .isInt({ min: 0, max: 3600 })
    .withMessage('Call duration must be between 0 and 3600 seconds'),
  
  body('caller_location')
    .optional()
    .isObject()
    .custom((value) => {
      if (value && typeof value === 'object') {
        const { latitude, longitude, accuracy } = value;
        if (latitude !== undefined && (typeof latitude !== 'number' || latitude < -90 || latitude > 90)) {
          throw new Error('Invalid latitude');
        }
        if (longitude !== undefined && (typeof longitude !== 'number' || longitude < -180 || longitude > 180)) {
          throw new Error('Invalid longitude');
        }
        if (accuracy !== undefined && (typeof accuracy !== 'number' || accuracy < 0)) {
          throw new Error('Invalid accuracy');
        }
      }
      return true;
    }),
  
  body('session_metadata')
    .optional()
    .isObject()
    .withMessage('Session metadata must be an object'),
  
  body('previous_interactions')
    .optional()
    .isArray()
    .withMessage('Previous interactions must be an array'),
  
  body('detection_mode')
    .optional()
    .isIn(['comprehensive', 'quick_scan', 'context_only', 'behavioral_only'])
    .withMessage('Invalid detection mode'),
  
  body('enable_learning')
    .optional()
    .isBoolean()
    .withMessage('Enable learning must be a boolean')
];

/**
 * POST /api/fraud/analyze
 * Analyze customer feedback for fraud indicators
 */
router.post('/analyze', 
  fraudAnalysisLimiter,
  validateFraudAnalysisRequest,
  async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await AuditLoggingService.getInstance().logEvent({
          eventType: 'fraud_detection',
          userId: 'anonymous',
          userType: 'customer',
          actionPerformed: 'fraud_analysis_validation_failed',
          resourceType: 'fraud_analysis',
          resourceId: requestId,
          resultStatus: 'failure',
          context: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            correlationId: requestId
          },
          eventMetadata: {
            validation_errors: errors.array(),
            request_size: JSON.stringify(req.body).length
          }
        });

        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid request parameters',
          details: errors.array()
        });
      }

      // Perform intrusion detection check
      const intrusionService = IntrusionDetectionService.getInstance();
      const intrusionResult = await intrusionService.analyzeRequest({
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.body.phone_hash,
        requestPath: req.path,
        requestMethod: req.method,
        requestHeaders: req.headers as Record<string, string>,
        requestBody: JSON.stringify(req.body),
        sessionId: req.headers['x-session-id'] as string
      });

      if (intrusionResult.isIntrusion && intrusionResult.recommendedAction === 'block') {
        await AuditLoggingService.getInstance().logEvent({
          eventType: 'security_violation',
          userId: req.body.phone_hash || 'anonymous',
          userType: 'customer',
          actionPerformed: 'fraud_analysis_blocked',
          resourceType: 'fraud_analysis',
          resourceId: requestId,
          resultStatus: 'blocked',
          context: {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            correlationId: requestId
          },
          eventMetadata: {
            intrusion_type: intrusionResult.intrusionType,
            threat_level: intrusionResult.threatLevel,
            confidence: intrusionResult.confidence,
            event_id: intrusionResult.eventId
          }
        });

        return res.status(403).json({
          error: 'request_blocked',
          message: 'Request blocked due to security policy violation',
          threat_level: intrusionResult.threatLevel
        });
      }

      // Parse and validate the fraud analysis request
      const analysisRequest: FraudAnalysisRequest = {
        phone_hash: req.body.phone_hash,
        message_text: req.body.message_text,
        store_id: req.body.store_id,
        call_duration: req.body.call_duration,
        caller_location: req.body.caller_location,
        session_metadata: req.body.session_metadata || {},
        previous_interactions: req.body.previous_interactions || [],
        detection_mode: req.body.detection_mode || 'comprehensive',
        enable_learning: req.body.enable_learning !== false, // Default to true
        request_id: requestId,
        timestamp: new Date()
      };

      // Perform fraud analysis
      const fraudService = FraudDetectionService.getInstance();
      let analysisResult: FraudAnalysisResponse;

      switch (analysisRequest.detection_mode) {
        case 'quick_scan':
          analysisResult = await fraudService.quickScan({
            phone_hash: analysisRequest.phone_hash,
            message_text: analysisRequest.message_text,
            store_id: analysisRequest.store_id,
            session_metadata: analysisRequest.session_metadata,
            request_id: requestId
          });
          break;
        
        case 'context_only':
          const contextResult = await fraudService.analyzeContext({
            phone_hash: analysisRequest.phone_hash,
            message_text: analysisRequest.message_text,
            store_id: analysisRequest.store_id,
            session_metadata: analysisRequest.session_metadata,
            request_id: requestId
          });
          analysisResult = {
            request_id: requestId,
            is_fraud: contextResult.legitimacy_score < 30,
            confidence_score: contextResult.legitimacy_score,
            risk_level: contextResult.legitimacy_score < 30 ? 'high' : contextResult.legitimacy_score < 60 ? 'medium' : 'low',
            fraud_indicators: contextResult.red_flags.map(flag => ({
              type: 'context',
              severity: flag.severity > 7 ? 'high' : flag.severity > 4 ? 'medium' : 'low',
              description: flag.issue,
              confidence: flag.confidence
            })),
            analysis_breakdown: {
              context_analysis: contextResult,
              behavioral_patterns: null,
              keyword_matches: null,
              transaction_verification: null
            },
            recommended_action: contextResult.legitimacy_score < 30 ? 'block' : 'allow',
            processing_time_ms: Date.now() - startTime
          };
          break;
        
        case 'behavioral_only':
          const behavioralResult = await fraudService.analyzeBehavioral({
            phone_hash: analysisRequest.phone_hash,
            message_text: analysisRequest.message_text,
            store_id: analysisRequest.store_id,
            call_duration: analysisRequest.call_duration,
            caller_location: analysisRequest.caller_location,
            previous_interactions: analysisRequest.previous_interactions,
            session_metadata: analysisRequest.session_metadata,
            request_id: requestId
          });
          analysisResult = {
            request_id: requestId,
            is_fraud: behavioralResult.overall_risk_score > 70,
            confidence_score: behavioralResult.overall_risk_score,
            risk_level: behavioralResult.overall_risk_score > 70 ? 'high' : behavioralResult.overall_risk_score > 40 ? 'medium' : 'low',
            fraud_indicators: behavioralResult.detected_patterns.map(pattern => ({
              type: 'behavioral',
              severity: pattern.risk_score > 70 ? 'high' : pattern.risk_score > 40 ? 'medium' : 'low',
              description: `${pattern.pattern_type}: ${pattern.violation_count} violations`,
              confidence: pattern.risk_score
            })),
            analysis_breakdown: {
              context_analysis: null,
              behavioral_patterns: behavioralResult,
              keyword_matches: null,
              transaction_verification: null
            },
            recommended_action: behavioralResult.overall_risk_score > 70 ? 'block' : 'allow',
            processing_time_ms: Date.now() - startTime
          };
          break;
        
        default: // comprehensive
          analysisResult = await fraudService.analyzeComprehensive(analysisRequest);
          break;
      }

      // Log successful analysis
      await AuditLoggingService.getInstance().logEvent({
        eventType: 'fraud_detection',
        userId: analysisRequest.phone_hash,
        userType: 'customer',
        actionPerformed: 'fraud_analysis_completed',
        resourceType: 'fraud_analysis',
        resourceId: requestId,
        resultStatus: analysisResult.is_fraud ? 'blocked' : 'success',
        context: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: requestId
        },
        eventMetadata: {
          detection_mode: analysisRequest.detection_mode,
          is_fraud: analysisResult.is_fraud,
          confidence_score: analysisResult.confidence_score,
          risk_level: analysisResult.risk_level,
          processing_time_ms: analysisResult.processing_time_ms,
          fraud_indicators_count: analysisResult.fraud_indicators.length
        }
      });

      // Return analysis result
      const responseCode = analysisResult.is_fraud ? 200 : 200; // Always 200 for successful analysis
      res.status(responseCode).json(analysisResult);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      await AuditLoggingService.getInstance().logEvent({
        eventType: 'fraud_detection',
        userId: req.body?.phone_hash || 'anonymous',
        userType: 'customer',
        actionPerformed: 'fraud_analysis_error',
        resourceType: 'fraud_analysis',
        resourceId: requestId,
        resultStatus: 'failure',
        context: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: requestId
        },
        eventMetadata: {
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: processingTime,
          stack_trace: error instanceof Error ? error.stack?.substring(0, 500) : undefined
        }
      });

      console.error('[FRAUD_ANALYSIS_ERROR]', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });

      res.status(500).json({
        error: 'analysis_failed',
        message: 'Fraud analysis could not be completed',
        request_id: requestId
      });
    }
  }
);

/**
 * GET /api/fraud/analyze/status/{request_id}
 * Get status of a fraud analysis request (for async processing)
 */
router.get('/status/:requestId', async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId;
    
    if (!requestId || requestId.length < 8) {
      return res.status(400).json({
        error: 'invalid_request_id',
        message: 'Valid request ID is required'
      });
    }

    // In a production system, this would check a cache or database
    // For now, return a simple response
    res.json({
      request_id: requestId,
      status: 'completed',
      message: 'Analysis completed - use original response'
    });

  } catch (error) {
    res.status(500).json({
      error: 'status_check_failed',
      message: 'Could not retrieve analysis status'
    });
  }
});

/**
 * POST /api/fraud/analyze/batch
 * Batch fraud analysis for multiple requests
 */
router.post('/batch',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit batch requests more strictly
    message: {
      error: 'rate_limit_exceeded',
      message: 'Too many batch analysis requests'
    }
  }),
  body('requests')
    .isArray({ min: 1, max: 20 })
    .withMessage('Requests must be an array with 1-20 items'),
  body('requests.*.phone_hash')
    .isString()
    .isLength({ min: 8, max: 64 })
    .withMessage('Each request must have a valid phone hash'),
  body('requests.*.message_text')
    .isString()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Each request must have valid message text'),
  body('requests.*.store_id')
    .isUUID()
    .withMessage('Each request must have a valid store ID'),
  
  async (req: Request, res: Response) => {
    const batchId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid batch request parameters',
          details: errors.array()
        });
      }

      const requests = req.body.requests;
      const fraudService = FraudDetectionService.getInstance();
      const results = [];

      // Process requests in parallel with controlled concurrency
      const concurrentLimit = 5;
      for (let i = 0; i < requests.length; i += concurrentLimit) {
        const batch = requests.slice(i, i + concurrentLimit);
        const batchPromises = batch.map(async (request: any, index: number) => {
          const requestId = `${batchId}-${i + index}`;
          try {
            const analysisRequest: FraudAnalysisRequest = {
              ...request,
              detection_mode: request.detection_mode || 'quick_scan',
              enable_learning: false, // Disable learning for batch requests
              request_id: requestId,
              timestamp: new Date()
            };

            const result = await fraudService.quickScan({
              phone_hash: analysisRequest.phone_hash,
              message_text: analysisRequest.message_text,
              store_id: analysisRequest.store_id,
              session_metadata: analysisRequest.session_metadata || {},
              request_id: requestId
            });

            return {
              request_index: i + index,
              request_id: requestId,
              success: true,
              result
            };
          } catch (error) {
            return {
              request_index: i + index,
              request_id: requestId,
              success: false,
              error: error instanceof Error ? error.message : 'Analysis failed'
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      await AuditLoggingService.getInstance().logEvent({
        eventType: 'fraud_detection',
        userId: 'batch_process',
        userType: 'system',
        actionPerformed: 'batch_fraud_analysis',
        resourceType: 'fraud_analysis',
        resourceId: batchId,
        resultStatus: failureCount === 0 ? 'success' : 'partial_failure',
        context: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: batchId
        },
        eventMetadata: {
          total_requests: requests.length,
          success_count: successCount,
          failure_count: failureCount,
          processing_time_ms: processingTime
        }
      });

      res.json({
        batch_id: batchId,
        total_requests: requests.length,
        success_count: successCount,
        failure_count: failureCount,
        processing_time_ms: processingTime,
        results
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await AuditLoggingService.getInstance().logEvent({
        eventType: 'fraud_detection',
        userId: 'batch_process',
        userType: 'system',
        actionPerformed: 'batch_fraud_analysis_error',
        resourceType: 'fraud_analysis',
        resourceId: batchId,
        resultStatus: 'failure',
        context: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: batchId
        },
        eventMetadata: {
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: processingTime
        }
      });

      res.status(500).json({
        error: 'batch_analysis_failed',
        message: 'Batch fraud analysis could not be completed',
        batch_id: batchId
      });
    }
  }
);

export default router;