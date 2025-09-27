import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
});

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface AuthenticatedRequest extends Request {
  business?: {
    id: string;
    userId: string;
    storeIds: string[];
  };
}

// Default rate limit configurations for different AI operations
const RATE_LIMITS = {
  // AI call initiation - more restrictive
  CALL_INITIATION: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 calls per minute per business
    keyGenerator: (req: AuthenticatedRequest) => `ai_call_init:${req.business?.id}`,
  },
  
  // AI analysis operations - moderate limits
  ANALYSIS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 analysis requests per minute per business
    keyGenerator: (req: AuthenticatedRequest) => `ai_analysis:${req.business?.id}`,
  },
  
  // Business intelligence - generous limits
  BUSINESS_INTEL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per business
    keyGenerator: (req: AuthenticatedRequest) => `ai_business:${req.business?.id}`,
  },
  
  // Admin operations - very generous limits
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 requests per minute for admin
    keyGenerator: (req: AuthenticatedRequest) => `ai_admin:${req.business?.userId}`,
  },
  
  // Global rate limit per IP (DDoS protection)
  GLOBAL_IP: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute per IP
    keyGenerator: (req: Request) => `ai_global:${req.ip}`,
  },
} as const;

export const createRateLimiter = (config: RateLimitConfig) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = config.keyGenerator ? config.keyGenerator(req) : `default:${req.ip}`;
      const now = Date.now();
      const window = Math.floor(now / config.windowMs);
      const redisKey = `rate_limit:${key}:${window}`;

      // Get current count for this window
      const currentCount = await redis.incr(redisKey);
      
      // Set expiration on first request in window
      if (currentCount === 1) {
        await redis.expire(redisKey, Math.ceil(config.windowMs / 1000));
      }

      // Check if limit exceeded
      if (currentCount > config.maxRequests) {
        const resetTime = (window + 1) * config.windowMs;
        const remainingTime = Math.ceil((resetTime - now) / 1000);

        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          limit: config.maxRequests,
          current: currentCount,
          resetTime: new Date(resetTime).toISOString(),
          retryAfter: remainingTime
        });
        return;
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - currentCount).toString(),
        'X-RateLimit-Reset': new Date((window + 1) * config.windowMs).toISOString(),
      });

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      
      // If Redis is down, allow request but log error
      console.warn('Rate limiting bypassed due to Redis error');
      next();
    }
  };
};

// Pre-configured rate limiters for different AI operations
export const aiCallInitiationLimiter = createRateLimiter(RATE_LIMITS.CALL_INITIATION);
export const aiAnalysisLimiter = createRateLimiter(RATE_LIMITS.ANALYSIS);
export const businessIntelligenceLimiter = createRateLimiter(RATE_LIMITS.BUSINESS_INTEL);
export const adminOperationsLimiter = createRateLimiter(RATE_LIMITS.ADMIN);
export const globalIpLimiter = createRateLimiter(RATE_LIMITS.GLOBAL_IP);

// Composite rate limiter that applies multiple limits
export const compositeRateLimiter = (...limiters: Array<ReturnType<typeof createRateLimiter>>) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    for (const limiter of limiters) {
      await new Promise<void>((resolve, reject) => {
        limiter(req, res, (error) => {
          if (error) reject(error);
          else if (res.headersSent) reject(new Error('Rate limit exceeded'));
          else resolve();
        });
      });
    }
    next();
  };
};

// Cleanup function for graceful shutdown
export const closeRateLimiter = async (): Promise<void> => {
  await redis.disconnect();
};