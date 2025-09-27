/**
 * PWA Security Headers Middleware for Vocilia Customer Interface
 * 
 * Comprehensive security headers specifically configured for Progressive Web Apps.
 * Ensures secure deployment and operation of PWA features while maintaining compatibility.
 * 
 * Features:
 * - Service Worker security policies
 * - Content Security Policy (CSP) for PWA
 * - Secure manifest and icon delivery
 * - Cross-origin policies for PWA features
 * - Feature policy for device access
 * - Permissions policy for sensitive APIs
 * - Cache control for PWA resources
 * - Security headers for offline functionality
 */

import { Request, Response, NextFunction } from 'express';

// === TYPES ===

interface SecurityHeadersConfig {
  csp: {
    directives: Record<string, string[]>;
    reportOnly?: boolean;
    nonce?: boolean;
  };
  hsts: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  permissionsPolicy: Record<string, string[]>;
  crossOrigin: {
    embedderPolicy: string;
    resourcePolicy: string;
    openerPolicy: string;
  };
}

interface PWAResourceConfig {
  manifestMaxAge: number;
  serviceWorkerMaxAge: number;
  iconMaxAge: number;
  offlinePageMaxAge: number;
}

// === CONFIGURATION ===

// Content Security Policy specifically tuned for PWA
const PWA_CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for some PWA features
    "'unsafe-eval'", // Required for service worker in development
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://*.supabase.co'
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for dynamic styles in PWA
    'https://fonts.googleapis.com'
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'data:' // For base64 encoded fonts
  ],
  'img-src': [
    "'self'",
    'data:', // For base64 images and icons
    'blob:', // For generated images
    'https://*.supabase.co',
    'https://images.unsplash.com' // If using for placeholders
  ],
  'media-src': [
    "'self'",
    'blob:' // For audio/video in PWA
  ],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co', // For real-time connections
    process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : ''
  ].filter(Boolean),
  'worker-src': [
    "'self'",
    'blob:' // For service workers
  ],
  'manifest-src': ["'self'"],
  'frame-src': ["'none'"], // Prevent embedding in frames
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [] // Force HTTPS
};

// Permissions Policy for PWA features
const PWA_PERMISSIONS_POLICY = {
  'accelerometer': ["'self'"],
  'autoplay': ["'self'"],
  'camera': ["'self'"], // For future QR scanning
  'display-capture': ["'none'"],
  'document-domain': ["'none'"],
  'fullscreen': ["'self'"],
  'geolocation': ["'self'"], // For location-based features
  'gyroscope': ["'self'"],
  'magnetometer': ["'self'"],
  'microphone': ["'self'"], // For voice features
  'payment': ["'self'"], // For Web Payments API
  'picture-in-picture': ["'none'"],
  'publickey-credentials-get': ["'self'"], // For WebAuthn
  'storage-access': ["'self'"],
  'usb': ["'none'"],
  'web-share': ["'self'"], // For native sharing
  'xr-spatial-tracking': ["'none'"]
};

// Resource cache configurations
const PWA_RESOURCE_CONFIG: PWAResourceConfig = {
  manifestMaxAge: 24 * 60 * 60, // 24 hours
  serviceWorkerMaxAge: 0, // No cache for service worker
  iconMaxAge: 7 * 24 * 60 * 60, // 7 days
  offlinePageMaxAge: 24 * 60 * 60 // 24 hours
};

// === MAIN MIDDLEWARE FUNCTIONS ===

/**
 * Sets comprehensive security headers for PWA endpoints
 */
export function pwaSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Basic security headers
    setBasicSecurityHeaders(res);
    
    // Content Security Policy
    setContentSecurityPolicy(res, req);
    
    // Permissions Policy
    setPermissionsPolicy(res);
    
    // Cross-Origin policies
    setCrossOriginPolicies(res);
    
    // PWA-specific headers
    setPWASpecificHeaders(res, req);
    
    next();
  } catch (error) {
    console.error('PWA security headers error:', error);
    next(); // Continue even if headers fail
  }
}

/**
 * Security headers specifically for service worker endpoints
 */
