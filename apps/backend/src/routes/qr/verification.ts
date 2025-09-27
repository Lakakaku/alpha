import express from 'express';
import { qrVerificationManager } from '../../services/qr-verification-manager';
import { DatabaseValidator } from '../../utils/database-validation';
import { qrVerificationRateLimit } from '../../middleware/qr-rate-limiter';
import { validateStoreId, validateQRParams, logAccess } from '../../middleware/qr-auth.middleware';
import { securityHeaders, corsHeaders, cacheHeaders } from '../../middleware/security-headers';
import type { 
  QRVerificationRequest,
  QRVerificationResponse 
} from '@vocilia/types';

const router = express.Router();

// Apply security middleware to all routes
router.use(securityHeaders());
router.use(corsHeaders());
router.use(cacheHeaders());

/**
 * POST /api/v1/qr/verify/:storeId
 * QR verification endpoint - creates verification session
 */
router.post('/verify/:storeId', 
  qrVerificationRateLimit,
  validateStoreId(),
  validateQRParams(),
  logAccess(),
  async (req, res) => {
  try {
    const { storeId } = req.params;
    const qrParams = {
      v: req.query.v as string,
      t: req.query.t as string
    };
    
    // Store ID and QR parameters are validated by middleware

    // Validate and extract request body
    const { ip_address, user_agent } = req.body;

    if (!ip_address || !user_agent) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: ip_address and user_agent'
        }
      });
    }

    // Validate IP address format
    if (!DatabaseValidator.validateIpAddress(ip_address)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid IP address format'
        }
      });
    }

    const request: QRVerificationRequest = {
      ip_address,
      user_agent
    };

    // Handle QR verification
    const response: QRVerificationResponse = await qrVerificationManager.handleQRVerification(
      storeId,
      qrParams,
      request
    );

    res.status(200).json(response);

  } catch (error: any) {
    console.error('QR verification error:', error);

    // Handle specific error types
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.'
        }
      });
    }

    if (error.code === 'FRAUD_DETECTION_BLOCKED') {
      return res.status(403).json({
        error: {
          code: 'FRAUD_DETECTION_BLOCKED',
          message: 'Access temporarily blocked due to suspicious activity'
        }
      });
    }

    if (error.message === 'Store not found') {
      return res.status(404).json({
        error: {
          code: 'STORE_NOT_FOUND',
          message: 'The specified store could not be found or is not active'
        }
      });
    }

    if (error.message.includes('Invalid')) {
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
        message: 'An unexpected error occurred while processing your request'
      }
    });
  }
});

/**
 * GET /api/v1/qr/verify/:storeId/health
 * Health check endpoint for QR verification
 */
router.get('/verify/:storeId/health', async (req, res) => {
  try {
    const { storeId } = req.params;

    // Validate store ID format
    if (!DatabaseValidator.validateStoreId(storeId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STORE_ID',
          message: 'Store ID must be a valid UUID format'
        }
      });
    }

    // Check if store exists and is active
    const storeInfo = await qrVerificationManager.getServices().database.getStoreById(storeId);
    
    if (!storeInfo) {
      return res.status(404).json({
        error: {
          code: 'STORE_NOT_FOUND',
          message: 'Store not found or not active'
        }
      });
    }

    // Perform health check
    const healthCheck = await qrVerificationManager.healthCheck();

    res.status(healthCheck.healthy ? 200 : 503).json({
      status: healthCheck.healthy ? 'healthy' : 'unhealthy',
      store_info: storeInfo,
      services: healthCheck.services,
      timestamp: healthCheck.timestamp
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check could not be completed'
      }
    });
  }
});

export { router as qrVerificationRouter };