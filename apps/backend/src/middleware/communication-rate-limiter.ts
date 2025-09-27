import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { supabase } from '@vocilia/database';
import { createClient } from 'redis';

// Types for rate limiting
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

interface SMSRateLimitTracker {
  phone: string;
  count: number;
  windowStart: Date;
  isBlocked: boolean;
  blockUntil?: Date;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'admin' | 'customer' | 'business';
    phone?: string;
  };
}

// Redis client for distributed rate limiting
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => {
  console.error('Redis rate limiter error:', err);
});

// Connect Redis if not already connected
const ensureRedisConnection = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
};

// General API rate limiter
export const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'), // 1 hour
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per hour
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin users with valid tokens
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      // This is a simplified check - actual token validation happens in auth middleware
      return true;
    }
    return false;
  }
});

// SMS-specific rate limiter with phone number tracking
export const smsRateLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await ensureRedisConnection();

    const phone = req.body.phone || req.user?.phone;
    const isAdmin = req.user?.type === 'admin';

    // Skip SMS rate limiting for admin users
    if (isAdmin) {
      return next();
    }

    if (!phone) {
      return res.status(400).json({
        error: 'Phone number required for SMS rate limiting',
        code: 'PHONE_REQUIRED'
      });
    }

    const rateLimitKey = `sms_rate_limit:${phone}`;
    const blockKey = `sms_blocked:${phone}`;
    const windowMs = parseInt(process.env.SMS_RATE_LIMIT_WINDOW_MS || '60000'); // 1 minute
    const maxSMS = parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '5'); // 5 SMS per minute
    const blockDurationMs = parseInt(process.env.SMS_BLOCK_DURATION_MS || '3600000'); // 1 hour

    // Check if phone is currently blocked
    const isBlocked = await redis.get(blockKey);
    if (isBlocked) {
      const blockUntil = new Date(parseInt(isBlocked));
      return res.status(429).json({
        error: 'Phone number temporarily blocked due to excessive SMS requests',
        code: 'SMS_PHONE_BLOCKED',
        blockUntil: blockUntil.toISOString(),
        retryAfter: Math.ceil((blockUntil.getTime() - Date.now()) / 1000)
      });
    }

    // Get current rate limit data
    const currentData = await redis.get(rateLimitKey);
    const now = Date.now();
    
    let rateLimitTracker: SMSRateLimitTracker;

    if (currentData) {
      rateLimitTracker = JSON.parse(currentData);
      
      // Reset window if expired
      if (now - new Date(rateLimitTracker.windowStart).getTime() > windowMs) {
        rateLimitTracker = {
          phone,
          count: 0,
          windowStart: new Date(now),
          isBlocked: false
        };
      }
    } else {
      rateLimitTracker = {
        phone,
        count: 0,
        windowStart: new Date(now),
        isBlocked: false
      };
    }

    // Increment count
    rateLimitTracker.count++;

    // Check if limit exceeded
    if (rateLimitTracker.count > maxSMS) {
      // Block the phone number
      rateLimitTracker.isBlocked = true;
      rateLimitTracker.blockUntil = new Date(now + blockDurationMs);

      // Set block in Redis
      await redis.setEx(blockKey, Math.ceil(blockDurationMs / 1000), rateLimitTracker.blockUntil.getTime().toString());

      // Log abuse attempt
      await supabase
        .from('communication_logs')
        .insert({
          phone,
          log_type: 'rate_limit_violation',
          channel: 'sms',
          content: JSON.stringify({
            requests_in_window: rateLimitTracker.count,
            window_start: rateLimitTracker.windowStart,
            blocked_until: rateLimitTracker.blockUntil
          }),
          metadata: {
            ip: req.ip,
            user_agent: req.headers['user-agent'],
            rate_limit_window_ms: windowMs,
            max_requests: maxSMS
          }
        });

      return res.status(429).json({
        error: 'SMS rate limit exceeded. Phone number has been temporarily blocked.',
        code: 'SMS_RATE_LIMIT_EXCEEDED',
        blockUntil: rateLimitTracker.blockUntil.toISOString(),
        retryAfter: Math.ceil(blockDurationMs / 1000)
      });
    }

    // Update rate limit data
    await redis.setEx(rateLimitKey, Math.ceil(windowMs / 1000), JSON.stringify(rateLimitTracker));

    // Add rate limit headers
    res.set({
      'X-SMS-RateLimit-Limit': maxSMS.toString(),
      'X-SMS-RateLimit-Remaining': Math.max(0, maxSMS - rateLimitTracker.count).toString(),
      'X-SMS-RateLimit-Reset': new Date(new Date(rateLimitTracker.windowStart).getTime() + windowMs).toISOString()
    });

    next();
  } catch (error) {
    console.error('SMS rate limit error:', error);
    // On error, allow the request but log the issue
    await supabase
      .from('communication_logs')
      .insert({
        phone: req.body.phone || 'unknown',
        log_type: 'rate_limit_error',
        channel: 'sms',
        content: JSON.stringify({ error: error.message }),
        metadata: {
          ip: req.ip,
          user_agent: req.headers['user-agent']
        }
      });
    
    next();
  }
};

