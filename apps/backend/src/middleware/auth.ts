import { Request, Response, NextFunction } from 'express';
import { createClient } from '@alpha/database';

// Extend the Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'business_account' | 'admin_account';
        business_id: string | null;
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authorization header is required',
      });
      return;
    }

    // Check for Bearer token format
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!bearerMatch) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authorization header must be in Bearer format',
      });
      return;
    }

    const token = bearerMatch[1];

    // Verify token with Supabase
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Get user profile information
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role, business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User profile not found',
      });
      return;
    }

    // Attach user information to request
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      business_id: profile.business_id,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication service error',
    });
  }
}

// Optional: Role-based authorization middleware
export function requireRole(allowedRoles: ('business_account' | 'admin_account')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions for this role',
        details: {
          required: allowedRoles,
          current: req.user.role,
        },
      });
      return;
    }

    next();
  };
}

// Optional: Business ownership authorization middleware
export function requireBusinessAccess(businessIdParam = 'businessId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
      return;
    }

    // Admin users have access to all businesses
    if (req.user.role === 'admin_account') {
      next();
      return;
    }

    // Business users can only access their own business
    const requestedBusinessId = req.params[businessIdParam];
    if (req.user.business_id !== requestedBusinessId) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this business resource',
      });
      return;
    }

    next();
  };
}