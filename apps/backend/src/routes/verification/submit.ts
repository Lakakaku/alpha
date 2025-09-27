import express from 'express';
import { phoneValidator } from '../../services/validation/phone-validator';
import { timeToleranceValidator } from '../../services/validation/time-tolerance-validator';
import { amountToleranceValidator } from '../../services/validation/amount-tolerance-validator';
import { qrVerificationManager } from '../../services/qr-verification-manager';
import { sessionValidationMiddleware } from '../../middleware/session-validation';
import { inputSanitization } from '../../middleware/input-sanitization';
import { securityHeaders } from '../../middleware/security-headers';
import type { 
  CustomerVerificationRequest,
  CustomerVerificationResponse,
  ValidationResults
} from '@vocilia/types';

const router = express.Router();

// Apply security middleware
router.use(securityHeaders());
router.use(inputSanitization());

/**
 * POST /api/v1/verification/submit
 * Submit customer verification form with transaction details
 */
router.post('/submit',
  sessionValidationMiddleware(),
  async (req, res) => {
    try {
      const { transaction_time, transaction_amount, phone_number } = req.body;
      const sessionToken = req.headers['x-session-token'] as string;

      // Validate required fields
      if (!transaction_time || !transaction_amount || !phone_number) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_FAILED',
          message: 'Missing required fields: transaction_time, transaction_amount, phone_number'
        });
      }

      // Get session details
      const session = await qrVerificationManager.getSessionByToken(sessionToken);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Invalid session token'
        });
      }

      // Check if session is expired
      if (session.isExpired()) {
        return res.status(410).json({
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Verification session has expired. Please scan the QR code again'
        });
      }

      // Perform validations
      const phoneValidation = phoneValidator.validateSwedishMobile(phone_number);
      const timeValidation = timeToleranceValidator.validateTime(transaction_time);
      const amountValidation = amountToleranceValidator.validateAmount(transaction_amount);

      const validationResults: ValidationResults = {
        time_validation: timeValidation,
        amount_validation: amountValidation,
        phone_validation: phoneValidation,
        overall_valid: timeValidation.status === 'valid' && 
                      amountValidation.status === 'valid' && 
                      phoneValidation.status === 'valid'
      };

      // Create customer verification record
      const verificationId = await qrVerificationManager.createCustomerVerification({
        session_id: session.id,
        transaction_time,
        transaction_amount,
        phone_number,
        validation_results: validationResults
      });

      // Update session status to completed
      await qrVerificationManager.updateSessionStatus(session.id, 'completed');

      const response: CustomerVerificationResponse = {
        success: true,
        verification_id: verificationId,
        validation_results: validationResults,
        next_steps: validationResults.overall_valid 
          ? "Your verification is complete. You'll receive a feedback call within 24 hours."
          : "Your verification has been recorded. Please review the validation feedback above."
      };

      res.status(200).json(response);

    } catch (error: any) {
      console.error('Verification submission error:', error);

      // Handle specific validation errors
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_FAILED',
          message: error.message,
          details: error.details
        });
      }

      if (error.code === 'SESSION_NOT_FOUND') {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Invalid session token'
        });
      }

      // Generic server error
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again'
      });
    }
  }
);

export { router as verificationSubmitRouter };