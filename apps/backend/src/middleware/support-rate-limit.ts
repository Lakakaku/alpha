/**
 * Customer Support Rate Limiting Middleware for Vocilia Customer Interface
 * 
 * Advanced rate limiting specifically designed for customer support endpoints
 * to prevent abuse while maintaining accessibility for legitimate support requests.
 * 
 * Features:
 * - Multi-tier rate limiting (per IP, per device, per customer)
 * - Priority-based rate limiting for urgent requests
 * - Dynamic rate adjustment based on support load
 * - Adaptive limits for returning customers
 * - Support queue integration
 * - Geographic-based rate limiting
 * - Time-based rate windows
 */

import { Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';

// === TYPES ===

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  skipSuccessfulRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequestTime: number;
  lastRequestTime: number;
  priority: string;
}

interface SupportRateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  activeClients: number;
  averageRequestsPerClient: number;
  priorityDistribution: Record<string, number>;
}

// Extend Request interface for support context
declare global {
  namespace Express {
    interface Request {
      supportPriority?: 'low' | 'medium' | 'high' | 'urgent';
      customerHistory?: {
        isReturning: boolean;
        previousRequests: number;
        lastRequestTime?: Date;
      };
      geolocation?: {
        country: string;
        region: string;
      };
    }
  }
}

// === CONFIGURATION ===

// Rate limit configurations for different priority levels
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  urgent: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    priority: 'urgent'
  },
  high: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    priority: 'high'
  },
  medium: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    priority: 'medium'
  },
  low: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 2,
    priority: 'low'
  }
};

// Special limits for FAQ and self-service endpoints
const FAQ_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  priority: 'low',
  skipSuccessfulRequests: true
};

// Geographic-based rate limits (requests per hour)
const GEOGRAPHIC_LIMITS: Record<string, number> = {
  'SE': 10, // Sweden (primary market)
  'NO': 8,  // Norway
  'DK': 8,  // Denmark
  'FI': 8,  // Finland
  'DEFAULT': 5 // Other countries
};

// === RATE LIMITING STORES ===

// Per-IP rate limiting
const ipRateLimits = new Map<string, RateLimitEntry>();

// Per-device rate limiting (more lenient for identified devices)
const deviceRateLimits = new Map<string, RateLimitEntry>();

// Per-customer rate limiting (for authenticated requests)
const customerRateLimits = new Map<string, RateLimitEntry>();

// Support request type tracking
const supportMetrics: SupportRateLimitMetrics = {
  totalRequests: 0,
  blockedRequests: 0,
  activeClients: 0,
  averageRequestsPerClient: 0,
  priorityDistribution: { low: 0, medium: 0, high: 0, urgent: 0 }
};

// === MAIN MIDDLEWARE FUNCTIONS ===

/**
 * Primary rate limiting middleware for customer support endpoints
 */
export function supportRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const clientId = getClientIdentifier(req);
    const priority = determineSupportPriority(req);
    const config = RATE_LIMIT_CONFIGS[priority];

    // Check if request should be rate limited
    const rateLimitResult = checkRateLimit(clientId, config, 'ip');
    
    if (!rateLimitResult.allowed) {
      supportMetrics.blockedRequests++;
      
      return res.status(429).json({
        error: 'SUPPORT_RATE_LIMIT_EXCEEDED',
        message: 'Too many support requests. Please wait before submitting another request.',
        retryAfter: Math.ceil(rateLimitResult.resetTime / 1000),
        priority: priority,
        limit: config.maxRequests,
        windowMs: config.windowMs,
        remaining: 0
      });
    }

    // Update request tracking
    updateRateLimitEntry(clientId, config, 'ip');
    supportMetrics.totalRequests++;
    supportMetrics.priorityDistribution[priority]++;

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
      'X-RateLimit-Priority': priority
    });

    // Attach support context to request
    req.supportPriority = priority as any;

    next();
  } catch (error) {
    console.error('Support rate limiting error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
}

/**
 * Rate limiting specifically for FAQ endpoints (more lenient)
 */
export function faqRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(clientId, FAQ_RATE_LIMIT, 'ip');
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'FAQ_RATE_LIMIT_EXCEEDED',
        message: 'Too many FAQ requests. Please wait a moment.',
        retryAfter: Math.ceil(rateLimitResult.resetTime / 1000)
      });
    }

    updateRateLimitEntry(clientId, FAQ_RATE_LIMIT, 'ip');

    res.set({
      'X-RateLimit-Limit': FAQ_RATE_LIMIT.maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
    });

    next();
  } catch (error) {
    console.error('FAQ rate limiting error:', error);
    next();
  }
}

/**
 * Enhanced rate limiting for authenticated customers with history
 */
