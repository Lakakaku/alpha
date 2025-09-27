import { Router } from 'express';
import { z } from 'zod';
import { CallManagerService, CallManagerError } from '../../services/calls/callManagerService';
import { validateRequest } from '../../middleware/validation';
import { authenticateToken } from '../../middleware/auth';
import { rateLimitByUser } from '../../middleware/rateLimiter';

const router = Router();
const callManagerService = new CallManagerService();

// Validation schemas
const initiateCallSchema = z.object({
  customer_verification_id: z.string().uuid(),
  phone_number: z.string().regex(/^\+46[0-9]{8,9}$/, 'Must be valid Swedish phone number'),
  store_id: z.string().uuid(),
  priority: z.enum(['normal', 'high']).optional().default('normal')
});

const updateCallSessionSchema = z.object({
  status: z.enum(['abandoned', 'failed']).optional(),
  failure_reason: z.string().max(100).optional(),
  end_reason: z.enum(['customer_hangup', 'technical_failure', 'non_swedish', 'timeout']).optional()
});

const transcriptMessageSchema = z.object({
  speaker: z.enum(['ai', 'customer']),
  content: z.string().max(2000),
  timestamp_ms: z.number().int().min(0),
  message_order: z.number().int().min(0),
  confidence_score: z.number().min(0).max(1).optional(),
  message_type: z.enum(['question', 'response', 'system', 'error']).optional().default('response'),
  language_detected: z.string().length(2).optional().default('sv')
});

const submitTranscriptSchema = z.object({
  messages: z.array(transcriptMessageSchema).min(2),
  total_duration_seconds: z.number().int().min(60).max(120),
  openai_session_id: z.string().optional(),
  final_audio_quality: z.object({
    connection_quality: z.enum(['excellent', 'good', 'fair', 'poor']),
    audio_clarity_score: z.number().min(0).max(1).optional(),
    latency_ms: z.number().int().optional(),
    packet_loss_percentage: z.number().min(0).max(100).optional(),
    openai_api_latency: z.number().int().optional()
  }).optional()
});

// POST /api/ai/calls/initiate - Initiate AI feedback call
router.post('/initiate', 
  authenticateToken,
  rateLimitByUser(5, '1m'), // 5 calls per minute per user
  validateRequest(initiateCallSchema),
  async (req, res) => {
    try {
      const result = await callManagerService.initiateCall({
        customer_verification_id: req.body.customer_verification_id,
        phone_number: req.body.phone_number,
        store_id: req.body.store_id,
        priority: req.body.priority
      });

      res.status(202).json({
        call_session_id: result.call_session_id,
        status: result.status,
        estimated_call_time: result.estimated_call_time.toISOString(),
        retry_count: result.retry_count
      });

    } catch (error) {
      if (error instanceof CallManagerError) {
        const statusCode = getStatusCodeForError(error.code);
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

// GET /api/ai/calls/{sessionId}/status - Get call session status
router.get('/:sessionId/status',
  authenticateToken,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      if (!isValidUUID(sessionId)) {
        return res.status(400).json({
          error: 'INVALID_SESSION_ID',
          message: 'Session ID must be a valid UUID',
          timestamp: new Date().toISOString()
        });
      }

      const status = await callManagerService.getCallStatus(sessionId);

      res.status(200).json({
        call_session_id: status.call_session_id,
        status: status.status,
        current_retry: status.current_retry,
        duration_seconds: status.duration_seconds,
        quality_metrics: status.quality_metrics,
        failure_reason: status.failure_reason
      });

    } catch (error) {
      if (error instanceof CallManagerError) {
        const statusCode = getStatusCodeForError(error.code);
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

// PATCH /api/ai/calls/{sessionId} - Update call session
router.patch('/:sessionId',
  authenticateToken,
  validateRequest(updateCallSessionSchema),
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      if (!isValidUUID(sessionId)) {
        return res.status(400).json({
          error: 'INVALID_SESSION_ID',
          message: 'Session ID must be a valid UUID',
          timestamp: new Date().toISOString()
        });
      }

      // For now, just return success - full implementation would update session
      // This is a placeholder for the PATCH endpoint mentioned in contracts
      
      res.status(200).json({
        call_session_id: sessionId,
        status: req.body.status || 'updated',
        updated_at: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// POST /api/ai/calls/{sessionId}/transcript - Submit conversation transcript
router.post('/:sessionId/transcript',
  authenticateToken,
  validateRequest(submitTranscriptSchema),
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      if (!isValidUUID(sessionId)) {
        return res.status(400).json({
          error: 'INVALID_SESSION_ID',
          message: 'Session ID must be a valid UUID',
          timestamp: new Date().toISOString()
        });
      }

      const result = await callManagerService.submitTranscript(sessionId, {
        messages: req.body.messages,
        total_duration_seconds: req.body.total_duration_seconds,
        openai_session_id: req.body.openai_session_id,
        final_audio_quality: req.body.final_audio_quality
      });

      res.status(201).json({
        transcript_id: result.transcript_id,
        analysis_queued: result.analysis_queued,
        estimated_analysis_completion: result.estimated_analysis_completion.toISOString()
      });

    } catch (error) {
      if (error instanceof CallManagerError) {
        const statusCode = getStatusCodeForError(error.code);
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

// PUT /api/ai/calls/retry/{customerVerificationId} - Retry failed call
router.put('/retry/:customerVerificationId',
  authenticateToken,
  rateLimitByUser(3, '5m'), // 3 retries per 5 minutes per user
  async (req, res) => {
    try {
      const customerVerificationId = req.params.customerVerificationId;
      
      if (!isValidUUID(customerVerificationId)) {
        return res.status(400).json({
          error: 'INVALID_VERIFICATION_ID',
          message: 'Customer verification ID must be a valid UUID',
          timestamp: new Date().toISOString()
        });
      }

      const result = await callManagerService.retryFailedCall(customerVerificationId);

      res.status(202).json({
        new_call_session_id: result.new_call_session_id,
        retry_number: result.retry_number,
        estimated_call_time: result.estimated_call_time.toISOString()
      });

    } catch (error) {
      if (error instanceof CallManagerError) {
        const statusCode = getStatusCodeForError(error.code);
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

// DELETE /api/ai/calls/{sessionId} - Cancel/end call session
router.delete('/:sessionId',
  authenticateToken,
  async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      if (!isValidUUID(sessionId)) {
        return res.status(400).json({
          error: 'INVALID_SESSION_ID',
          message: 'Session ID must be a valid UUID',
          timestamp: new Date().toISOString()
        });
      }

      // Implementation would cancel the call session
      // For now, return success response
      
      res.status(200).json({
        call_session_id: sessionId,
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Helper functions
function getStatusCodeForError(errorCode: string): number {
  const statusMap: Record<string, number> = {
    'CALL_ALREADY_EXISTS': 409,
    'MAX_RETRIES_EXCEEDED': 409,
    'INVALID_PHONE_NUMBER': 400,
    'SESSION_NOT_FOUND': 404,
    'SESSION_NOT_COMPLETED': 400,
    'SESSION_ALREADY_COMPLETED': 400,
    'NO_EXISTING_SESSION': 404,
    'DATABASE_ERROR': 500,
    'CALL_INITIATION_FAILED': 500,
    'SESSION_UPDATE_FAILED': 500,
    'TRANSCRIPT_STORAGE_FAILED': 500,
    'ASSESSMENT_STORAGE_FAILED': 500
  };
  
  return statusMap[errorCode] || 500;
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export default router;