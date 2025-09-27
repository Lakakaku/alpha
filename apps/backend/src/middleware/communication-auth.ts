import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RecipientType } from '@vocilia/types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'admin' | 'customer' | 'business';
    permissions?: string[];
  };
  rateLimitKey?: string;
}

/**
 * Admin authentication middleware for communication endpoints
 */
export const adminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_MISSING_TOKEN'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS'
      });
    }

    req.user = decoded;
    req.rateLimitKey = `admin:${decoded.id}`;
    next();

  } catch (error) {
    console.error('Admin authentication failed:', error);
    return res.status(401).json({
      error: 'Invalid authentication token',
      code: 'AUTH_INVALID_TOKEN'
    });
  }
};

/**
 * Customer authentication middleware for support endpoints
 */
export const customerAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_MISSING_TOKEN'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'customer') {
      return res.status(403).json({
        error: 'Customer access required',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS'
      });
    }

    req.user = decoded;
    req.rateLimitKey = `customer:${decoded.id}`;
    next();

  } catch (error) {
    console.error('Customer authentication failed:', error);
    return res.status(401).json({
      error: 'Invalid authentication token',
      code: 'AUTH_INVALID_TOKEN'
    });
  }
};

/**
 * Business authentication middleware for support endpoints
 */
export const businessAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_MISSING_TOKEN'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || decoded.type !== 'business') {
      return res.status(403).json({
        error: 'Business access required',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS'
      });
    }

    req.user = decoded;
    req.rateLimitKey = `business:${decoded.id}`;
    next();

  } catch (error) {
    console.error('Business authentication failed:', error);
    return res.status(401).json({
      error: 'Invalid authentication token',
      code: 'AUTH_INVALID_TOKEN'
    });
  }
};

/**
 * Flexible authentication - accepts customer, business, or admin
 */
export const anyUserAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_MISSING_TOKEN'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid authentication token',
        code: 'AUTH_INVALID_TOKEN'
      });
    }

    req.user = decoded;
    req.rateLimitKey = `${decoded.type}:${decoded.id}`;
    next();

  } catch (error) {
    console.error('User authentication failed:', error);
    return res.status(401).json({
      error: 'Invalid authentication token',
      code: 'AUTH_INVALID_TOKEN'
    });
  }
};

/**
 * Webhook authentication for SMS delivery status updates
 */
export const webhookAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-twilio-signature'] as string;
    const webhookSecret = process.env.TWILIO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Twilio webhook secret not configured');
      return res.status(500).json({
        error: 'Webhook authentication not configured',
        code: 'WEBHOOK_CONFIG_ERROR'
      });
    }

    if (!signature) {
      return res.status(401).json({
        error: 'Webhook signature required',
        code: 'WEBHOOK_MISSING_SIGNATURE'
      });
    }

    // Verify Twilio webhook signature
    const isValid = verifyTwilioSignature(req, signature, webhookSecret);
    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid webhook signature',
        code: 'WEBHOOK_INVALID_SIGNATURE'
      });
    }

    req.rateLimitKey = 'webhook:twilio';
    next();

  } catch (error) {
    console.error('Webhook authentication failed:', error);
    return res.status(401).json({
      error: 'Webhook authentication failed',
      code: 'WEBHOOK_AUTH_ERROR'
    });
  }
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_MISSING_USER'
      });
    }

    // Admin users have all permissions
    if (req.user.type === 'admin') {
      return next();
    }

    // Check specific permissions
    const userPermissions = req.user.permissions || [];
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({
        error: `Permission required: ${permission}`,
        code: 'AUTH_INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Resource ownership check for support tickets
 */
export const requireResourceOwnership = (resourceType: 'ticket' | 'notification') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_MISSING_USER'
        });
      }

      // Admin users can access all resources
      if (req.user.type === 'admin') {
        return next();
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({
          error: 'Resource ID required',
          code: 'AUTH_MISSING_RESOURCE_ID'
        });
      }

      const hasAccess = await checkResourceAccess(
        req.user.id,
        req.user.type,
        resourceType,
        resourceId
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied to resource',
          code: 'AUTH_RESOURCE_ACCESS_DENIED'
        });
      }

      next();

    } catch (error) {
      console.error('Resource ownership check failed:', error);
      return res.status(500).json({
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_ERROR'
      });
    }
  };
};

/**
 * API key authentication for external integrations
 */
export const apiKeyAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'AUTH_MISSING_API_KEY'
      });
    }

    const validApiKeys = process.env.COMMUNICATION_API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'AUTH_INVALID_API_KEY'
      });
    }

    req.rateLimitKey = `api:${apiKey.substring(0, 8)}`;
    next();

  } catch (error) {
    console.error('API key authentication failed:', error);
    return res.status(401).json({
      error: 'API key authentication failed',
      code: 'AUTH_API_KEY_ERROR'
    });
  }
};

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token: string): any {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret not configured');
  }

  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify Twilio webhook signature
 */
function verifyTwilioSignature(req: Request, signature: string, secret: string): boolean {
  const crypto = require('crypto');
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  // Build payload string
  let payload = url;
  const sortedParams = Object.keys(req.body).sort();
  
  sortedParams.forEach(key => {
    payload += key + req.body[key];
  });

  // Generate expected signature
  const expectedSignature = crypto
    .createHmac('sha1', secret)
    .update(payload, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Check if user has access to specific resource
 */
async function checkResourceAccess(
  userId: string,
  userType: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  try {
    // This would typically query the database to check ownership
    // For now, return true for demo purposes
    // In production, implement actual ownership checks
    
    if (resourceType === 'ticket') {
      // Check if user owns the support ticket
      // const ticket = await SupportTicketModel.getById(resourceId);
      // return ticket && (
      //   (userType === 'customer' && ticket.customer_id === userId) ||
      //   (userType === 'business' && ticket.business_id === userId)
      // );
    }
    
    if (resourceType === 'notification') {
      // Check if user is the recipient of the notification
      // const notification = await CommunicationNotificationModel.getById(resourceId);
      // return notification && notification.recipient_id === userId;
    }
    
    return true; // Placeholder
  } catch (error) {
    console.error('Resource access check failed:', error);
    return false;
  }
}

/**
 * Optional authentication - sets user if token is valid but doesn't require it
 */
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
        req.rateLimitKey = `${decoded.type}:${decoded.id}`;
      }
    }
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

export { AuthenticatedRequest };