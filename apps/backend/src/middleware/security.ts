import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '../config';

export const securityMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", config.supabase.url],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
    reportOnly: config.server.env === 'development',
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: {
    policy: "require-corp"
  },

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: {
    policy: "same-origin"
  },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  },

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },

  // Expect-CT (Certificate Transparency)
  expectCt: {
    maxAge: 86400,
    enforce: config.server.env === 'production',
    reportUri: undefined
  },

  // Feature Policy / Permissions Policy
  permittedCrossDomainPolicies: false,

  // Frameguard (X-Frame-Options)
  frameguard: {
    action: 'deny'
  },

  // Hide Powered-By header
  hidePoweredBy: true,

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // Don't sniff MIME types
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  },

  // X-XSS-Protection
  xssFilter: true
});

// Additional custom security headers
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Cache Control for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Custom security headers
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Served-By', 'Vocilia-API');

  // Rate limit information headers (will be set by rate limiter)
  // res.setHeader('X-RateLimit-Limit', 'value');
  // res.setHeader('X-RateLimit-Remaining', 'value');
  // res.setHeader('X-RateLimit-Reset', 'value');

  // Remove sensitive headers that might leak information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Environment-specific headers
  if (config.server.env === 'production') {
    // Strict transport security for HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Prevent embedding in frames
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Feature policy for production
    res.setHeader('Permissions-Policy', 
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );
  } else {
    // Development-specific headers
    res.setHeader('X-Environment', 'development');
  }

  next();
}

// Security monitoring middleware
export function securityMonitoring(req: Request, res: Response, next: NextFunction): void {
  // Log suspicious activity
  const suspiciousPatterns = [
    /\.\.\//,  // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /data:text\/html/i, // Data URI XSS
  ];

  const requestContent = `${req.url} ${JSON.stringify(req.body || {})} ${JSON.stringify(req.query)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestContent)) {
      console.warn('Suspicious request detected:', {
        pattern: pattern.toString(),
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      });
      
      // In production, you might want to block these requests
      if (config.server.env === 'production' && config.security?.blockSuspiciousRequests) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Request contains suspicious content'
        });
      }
      break;
    }
  }

  next();
}

// Rate limiting information headers (to be used with rate limiter)
export function setRateLimitHeaders(req: Request, res: Response, limit: number, remaining: number, reset: Date): void {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(reset.getTime() / 1000));
}

export default securityMiddleware;