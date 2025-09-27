import { Request, Response, NextFunction } from 'express';
import { QRDatabase } from '../config/qr-database';
import { DatabaseValidator } from '../utils/database-validation';

declare global {
  namespace Express {
    interface Request {
      sessionToken?: string;
      session?: {
        session_token: string;
        store_id: string;
        status: string;
        expires_at: Date;
        created_at: Date;
      };
    }
  }
}

export class QRAuthMiddleware {
  private db: QRDatabase;

  constructor() {
    this.db = new QRDatabase();
  }

  /**
   * Validate and extract session token from request headers
   */
  validateSessionToken() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionToken = req.headers['x-session-token'] as string;

        if (!sessionToken) {
          return res.status(401).json({
            error: {
              code: 'MISSING_SESSION_TOKEN',
              message: 'Session token is required in X-Session-Token header'
            }
          });
        }

        // Validate session token format
        const validationResult = DatabaseValidator.validateSessionToken(sessionToken);
        if (!validationResult.success) {
          return res.status(401).json({
            error: {
              code: 'INVALID_SESSION_TOKEN',
              message: 'Invalid session token format'
            }
          });
        }

        // Get session details from database
        const session = await this.db.getVerificationSession(sessionToken);
        if (!session) {
          return res.status(401).json({
            error: {
              code: 'INVALID_SESSION_TOKEN',
              message: 'Session not found or invalid'
            }
          });
        }

        // Check if session is expired
        if (new Date() > session.expires_at) {
          // Update session status to expired
          await this.db.updateVerificationSessionStatus(sessionToken, 'expired');

          return res.status(401).json({
            error: {
              code: 'SESSION_EXPIRED',
              message: 'Session has expired. Please scan a new QR code.'
            }
          });
        }

        // Check if session is in valid state
        if (session.status !== 'pending' && session.status !== 'completed') {
          return res.status(401).json({
            error: {
              code: 'INVALID_SESSION_STATE',
              message: `Session is in ${session.status} state and cannot be used`
            }
          });
        }

        // Attach session to request
        req.sessionToken = sessionToken;
        req.session = session;

        next();
      } catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to validate session'
          }
        });
      }
    };
  }

  /**
   * Validate store ID parameter
   */
  validateStoreId() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { storeId } = req.params;

        if (!storeId) {
          return res.status(400).json({
            error: {
              code: 'MISSING_STORE_ID',
              message: 'Store ID is required'
            }
          });
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(storeId)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_STORE_ID',
              message: 'Store ID must be a valid UUID'
            }
          });
        }

        // Check if store exists and is active
        const store = await this.db.getStoreById(storeId);
        if (!store) {
          return res.status(404).json({
            error: {
              code: 'STORE_NOT_FOUND',
              message: 'Store not found or inactive'
            }
          });
        }

        next();
      } catch (error) {
        console.error('Store validation error:', error);
        return res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to validate store'
          }
        });
      }
    };
  }

  /**
   * Validate QR parameters (version and timestamp)
   */
  validateQRParams() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const { v: version, t: timestamp } = req.query;

        if (!version || !timestamp) {
          return res.status(400).json({
            error: {
              code: 'INVALID_QR_PARAMETERS',
              message: 'Both version (v) and timestamp (t) parameters are required'
            }
          });
        }

        // Validate version format (should be a number)
        if (!/^\d+$/.test(version as string)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_QR_PARAMETERS',
              message: 'Version parameter must be a valid number'
            }
          });
        }

        // Validate timestamp format (should be Unix timestamp)
        if (!/^\d+$/.test(timestamp as string)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_QR_PARAMETERS',
              message: 'Timestamp parameter must be a valid Unix timestamp'
            }
          });
        }

        // Check if QR is not too old (24 hours)
        const qrTime = parseInt(timestamp as string) * 1000;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (now - qrTime > maxAge) {
          return res.status(400).json({
            error: {
              code: 'QR_CODE_EXPIRED',
              message: 'QR code has expired. Please scan a new one.'
            }
          });
        }

        next();
      } catch (error) {
        console.error('QR parameter validation error:', error);
        return res.status(500).json({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to validate QR parameters'
          }
        });
      }
    };
  }

  /**
   * Log access attempt for fraud detection
   */
  logAccess() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { storeId } = req.params;
        const forwarded = req.headers['x-forwarded-for'] as string;
        const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Log access attempt (in background, don't block request)
        setImmediate(async () => {
          try {
            await this.db.createFraudDetectionLog({
              store_id: storeId,
              ip_address: ip,
              user_agent: userAgent,
              session_token: req.sessionToken || null,
              risk_factors: ['qr_access'],
              access_timestamp: new Date()
            });
          } catch (error) {
            console.error('Failed to log access:', error);
          }
        });

        next();
      } catch (error) {
        console.error('Access logging error:', error);
        // Don't block request if logging fails
        next();
      }
    };
  }
}

// Export middleware instances
const qrAuth = new QRAuthMiddleware();

export const validateSessionToken = qrAuth.validateSessionToken();
export const validateStoreId = qrAuth.validateStoreId();
export const validateQRParams = qrAuth.validateQRParams();
export const logAccess = qrAuth.logAccess();