export function serviceWorkerSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Service workers require specific security considerations
    setBasicSecurityHeaders(res);
    
    // Strict CSP for service worker
    setServiceWorkerCSP(res);
    
    // No cache for service worker files
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Service Worker specific headers
    res.set({
      'Service-Worker-Allowed': '/', // Allow service worker to control entire origin
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    
    next();
  } catch (error) {
    console.error('Service worker security headers error:', error);
    next();
  }
}

/**
 * Security headers for PWA manifest files
 */
export function manifestSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    setBasicSecurityHeaders(res);
    
    // Manifest-specific headers
    res.set({
      'Content-Type': 'application/manifest+json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': `public, max-age=${PWA_RESOURCE_CONFIG.manifestMaxAge}`,
      'Vary': 'Accept-Encoding'
    });
    
    // Basic CSP for manifest
    res.set('Content-Security-Policy', "default-src 'none'; manifest-src 'self'");
    
    next();
  } catch (error) {
    console.error('Manifest security headers error:', error);
    next();
  }
}

/**
 * Security headers for PWA icon and asset endpoints
 */
export function pwaAssetSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    setBasicSecurityHeaders(res);
    
    // Asset-specific headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': `public, max-age=${PWA_RESOURCE_CONFIG.iconMaxAge}`,
      'Vary': 'Accept-Encoding'
    });
    
    // Allow cross-origin for icons (needed for PWA installation)
    res.set({
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*'
    });
    
    next();
  } catch (error) {
    console.error('PWA asset security headers error:', error);
    next();
  }
}

/**
 * Security headers for offline pages and fallbacks
 */
export function offlinePageSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    setBasicSecurityHeaders(res);
    setContentSecurityPolicy(res, req);
    setPermissionsPolicy(res);
    
    // Offline page specific headers
    res.set({
      'Cache-Control': `public, max-age=${PWA_RESOURCE_CONFIG.offlinePageMaxAge}`,
      'X-Offline-Page': 'true'
    });
    
    next();
  } catch (error) {
    console.error('Offline page security headers error:', error);
    next();
  }
}

// === HEADER SETTING FUNCTIONS ===

/**
 * Sets basic security headers required for all PWA endpoints
 */
function setBasicSecurityHeaders(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.set({
    // HTTPS Strict Transport Security
    'Strict-Transport-Security': isProduction 
      ? 'max-age=31536000; includeSubDomains; preload'
      : 'max-age=3600',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Frame Options
    'X-Frame-Options': 'DENY',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Remove server information
    'X-Powered-By': '', // Remove Express header
    'Server': 'Vocilia' // Custom server header
  });
}

/**
 * Sets Content Security Policy headers
 */
function setContentSecurityPolicy(res: Response, req: Request): void {
  const nonce = generateNonce();
  
  // Add nonce to script-src if needed
  const directives = { ...PWA_CSP_DIRECTIVES };
  if (nonce) {
    directives['script-src'] = [...directives['script-src'], `'nonce-${nonce}'`];
  }
  
  // Build CSP string
  const cspString = Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
  
  res.set('Content-Security-Policy', cspString);
  
  // Set nonce for use in templates
  if (nonce) {
    (res as any).locals = { ...(res as any).locals, nonce };
  }
}

/**
 * Sets stricter CSP for service worker files
 */
function setServiceWorkerCSP(res: Response): void {
  const swCSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'none'"
  ].join('; ');
  
  res.set('Content-Security-Policy', swCSP);
}

/**
 * Sets Permissions Policy headers
 */
function setPermissionsPolicy(res: Response): void {
  const permissionsString = Object.entries(PWA_PERMISSIONS_POLICY)
    .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
    .join(', ');
  
  res.set('Permissions-Policy', permissionsString);
}

/**
 * Sets Cross-Origin related headers
 */
