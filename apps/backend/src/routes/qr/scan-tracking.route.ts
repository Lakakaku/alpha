import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { QRManagementService } from '../../services/qr/qr-management.service.js';
import { QRScanValidation } from '../../types/qr.types.js';
import { AppError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { validateRequest } from '../../middleware/validation.js';

/**
 * QR Code Scan Tracking Routes
 * 
 * Handles recording of QR code scans with fraud detection,
 * rate limiting, and real-time analytics updates.
 * 
 * Features:
 * - Real-time scan recording
 * - Fraud detection and bot prevention
 * - Rate limiting per session and IP
 * - Anonymous scan support
 * - Geo-location tracking
 * - Device fingerprinting
 */

const router = Router();

// Rate limiting for scan tracking
const scanRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 scans per minute per IP
  message: {
    error: 'Too many scan attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use session ID if available, fallback to IP
    return req.body?.sessionId || req.ip;
  }
});

// Strict rate limiting for suspicious behavior
const strictScanRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // 2 scans per 5 minutes for suspicious sessions
  message: {
    error: 'Suspicious activity detected. Access temporarily restricted.',
    code: 'SUSPICIOUS_ACTIVITY'
  },
  skip: (req) => {
    // Only apply to requests flagged as suspicious
    return !req.body?.suspicious;
  }
});

// Request validation schema
const scanRequestSchema = z.object({
  storeId: z.string().uuid('Invalid store ID format'),
  qrCode: z.string().min(1, 'QR code is required'),
  sessionId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  referrer: z.string().url().optional(),
  timestamp: z.string().datetime().optional(),
  geolocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().positive().optional()
  }).optional(),
  deviceInfo: z.object({
    screen: z.object({
      width: z.number().positive(),
      height: z.number().positive()
    }).optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    platform: z.string().optional()
  }).optional(),
  source: z.enum(['direct', 'social', 'email', 'search', 'other']).optional()
});

