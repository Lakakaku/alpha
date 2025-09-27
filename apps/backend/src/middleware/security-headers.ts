import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware for QR verification endpoints
 * Adds essential security headers to protect against common attacks
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection (though deprecated, still good for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy - limit referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy for API endpoints
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
    
    // Strict Transport Security (only if using HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Permissions Policy - restrict sensitive features
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Cross-Origin policies for API security
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    next();
  };
}

/**
 * CORS headers for QR verification endpoints
 * Allows specific origins and methods for customer app
 */
export function corsHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = [
      'https://customer.vocilia.com',
      'https://customer-staging.vocilia.com',
      process.env.CUSTOMER_APP_URL || 'http://localhost:3000'
    ].filter(Boolean);

    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token, User-Agent');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }
    
    next();
  };
}

/**
 * Cache control headers for security-sensitive endpoints
 */
export function cacheHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent caching of sensitive endpoints
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    next();
  };
}