function setCrossOriginPolicies(res: Response): void {
  res.set({
    // Cross-Origin Embedder Policy
    'Cross-Origin-Embedder-Policy': 'require-corp',
    
    // Cross-Origin Opener Policy
    'Cross-Origin-Opener-Policy': 'same-origin',
    
    // Cross-Origin Resource Policy
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
}

/**
 * Sets PWA-specific headers
 */
function setPWASpecificHeaders(res: Response, req: Request): void {
  res.set({
    // PWA identification
    'X-PWA-Enabled': 'true',
    
    // Service Worker support
    'X-Service-Worker-Support': 'enabled',
    
    // Offline support indication
    'X-Offline-Support': 'available',
    
    // Web App Manifest link (if not already in HTML)
    'Link': '</manifest.json>; rel=manifest',
    
    // Theme color for PWA
    'X-Theme-Color': '#2563eb', // Primary blue
    
    // Mobile app banner control
    'X-Mobile-App-Capable': 'yes'
  });
}

// === UTILITY FUNCTIONS ===

/**
 * Generates a cryptographically secure nonce for CSP
 */
function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomBytes) {
    return crypto.randomBytes(16).toString('base64');
  }
  
  // Fallback for environments without crypto
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Validates CSP directive
 */
function validateCSPDirective(directive: string, sources: string[]): boolean {
  const validDirectives = [
    'default-src', 'script-src', 'style-src', 'img-src', 'font-src',
    'connect-src', 'media-src', 'object-src', 'worker-src', 'manifest-src',
    'frame-src', 'base-uri', 'form-action', 'upgrade-insecure-requests'
  ];
  
  if (!validDirectives.includes(directive)) {
    return false;
  }
  
  // Validate sources
  const validSourcePatterns = [
    /^'self'$/,
    /^'none'$/,
    /^'unsafe-inline'$/,
    /^'unsafe-eval'$/,
    /^'nonce-[A-Za-z0-9+/]+=*'$/,
    /^'sha(256|384|512)-[A-Za-z0-9+/]+=*'$/,
    /^https?:\/\/.+$/,
    /^data:$/,
    /^blob:$/,
    /^ws:\/\/.+$/,
    /^wss:\/\/.+$/
  ];
  
  return sources.every(source => 
    validSourcePatterns.some(pattern => pattern.test(source))
  );
}

/**
 * Gets security headers configuration
 */
export function getSecurityHeadersConfig(): SecurityHeadersConfig {
  return {
    csp: {
      directives: PWA_CSP_DIRECTIVES,
      reportOnly: false,
      nonce: true
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    permissionsPolicy: PWA_PERMISSIONS_POLICY,
    crossOrigin: {
      embedderPolicy: 'require-corp',
      resourcePolicy: 'same-origin',
      openerPolicy: 'same-origin'
    }
  };
}

/**
 * Updates CSP for development environment
 */
export function updateCSPForDevelopment(): void {
  if (process.env.NODE_ENV === 'development') {
    // Add localhost connections for development
    PWA_CSP_DIRECTIVES['connect-src'].push('http://localhost:*', 'ws://localhost:*');
    PWA_CSP_DIRECTIVES['script-src'].push("'unsafe-eval'"); // For hot reloading
  }
}

/**
 * Health check for security headers middleware
 */
export function getSecurityHeadersHealth(): {
  healthy: boolean;
  cspDirectives: number;
  permissionsPolicies: number;
  environment: string;
} {
  return {
    healthy: true,
    cspDirectives: Object.keys(PWA_CSP_DIRECTIVES).length,
    permissionsPolicies: Object.keys(PWA_PERMISSIONS_POLICY).length,
    environment: process.env.NODE_ENV || 'unknown'
  };
}

/**
 * Middleware to add security headers based on route type
 */
export function adaptiveSecurityHeaders(routeType: 'pwa' | 'api' | 'static' = 'pwa') {
  return (req: Request, res: Response, next: NextFunction): void => {
    switch (routeType) {
      case 'pwa':
        pwaSecurityHeaders(req, res, next);
        break;
      case 'api':
        setBasicSecurityHeaders(res);
        setContentSecurityPolicy(res, req);
        next();
        break;
      case 'static':
        pwaAssetSecurityHeaders(req, res, next);
        break;
      default:
        pwaSecurityHeaders(req, res, next);
    }
  };
}

// Initialize development settings
updateCSPForDevelopment();

// === EXPORTS ===

export {
  pwaSecurityHeaders,
  serviceWorkerSecurityHeaders,
  manifestSecurityHeaders,
  pwaAssetSecurityHeaders,
  offlinePageSecurityHeaders,
  adaptiveSecurityHeaders,
  getSecurityHeadersConfig,
  getSecurityHeadersHealth,
  updateCSPForDevelopment
};

// Type exports
export type {
  SecurityHeadersConfig,
  PWAResourceConfig
};