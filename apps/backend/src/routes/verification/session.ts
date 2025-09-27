import express from 'express';
import { qrVerificationManager } from '../../services/qr-verification-manager';
import { DatabaseValidator } from '../../utils/database-validation';
import { securityHeaders } from '../../middleware/security-headers';
import type { SessionDetailsResponse } from '@vocilia/types';

const router = express.Router();

// Apply security middleware
router.use(securityHeaders());

/**
 * GET /api/v1/verification/session/:sessionToken
 * Get verification session details and store information
 */
router.get('/session/:sessionToken', async (req, res) => {
  try {
    const { sessionToken } = req.params;

    // Validate session token format
    if (!sessionToken || sessionToken.length < 32 || sessionToken.length > 64) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SESSION_TOKEN',
        message: 'Session token must be between 32 and 64 characters'
      });
    }

    // Get session details
    const session = await qrVerificationManager.getSessionByToken(sessionToken);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Verification session does not exist'
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

    // Get store information
    const storeInfo = await qrVerificationManager.getServices().database.getStoreById(session.store_id);
    if (!storeInfo) {
      return res.status(404).json({
        success: false,
        error: 'STORE_NOT_FOUND',
        message: 'Associated store could not be found'
      });
    }

    const response: SessionDetailsResponse = {
      session_id: session.id,
      store_info: {
        store_id: storeInfo.id,
        store_name: storeInfo.name,
        business_name: storeInfo.business_name || storeInfo.name,
        logo_url: storeInfo.logo_url || undefined
      },
      status: session.status,
      qr_version: session.qr_version,
      created_at: session.created_at.toISOString(),
      expires_at: session.getExpiryTime().toISOString()
    };

    res.status(200).json(response);

  } catch (error: any) {
    console.error('Session details error:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Verification session does not exist'
      });
    }

    if (error.message === 'Store not found') {
      return res.status(404).json({
        success: false,
        error: 'STORE_NOT_FOUND',
        message: 'Associated store could not be found'
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again'
    });
  }
});

export { router as verificationSessionRouter };