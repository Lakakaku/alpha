import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  message?: string;  // Custom error message
  skipSuccessfulRequests?: boolean;  // Don't count successful requests
  skipFailedRequests?: boolean;  // Don't count failed requests
}

interface RequestInfo {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for production clusters)
const requestCounts = new Map<string, RequestInfo>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of requestCounts.entries()) {
    if (now > info.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = getClientKey(req);
    
    // Get or create request info for this client
    let requestInfo = requestCounts.get(key);
    
    if (!requestInfo || now > requestInfo.resetTime) {
      // Create new window
      requestInfo = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      requestCounts.set(key, requestInfo);
    }
    
    // Increment request count
    requestInfo.count++;
    
    // Set rate limit headers
    const remaining = Math.max(0, config.maxRequests - requestInfo.count);
    const resetTime = Math.ceil(requestInfo.resetTime / 1000);
    
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Window': config.windowMs.toString(),
    });
    
    // Check if limit exceeded
    if (requestInfo.count > config.maxRequests) {
      const retryAfter = Math.ceil((requestInfo.resetTime - now) / 1000);
      
      res.set({
        'Retry-After': retryAfter.toString(),
      });
      
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: config.message || 'Too many requests, please try again later',
        details: {
          limit: config.maxRequests,
          window: config.windowMs,
          retryAfter: retryAfter,
        },
      });
      return;
    }
    
    next();
  };
}

// Generate client key for rate limiting (IP + User ID if authenticated)
function getClientKey(req: Request): string {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.user?.id;
  
  if (userId) {
    return `user:${userId}`;
  }
  
  return `ip:${ip}`;
}

// Different rate limiters for different endpoints

// General API rate limiter (100 requests per 15 minutes)
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many API requests, please try again later',
});

// Authentication rate limiter (5 login attempts per 15 minutes)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later',
});

// Strict rate limiter for sensitive operations (10 requests per hour)
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  message: 'Rate limit exceeded for sensitive operations',
});

// Permissive rate limiter for health checks (1000 requests per minute)
export const healthCheckRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,
  message: 'Health check rate limit exceeded',
});

// Default rate limiter middleware
export const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Apply different rate limits based on endpoint
  const path = req.path;
  
  if (path.startsWith('/health')) {
    return healthCheckRateLimiter(req, res, next);
  }
  
  if (path.startsWith('/auth/login') || path.startsWith('/auth/refresh')) {
    return authRateLimiter(req, res, next);
  }
  
  if (path.includes('/businesses') && (req.method === 'POST' || req.method === 'DELETE')) {
    return strictRateLimiter(req, res, next);
  }
  
  // Default general rate limiter
  return generalRateLimiter(req, res, next);
};

// Custom rate limiter factory for specific needs
export function customRateLimiter(
  windowMs: number,
  maxRequests: number,
  message?: string
) {
  return createRateLimiter({
    windowMs,
    maxRequests,
    message,
  });
}

// Rate limiter for development (very permissive)
export const developmentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,
  message: 'Development rate limit exceeded (very permissive)',
});

// Environment-aware rate limiter
export const getEnvironmentRateLimiter = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development' || env === 'test') {
    console.log('Rate Limiter: Using development configuration (very permissive)');
    return developmentRateLimiter;
  }
  
  console.log('Rate Limiter: Using production configuration');
  return rateLimiterMiddleware;
};

export default getEnvironmentRateLimiter();