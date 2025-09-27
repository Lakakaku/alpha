import express from 'express';
import { qrVerificationManager } from '../../services/qr-verification-manager';
import { DatabaseValidator } from '../../utils/database-validation';
import { verificationSubmissionRateLimit } from '../../middleware/qr-rate-limiter';
import { validateSessionToken } from '../../middleware/qr-auth.middleware';
import { securityHeaders, corsHeaders, cacheHeaders } from '../../middleware/security-headers';
import type { 
  VerificationSubmissionRequest,
  VerificationSubmissionResponse 
} from '@vocilia/types';

const router = express.Router();

// Apply security middleware to all routes
router.use(securityHeaders());
router.use(corsHeaders());
router.use(cacheHeaders());

/**
 * POST /api/v1/verification/submit
 * Verification submission endpoint - submits customer transaction verification
 */
router.post('/submit', 
  verificationSubmissionRateLimit,
  validateSessionToken(),
  async (req, res) => {
  try {
    // Session token is validated by middleware
    const sessionToken = req.sessionToken!;

    // Validate request body
    const { transaction_time, transaction_amount, phone_number } = req.body;

    if (!transaction_time || transaction_amount === undefined || !phone_number) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: transaction_time, transaction_amount, phone_number'
        }
      });
    }

    // Validate individual fields
    if (!DatabaseValidator.validateTransactionTime(transaction_time)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction time format. Use HH:MM format (e.g., 14:30)'
        }
      });
    }

    if (!DatabaseValidator.validateTransactionAmount(transaction_amount)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction amount. Must be a positive number with max 2 decimal places'
        }
      });
    }

    if (!DatabaseValidator.validatePhoneNumber(phone_number)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid phone number format'
        }
      });
    }

    const submission: VerificationSubmissionRequest = {
      transaction_time,
      transaction_amount,
      phone_number
    };

    // For now, we'll use a fixed expected amount. In a real implementation,
    // this would come from the QR code data or be retrieved from the store/transaction
    const expectedAmount = 125.50;

    // Handle verification submission
    const response: VerificationSubmissionResponse = await qrVerificationManager.handleVerificationSubmission(
      sessionToken,
      submission,
      expectedAmount
    );

    const statusCode = response.success ? 200 : 400;
    res.status(statusCode).json(response);

  } catch (error: any) {
    console.error('Verification submission error:', error);

    // Handle specific error types
    if (error.code === 'VERIFICATION_ALREADY_EXISTS') {
      return res.status(409).json({
        error: {
          code: 'VERIFICATION_ALREADY_EXISTS',
          message: 'A verification has already been submitted for this session'
        }
      });
    }

    if (error.message === 'Session not found') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION_TOKEN',
          message: 'Session token is invalid or has expired'
        }
      });
    }

    if (error.message === 'Session expired') {
      return res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired. Please scan the QR code again.'
        }
      });
    }

    if (error.message === 'Session not valid') {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION_TOKEN',
          message: 'Session is not in a valid state for verification'
        }
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('format')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    // Generic server error
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while processing your verification'
      }
    });
  }
});

/**
 * GET /api/v1/verification/session/:sessionToken
 * Get verification session details
 */
router.get('/session/:sessionToken', async (req, res) => {
  try {
    const { sessionToken } = req.params;

    // Validate session token format
    if (!DatabaseValidator.validateSessionToken(sessionToken)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SESSION_TOKEN_FORMAT',
          message: 'Invalid session token format'
        }
      });
    }

    // Handle session details request
    const response = await qrVerificationManager.handleSessionDetails(sessionToken);

    res.status(200).json(response);

  } catch (error: any) {
    console.error('Session details error:', error);

    // Handle specific error types
    if (error.code === 'SESSION_NOT_FOUND') {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found'
        }
      });
    }

    if (error.code === 'SESSION_EXPIRED') {
      return res.status(410).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired'
        }
      });
    }

    // Generic server error
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while retrieving session details'
      }
    });
  }
});

/**
 * GET /api/v1/verification/status/:verificationId
 * Get verification status by verification ID
 */
router.get('/status/:verificationId', async (req, res) => {
  try {
    const { verificationId } = req.params;

    // Basic validation for UUID format
    if (!verificationId || !verificationId.match(/^[0-9a-f-]+$/)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_VERIFICATION_ID',
          message: 'Invalid verification ID format'
        }
      });
    }

    // Get verification details
    const verification = await qrVerificationManager.getServices().verificationService.getVerificationById(verificationId);

    if (!verification) {
      return res.status(404).json({
        error: {
          code: 'VERIFICATION_NOT_FOUND',
          message: 'Verification not found'
        }
      });
    }

    // Return verification status
    res.status(200).json({
      success: true,
      verification_id: verification.verification_id,
      status: verification.verification_status,
      validation_results: verification.validation_results,
      submitted_at: verification.submitted_at
    });

  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while retrieving verification status'
      }
    });
  }
});

export { router as verificationSubmissionRouter };