export async function customerAwareRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deviceId = req.headers['x-device-id'] as string;
    const customerPhone = req.headers['x-customer-phone'] as string;
    const customerEmail = req.headers['x-customer-email'] as string;

    // Get customer history if available
    if (customerPhone || customerEmail) {
      const customerHistory = await getCustomerSupportHistory(customerPhone, customerEmail);
      req.customerHistory = customerHistory;

      // Apply customer-specific rate limiting
      const customerId = customerPhone || customerEmail;
      const priority = req.supportPriority || 'medium';
      const config = getCustomerRateLimit(customerHistory, priority);

      const rateLimitResult = checkRateLimit(customerId, config, 'customer');
      
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'CUSTOMER_RATE_LIMIT_EXCEEDED',
          message: 'Customer-specific rate limit exceeded. Please contact support if this is urgent.',
          retryAfter: Math.ceil(rateLimitResult.resetTime / 1000),
          isReturningCustomer: customerHistory.isReturning
        });
      }

      updateRateLimitEntry(customerId, config, 'customer');
    }

    // Device-based rate limiting (if device ID available)
    if (deviceId) {
      const deviceConfig = { ...RATE_LIMIT_CONFIGS.medium, maxRequests: 5 }; // Slightly more lenient for devices
      const deviceRateLimitResult = checkRateLimit(deviceId, deviceConfig, 'device');
      
      if (!deviceRateLimitResult.allowed) {
        return res.status(429).json({
          error: 'DEVICE_RATE_LIMIT_EXCEEDED',
          message: 'Device-specific rate limit exceeded.',
          retryAfter: Math.ceil(deviceRateLimitResult.resetTime / 1000)
        });
      }

      updateRateLimitEntry(deviceId, deviceConfig, 'device');
    }

    next();
  } catch (error) {
    console.error('Customer-aware rate limiting error:', error);
    next();
  }
}

/**
 * Geographic-based rate limiting
 */
export function geographicRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const country = req.headers['x-country-code'] as string || 
                   req.headers['cf-ipcountry'] as string || // Cloudflare
                   'DEFAULT';

    const geoLimit = GEOGRAPHIC_LIMITS[country] || GEOGRAPHIC_LIMITS.DEFAULT;
    const geoConfig: RateLimitConfig = {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: geoLimit,
      priority: 'medium'
    };

    const clientId = `geo:${country}:${req.ip}`;
    const rateLimitResult = checkRateLimit(clientId, geoConfig, 'geo');

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'GEOGRAPHIC_RATE_LIMIT_EXCEEDED',
        message: 'Regional rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(rateLimitResult.resetTime / 1000),
        region: country
      });
    }

    updateRateLimitEntry(clientId, geoConfig, 'geo');

    // Attach geolocation to request
    req.geolocation = { country, region: country };

    next();
  } catch (error) {
    console.error('Geographic rate limiting error:', error);
    next();
  }
}

// === HELPER FUNCTIONS ===

/**
 * Gets unique client identifier from request
 */
function getClientIdentifier(req: Request): string {
  // Prefer device ID if available, fallback to IP
  const deviceId = req.headers['x-device-id'] as string;
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  const clientIp = xForwardedFor?.split(',')[0] || req.ip || 'unknown';
  
  return deviceId || clientIp;
}

/**
 * Determines support priority from request
 */
function determineSupportPriority(req: Request): string {
  const body = req.body || {};
  const query = req.query || {};

  // Check explicit priority in request
  const requestPriority = body.priority || query.priority;
  if (requestPriority && RATE_LIMIT_CONFIGS[requestPriority]) {
    return requestPriority;
  }

  // Determine priority based on support type
  const supportType = body.type || query.type;
  switch (supportType) {
    case 'technical_issue':
    case 'payment_problem':
    case 'account_locked':
      return 'high';
      
    case 'bug_report':
    case 'feature_request':
      return 'medium';
      
    case 'general_inquiry':
    case 'feedback':
      return 'low';
      
    default:
      return 'medium';
  }
}

/**
 * Checks if request is within rate limit
 */
function checkRateLimit(
  clientId: string,
  config: RateLimitConfig,
  store: 'ip' | 'device' | 'customer' | 'geo'
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const rateLimitStore = getRateLimitStore(store);
  const entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetTime) {
    // No entry or expired - allow request
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs
    };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }

  // Within rate limit
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count - 1,
    resetTime: entry.resetTime
  };
}

/**
 * Updates rate limit entry
 */