// Support ticket rate limiter
export const supportTicketRateLimit = rateLimit({
  windowMs: parseInt(process.env.SUPPORT_RATE_LIMIT_WINDOW_MS || '3600000'), // 1 hour
  max: parseInt(process.env.SUPPORT_RATE_LIMIT_MAX_TICKETS || '10'), // 10 tickets per hour
  message: {
    error: 'Too many support tickets created. Please wait before creating another ticket.',
    code: 'SUPPORT_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?.id || req.ip;
  },
  skip: (req: AuthenticatedRequest) => {
    // Skip rate limiting for admin users
    return req.user?.type === 'admin';
  }
});

// Template management rate limiter (admin only)
export const templateRateLimit = rateLimit({
  windowMs: parseInt(process.env.TEMPLATE_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.TEMPLATE_RATE_LIMIT_MAX_REQUESTS || '30'), // 30 requests per minute
  message: {
    error: 'Too many template management requests. Please slow down.',
    code: 'TEMPLATE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id || req.ip;
  }
});

// Webhook rate limiter (more permissive for external services)
export const webhookRateLimit = rateLimit({
  windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per minute
  message: {
    error: 'Webhook rate limit exceeded',
    code: 'WEBHOOK_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by source IP for webhooks
    return req.ip;
  }
});

// Abuse detection middleware
export const abuseDetection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await ensureRedisConnection();

    const phone = req.body.phone || req.user?.phone;
    const userId = req.user?.id;
    const ip = req.ip;

    // Skip for admin users
    if (req.user?.type === 'admin') {
      return next();
    }

    const abuseKey = `abuse_detection:${phone || ip}`;
    const abuseThreshold = parseInt(process.env.ABUSE_DETECTION_THRESHOLD || '50'); // 50 requests
    const abuseWindowMs = parseInt(process.env.ABUSE_DETECTION_WINDOW_MS || '86400000'); // 24 hours
    const abuseBlockDurationMs = parseInt(process.env.ABUSE_BLOCK_DURATION_MS || '86400000'); // 24 hours

    // Get abuse tracking data
    const abuseData = await redis.get(abuseKey);
    const now = Date.now();

    let abuseTracker = {
      count: 0,
      windowStart: now,
      isBlocked: false,
      blockUntil: null as number | null
    };

    if (abuseData) {
      abuseTracker = JSON.parse(abuseData);
      
      // Reset window if expired
      if (now - abuseTracker.windowStart > abuseWindowMs) {
        abuseTracker = {
          count: 0,
          windowStart: now,
          isBlocked: false,
          blockUntil: null
        };
      }

      // Check if still blocked
      if (abuseTracker.isBlocked && abuseTracker.blockUntil && now < abuseTracker.blockUntil) {
        return res.status(429).json({
          error: 'Account temporarily blocked due to abuse detection',
          code: 'ABUSE_DETECTED',
          blockUntil: new Date(abuseTracker.blockUntil).toISOString(),
          retryAfter: Math.ceil((abuseTracker.blockUntil - now) / 1000)
        });
      }

      // Unblock if block period expired
      if (abuseTracker.isBlocked && abuseTracker.blockUntil && now >= abuseTracker.blockUntil) {
        abuseTracker.isBlocked = false;
        abuseTracker.blockUntil = null;
        abuseTracker.count = 0;
        abuseTracker.windowStart = now;
      }
    }

    // Increment abuse counter
    abuseTracker.count++;

    // Check for abuse threshold
    if (abuseTracker.count > abuseThreshold) {
      abuseTracker.isBlocked = true;
      abuseTracker.blockUntil = now + abuseBlockDurationMs;

      // Log severe abuse
      await supabase
        .from('communication_logs')
        .insert({
          phone: phone || null,
          log_type: 'abuse_detected',
          channel: 'api',
          content: JSON.stringify({
            requests_in_window: abuseTracker.count,
            threshold: abuseThreshold,
            blocked_until: new Date(abuseTracker.blockUntil).toISOString()
          }),
          metadata: {
            ip,
            user_id: userId,
            user_agent: req.headers['user-agent'],
            endpoint: req.path,
            window_ms: abuseWindowMs
          }
        });

      await redis.setEx(abuseKey, Math.ceil(abuseBlockDurationMs / 1000), JSON.stringify(abuseTracker));

      return res.status(429).json({
        error: 'Account blocked due to abuse detection. Contact support if you believe this is an error.',
        code: 'ABUSE_DETECTED',
        blockUntil: new Date(abuseTracker.blockUntil).toISOString(),
        retryAfter: Math.ceil(abuseBlockDurationMs / 1000)
      });
    }

    // Update abuse tracking
    await redis.setEx(abuseKey, Math.ceil(abuseWindowMs / 1000), JSON.stringify(abuseTracker));

    next();
  } catch (error) {
    console.error('Abuse detection error:', error);
    // On error, allow the request but log the issue
    next();
  }
};

// Export default rate limiter configuration
export const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
};

// Cleanup function to close Redis connection
export const cleanup = async () => {
  if (redis.isOpen) {
    await redis.quit();
  }
};