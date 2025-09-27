import { Router } from 'express';
import { z } from 'zod';
import { AnalysisService, AnalysisError } from '../../services/feedback-analysis/analysisService';
import { validateRequest } from '../../middleware/validation';
import { authenticateToken } from '../../middleware/auth';
import { rateLimitByUser } from '../../middleware/rateLimiter';

const router = Router();
const analysisService = new AnalysisService();

// Validation schemas
const processAnalysisSchema = z.object({
  call_session_id: z.string().uuid(),
  transcript_id: z.string().uuid().optional(),
  priority: z.enum(['normal', 'high']).optional().default('normal')
});

const fraudCheckSchema = z.object({
  call_session_id: z.string().uuid(),
  check_types: z.array(z.enum(['timing', 'content', 'context', 'pattern'])).min(1),
  business_context: z.record(z.any()).optional(),
  force_recheck: z.boolean().optional().default(false)
});

const generateSummarySchema = z.object({
  call_session_id: z.string().uuid(),
  quality_threshold: z.number().min(0.02).max(0.15),
  preserve_details: z.boolean().optional().default(true),
  target_length: z.enum(['brief', 'standard', 'detailed']).optional().default('standard')
});

const cleanupQuerySchema = z.object({
  quality_threshold: z.number().min(0.02),
  batch_size: z.number().int().min(1).max(1000).optional().default(100),
  dry_run: z.boolean().optional().default(false)
});

// POST /api/ai/analysis/process - Process feedback for quality analysis
router.post('/process',
  authenticateToken,
  rateLimitByUser(10, '1m'), // 10 analyses per minute per user
  validateRequest(processAnalysisSchema),
  async (req, res) => {
    try {
      const result = await analysisService.processQualityAnalysis({
        call_session_id: req.body.call_session_id,
        transcript_id: req.body.transcript_id,
        priority: req.body.priority
      });

      res.status(202).json({
        analysis_id: result.analysis_id,
        estimated_completion: result.estimated_completion.toISOString(),
        status: result.status
      });

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// GET /api/ai/analysis/{analysisId}/status - Get analysis status
router.get('/:analysisId/status',
  authenticateToken,
  async (req, res) => {
    try {
      const analysisId = req.params.analysisId;
      const status = await analysisService.getAnalysisStatus(analysisId);

      res.status(200).json({
        analysis_id: status.analysis_id,
        status: status.status,
        progress_percentage: status.progress_percentage,
        current_stage: status.current_stage,
        error_message: status.error_message
      });

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// GET /api/ai/analysis/{analysisId}/results - Get analysis results
router.get('/:analysisId/results',
  authenticateToken,
  async (req, res) => {
    try {
      const analysisId = req.params.analysisId;
      const results = await analysisService.getAnalysisResults(analysisId);

      // Format response according to contract
      const response = {
        assessment_id: results.id,
        call_session_id: results.call_session_id,
        scores: {
          legitimacy_score: results.legitimacy_score,
          depth_score: results.depth_score,
          usefulness_score: results.usefulness_score,
          overall_quality_score: results.overall_quality_score
        },
        reward_percentage: results.reward_percentage,
        is_fraudulent: results.is_fraudulent,
        fraud_reasons: results.fraud_reasons,
        analysis_summary: results.analysis_summary,
        business_actionable_items: results.business_actionable_items,
        analysis_metadata: results.analysis_metadata,
        created_at: results.created_at
      };

      res.status(200).json(response);

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// POST /api/ai/analysis/fraud-check - Run fraud detection analysis
router.post('/fraud-check',
  authenticateToken,
  rateLimitByUser(20, '1m'), // 20 fraud checks per minute per user
  validateRequest(fraudCheckSchema),
  async (req, res) => {
    try {
      const result = await analysisService.performFraudCheck({
        call_session_id: req.body.call_session_id,
        check_types: req.body.check_types,
        business_context: req.body.business_context,
        force_recheck: req.body.force_recheck
      });

      res.status(200).json({
        fraud_results: result.fraud_results,
        overall_is_fraudulent: result.overall_is_fraudulent,
        confidence_level: result.confidence_level,
        should_exclude_from_rewards: result.should_exclude_from_rewards
      });

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// POST /api/ai/analysis/summary/generate - Generate feedback summary
router.post('/summary/generate',
  authenticateToken,
  rateLimitByUser(15, '1m'), // 15 summaries per minute per user
  validateRequest(generateSummarySchema),
  async (req, res) => {
    try {
      const result = await analysisService.generateFeedbackSummary({
        call_session_id: req.body.call_session_id,
        quality_threshold: req.body.quality_threshold,
        preserve_details: req.body.preserve_details,
        target_length: req.body.target_length
      });

      res.status(200).json({
        summary_id: result.summary_id,
        summary_text: result.summary_text,
        key_insights: result.key_insights,
        actionable_items: result.actionable_items,
        summary_metadata: result.summary_metadata
      });

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// DELETE /api/ai/analysis/cleanup - Clean up low-grade feedback
router.delete('/cleanup',
  authenticateToken,
  rateLimitByUser(5, '1h'), // 5 cleanup operations per hour per user
  validateRequest(cleanupQuerySchema, 'query'),
  async (req, res) => {
    try {
      const qualityThreshold = parseFloat(req.query.quality_threshold as string);
      const batchSize = parseInt(req.query.batch_size as string) || 100;
      const dryRun = req.query.dry_run === 'true';

      const result = await analysisService.cleanupLowGradeFeedback(
        qualityThreshold,
        batchSize,
        dryRun
      );

      res.status(200).json({
        deleted_count: result.deleted_count,
        preserved_count: result.preserved_count,
        execution_time_ms: result.execution_time_ms,
        dry_run: result.dry_run
      });

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// GET /api/ai/analysis/metrics - Get analysis metrics
router.get('/metrics',
  authenticateToken,
  async (req, res) => {
    try {
      const storeId = req.query.store_id as string;
      const dateRange = req.query.start_date && req.query.end_date ? {
        start_date: req.query.start_date as string,
        end_date: req.query.end_date as string
      } : undefined;

      const metrics = await analysisService.getAnalysisMetrics(storeId, dateRange);

      res.status(200).json({
        total_assessments: metrics.total_assessments,
        fraud_detected_count: metrics.fraud_detected_count,
        fraud_rate_percentage: metrics.fraud_rate_percentage,
        qualifying_feedback_count: metrics.qualifying_feedback_count,
        qualification_rate_percentage: metrics.qualification_rate_percentage,
        average_quality_score: metrics.average_quality_score,
        average_reward_percentage: metrics.average_reward_percentage,
        quality_distribution: metrics.quality_distribution
      });

    } catch (error) {
      if (error instanceof AnalysisError) {
        const statusCode = getAnalysisStatusCode(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// Helper functions
function getAnalysisStatusCode(errorCode: string): number {
  const statusMap: Record<string, number> = {
    'ANALYSIS_NOT_FOUND': 404,
    'ANALYSIS_NOT_COMPLETE': 400,
    'SESSION_NOT_FOUND': 404,
    'SESSION_NOT_COMPLETED': 400,
    'ASSESSMENT_NOT_FOUND': 404,
    'BUSINESS_CONTEXT_NOT_FOUND': 404,
    'INVALID_THRESHOLD': 400,
    'QUALITY_TOO_LOW': 400,
    'TRANSCRIPT_FETCH_FAILED': 500,
    'CLEANUP_QUERY_FAILED': 500,
    'METRICS_QUERY_FAILED': 500,
    'RESULTS_NOT_FOUND': 404
  };
  
  return statusMap[errorCode] || 500;
}

export default router;