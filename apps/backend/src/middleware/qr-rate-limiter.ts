import { Request, Response, NextFunction } from 'express';
import { QRDatabase } from '../config/qr-database';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class QRRateLimiter {
  private store: RateLimitStore = {};
  private db: QRDatabase;

  constructor() {
    this.db = new QRDatabase();

    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Combine IP and first part of user agent for more specific rate limiting
    const userAgentPrefix = userAgent.split(' ')[0] || 'unknown';
    return `${ip}:${userAgentPrefix}`;
  }

  createMiddleware(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.getKey(req);
        const now = Date.now();

        // Get or create rate limit entry
        if (!this.store[key] || this.store[key].resetTime < now) {
          this.store[key] = {
            count: 0,
            resetTime: now + config.windowMs
          };
        }

        const entry = this.store[key];

        // Check if rate limit exceeded
        if (entry.count >= config.maxRequests) {
          // Log rate limit violation for fraud detection
          const storeId = req.params.storeId;
          if (storeId) {
            await this.logFraudAttempt(storeId, key, 'rate_limit_exceeded');
          }

          return res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: config.message,
              retryAfter: Math.ceil((entry.resetTime - now) / 1000)
            }
          });
        }

        // Increment counter
        entry.count++;

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, config.maxRequests - entry.count).toString(),
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
        });

        // Skip incrementing on successful requests if configured
        if (config.skipSuccessfulRequests) {
          const originalSend = res.json;
          res.json = function(this: Response, data: any) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              entry.count = Math.max(0, entry.count - 1);
            }
            return originalSend.call(this, data);
          };
        }

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // Continue processing even if rate limiter fails
        next();
      }
    };
  }

  private async logFraudAttempt(storeId: string, clientKey: string, reason: string) {
    try {
      const [ip, userAgent] = clientKey.split(':');

      await this.db.createFraudDetectionLog({
        store_id: storeId,
        ip_address: ip,
        user_agent: userAgent,
        session_token: null,
        risk_factors: [reason],
        access_timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log fraud attempt:', error);
    }
  }
}

// Pre-configured middleware instances
const rateLimiter = new QRRateLimiter();

// QR verification rate limiter (10 requests per hour per IP)
export const qrVerificationRateLimit = rateLimiter.createMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Too many QR verification attempts. Please try again later.',
  skipSuccessfulRequests: true
});

// Verification submission rate limiter (5 attempts per 15 minutes per IP)
export const verificationSubmissionRateLimit = rateLimiter.createMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many verification attempts. Please wait before trying again.',
  skipSuccessfulRequests: false
});

// Admin endpoints rate limiter (100 requests per hour per IP)
export const adminRateLimit = rateLimiter.createMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100,
  message: 'Admin API rate limit exceeded. Please try again later.',
  skipSuccessfulRequests: true
});