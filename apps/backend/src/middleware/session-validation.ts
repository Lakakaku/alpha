import { Request, Response, NextFunction } from 'express';
import { qrVerificationManager } from '../services/qr-verification-manager';

declare global {
  namespace Express {
    interface Request {
      sessionToken?: string;
      verificationSession?: any;
    }
  }
}

/**
 * Middleware to validate session tokens for verification endpoints
 */
export function sessionValidationMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionToken = req.headers['x-session-token'] as string;

      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Session token is required'
        });
      }

      // Validate session token format
      if (sessionToken.length < 32 || sessionToken.length > 64) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Invalid session token format'
        });
      }

      // Get and validate session
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

      // Check if session is in valid state
      if (session.status !== 'pending') {
        return res.status(409).json({
          success: false,
          error: 'SESSION_INVALID_STATE',
          message: 'Session is not in a valid state for verification'
        });
      }

      // Attach session data to request
      req.sessionToken = sessionToken;
      req.verificationSession = session;

      next();
    } catch (error) {
      console.error('Session validation error:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Session validation failed'
      });
    }
  };
}

/**
 * Middleware to validate session tokens with different requirements
 */
export function optionalSessionValidation() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionToken = req.headers['x-session-token'] as string;

      if (sessionToken) {
        const session = await qrVerificationManager.getSessionByToken(sessionToken);
        if (session && !session.isExpired()) {
          req.sessionToken = sessionToken;
          req.verificationSession = session;
        }
      }

      next();
    } catch (error) {
      console.error('Optional session validation error:', error);
      // Don't fail the request for optional validation
      next();
    }
  };
}