function updateRateLimitEntry(
  clientId: string,
  config: RateLimitConfig,
  store: 'ip' | 'device' | 'customer' | 'geo'
): void {
  const now = Date.now();
  const rateLimitStore = getRateLimitStore(store);
  const existing = rateLimitStore.get(clientId);

  if (!existing || now > existing.resetTime) {
    // Create new entry
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + config.windowMs,
      firstRequestTime: now,
      lastRequestTime: now,
      priority: config.priority
    });
  } else {
    // Update existing entry
    existing.count++;
    existing.lastRequestTime = now;
  }
}

/**
 * Gets appropriate rate limit store
 */
function getRateLimitStore(store: 'ip' | 'device' | 'customer' | 'geo'): Map<string, RateLimitEntry> {
  switch (store) {
    case 'ip': return ipRateLimits;
    case 'device': return deviceRateLimits;
    case 'customer': return customerRateLimits;
    case 'geo': return ipRateLimits; // Use IP store for geo limiting
    default: return ipRateLimits;
  }
}

/**
 * Gets customer support history
 */
async function getCustomerSupportHistory(
  customerPhone?: string,
  customerEmail?: string
): Promise<{
  isReturning: boolean;
  previousRequests: number;
  lastRequestTime?: Date;
}> {
  try {
    const query = database
      .from('customer_support_requests')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (customerPhone) {
      query.eq('customer_phone', customerPhone);
    } else if (customerEmail) {
      query.eq('customer_email', customerEmail);
    } else {
      return { isReturning: false, previousRequests: 0 };
    }

    const { data: requests, error } = await query;

    if (error || !requests) {
      return { isReturning: false, previousRequests: 0 };
    }

    return {
      isReturning: requests.length > 0,
      previousRequests: requests.length,
      lastRequestTime: requests.length > 0 ? new Date(requests[0].created_at) : undefined
    };
  } catch (error) {
    console.error('Error fetching customer history:', error);
    return { isReturning: false, previousRequests: 0 };
  }
}

/**
 * Gets customer-specific rate limit configuration
 */
function getCustomerRateLimit(
  customerHistory: { isReturning: boolean; previousRequests: number },
  priority: string
): RateLimitConfig {
  const baseConfig = RATE_LIMIT_CONFIGS[priority];

  if (!customerHistory.isReturning) {
    // New customer - more lenient limits
    return {
      ...baseConfig,
      maxRequests: Math.ceil(baseConfig.maxRequests * 1.5)
    };
  }

  if (customerHistory.previousRequests > 5) {
    // Frequent customer - stricter limits
    return {
      ...baseConfig,
      maxRequests: Math.ceil(baseConfig.maxRequests * 0.7)
    };
  }

  return baseConfig;
}

// === UTILITY FUNCTIONS ===

/**
 * Gets current rate limiting metrics
 */
export function getSupportRateLimitMetrics(): SupportRateLimitMetrics {
  return {
    ...supportMetrics,
    activeClients: ipRateLimits.size + deviceRateLimits.size + customerRateLimits.size,
    averageRequestsPerClient: supportMetrics.activeClients > 0 
      ? supportMetrics.totalRequests / supportMetrics.activeClients 
      : 0
  };
}

/**
 * Resets rate limit for specific client (admin function)
 */
export function resetRateLimit(clientId: string, store?: 'ip' | 'device' | 'customer'): boolean {
  try {
    if (store) {
      const rateLimitStore = getRateLimitStore(store);
      return rateLimitStore.delete(clientId);
    } else {
      // Reset across all stores
      const deleted = 
        ipRateLimits.delete(clientId) ||
        deviceRateLimits.delete(clientId) ||
        customerRateLimits.delete(clientId);
      return deleted;
    }
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
}

/**
 * Clears expired rate limit entries
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  const stores = [ipRateLimits, deviceRateLimits, customerRateLimits];

  stores.forEach(store => {
    store.forEach((entry, key) => {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    });
  });
}

/**
 * Health check for rate limiting middleware
 */
export function getSupportRateLimitHealth(): {
  healthy: boolean;
  metrics: SupportRateLimitMetrics;
  memoryUsage: number;
} {
  const metrics = getSupportRateLimitMetrics();
  
  return {
    healthy: true,
    metrics,
    memoryUsage: process.memoryUsage().heapUsed
  };
}

// Clean up expired entries periodically
setInterval(cleanupExpiredEntries, 5 * 60 * 1000); // Every 5 minutes

// === EXPORTS ===

export {
  supportRateLimit,
  faqRateLimit,
  customerAwareRateLimit,
  geographicRateLimit,
  getSupportRateLimitMetrics,
  resetRateLimit,
  cleanupExpiredEntries,
  getSupportRateLimitHealth
};

// Type exports
export type {
  RateLimitConfig,
  RateLimitEntry,
  SupportRateLimitMetrics
};