/**
 * @openapi
 * /qr/scan:
 *   post:
 *     summary: Record QR code scan event
 *     description: |
 *       Records a QR code scan event with fraud detection and analytics tracking.
 *       Supports anonymous scanning with optional user context.
 *     tags:
 *       - QR Code Tracking
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeId
 *               - qrCode
 *             properties:
 *               storeId:
 *                 type: string
 *                 format: uuid
 *                 description: Store identifier
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               qrCode:
 *                 type: string
 *                 description: QR code content or identifier
 *                 example: "VCL-550e8400-e29b-41d4-a716-446655440000-20240920"
 *               sessionId:
 *                 type: string
 *                 description: Anonymous session identifier
 *                 example: "sess_abc123def456"
 *               userAgent:
 *                 type: string
 *                 description: Browser user agent string
 *                 example: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: Client IP address
 *                 example: "192.168.1.100"
 *               referrer:
 *                 type: string
 *                 format: uri
 *                 description: Referring URL
 *                 example: "https://google.com"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Scan timestamp (ISO 8601)
 *                 example: "2024-09-20T14:30:00Z"
 *               geolocation:
 *                 type: object
 *                 description: Optional geolocation data
 *                 properties:
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                     example: 37.7749
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                     example: -122.4194
 *                   accuracy:
 *                     type: number
 *                     minimum: 0
 *                     example: 10.5
 *               deviceInfo:
 *                 type: object
 *                 description: Device information for analytics
 *                 properties:
 *                   screen:
 *                     type: object
 *                     properties:
 *                       width:
 *                         type: number
 *                         example: 1920
 *                       height:
 *                         type: number
 *                         example: 1080
 *                   timezone:
 *                     type: string
 *                     example: "America/Los_Angeles"
 *                   language:
 *                     type: string
 *                     example: "en-US"
 *                   platform:
 *                     type: string
 *                     example: "iPhone"
 *               source:
 *                 type: string
 *                 enum: [direct, social, email, search, other]
 *                 description: Traffic source
 *                 example: "direct"
 *     responses:
 *       200:
 *         description: Scan recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 scanId:
 *                   type: string
 *                   format: uuid
 *                   description: Unique scan event ID
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Server-recorded timestamp
 *                   example: "2024-09-20T14:30:00.123Z"
 *                 validation:
 *                   type: object
 *                   description: Scan validation results
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                       example: true
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     storeMatches:
 *                       type: boolean
 *                       example: true
 *                     inTransition:
 *                       type: boolean
 *                       example: false
 *                 fraudDetection:
 *                   type: object
 *                   description: Fraud detection results
 *                   properties:
 *                     riskScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       example: 15
 *                     flags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     action:
 *                       type: string
 *                       enum: [allow, warn, block]
 *                       example: "allow"
 *                 nextStep:
 *                   type: object
 *                   description: Customer journey next step
 *                   properties:
 *                     action:
 *                       type: string
 *                       enum: [redirect, call, error]
 *                       example: "redirect"
 *                     url:
 *                       type: string
 *                       format: uri
 *                       example: "https://customer.vocilia.com/feedback/550e8400"
 *                     message:
 *                       type: string
 *                       example: "Redirecting to feedback form..."
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Store or QR code not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/scan', 
  scanRateLimit,
  strictScanRateLimit,
  validateRequest(scanRequestSchema),
  async (req, res, next) => {
    try {
      const {
        storeId,
        qrCode,
        sessionId,
        userAgent,
        ipAddress,
        referrer,
        timestamp,
        geolocation,
        deviceInfo,
        source
      } = req.body;

      // Get user context if authenticated
      const userId = req.user?.id || null;
      const businessId = req.user?.businessId || null;

      // Use provided IP or extract from request
      const clientIp = ipAddress || req.ip || req.connection.remoteAddress;
      const clientUserAgent = userAgent || req.get('User-Agent');

      // Prepare scan event data
      const scanEvent = {
        storeId,
        qrCode,
        userId,
        businessId,
        sessionId: sessionId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ipAddress: clientIp,
        userAgent: clientUserAgent,
        referrer,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        geolocation,
        deviceInfo,
        source: source || 'direct'
      };

      logger.info('Processing QR scan event', {
        storeId,
        qrCode: qrCode.substring(0, 20) + '...',
        sessionId: scanEvent.sessionId,
        userId,
        ipAddress: clientIp
      });

      // Initialize QR management service
      const qrService = await QRManagementService.create();

      // Record the scan with fraud detection
      const result = await qrService.recordScan(scanEvent);

      // Log fraud detection results
      if (result.fraudDetection.riskScore > 50) {
        logger.warn('High-risk scan detected', {
          scanId: result.scanId,
          riskScore: result.fraudDetection.riskScore,
          flags: result.fraudDetection.flags,
          storeId,
          sessionId: scanEvent.sessionId
        });
      }

      // Determine next step based on validation
      let nextStep;
      if (!result.validation.isValid) {
        nextStep = {
          action: 'error',
          message: 'Invalid QR code. Please try scanning again or contact support.',
          url: null
        };
      } else if (result.fraudDetection.action === 'block') {
        nextStep = {
          action: 'error',
          message: 'Scan could not be processed. Please try again later.',
          url: null
        };
      } else {
        // Generate customer feedback URL
        const customerBaseUrl = process.env.CUSTOMER_APP_URL || 'https://customer.vocilia.com';
        nextStep = {
          action: 'redirect',
          message: 'Redirecting to feedback form...',
          url: `${customerBaseUrl}/feedback/${storeId}?scan=${result.scanId}`
        };
      }

      // Success response
      res.status(200).json({
        success: true,
        scanId: result.scanId,
        timestamp: result.timestamp,
        validation: result.validation,
        fraudDetection: {
          riskScore: result.fraudDetection.riskScore,
          flags: result.fraudDetection.flags,
          action: result.fraudDetection.action
        },
        nextStep
      });

      logger.info('QR scan processed successfully', {
        scanId: result.scanId,
        storeId,
        action: nextStep.action,
        riskScore: result.fraudDetection.riskScore
      });

    } catch (error) {
      logger.error('Error processing QR scan', {
        error: error.message,
        stack: error.stack,
        storeId: req.body?.storeId,
        sessionId: req.body?.sessionId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to process QR scan',
        500,
        'SCAN_PROCESSING_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

export default router;