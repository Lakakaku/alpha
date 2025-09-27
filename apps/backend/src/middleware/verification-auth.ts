import { Request, Response, NextFunction } from 'express';
import { supabase } from '@vocilia/database';
import { z } from 'zod';

export interface VerificationAuthRequest extends Request {
  businessId?: string;
  adminId?: string;
  role?: 'admin' | 'business';
}

const verificationAuthSchema = z.object({
  headers: z.object({
    authorization: z.string().min(1, 'Authorization header is required')
  })
});

export const verificationAuth = async (
  req: VerificationAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { headers } = verificationAuthSchema.parse(req);
    const token = headers.authorization.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ 
        error: 'Authentication token required',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify token with Supabase
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user.user) {
      res.status(401).json({ 
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    // Check for admin role
    const { data: adminAccount, error: adminError } = await supabase
      .from('admin_accounts')
      .select('id, role, is_active')
      .eq('user_id', user.user.id)
      .single();

    if (!adminError && adminAccount?.is_active) {
      req.adminId = adminAccount.id;
      req.role = 'admin';
      
      // Update last activity for admin session
      await supabase
        .from('admin_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('admin_id', adminAccount.id)
        .eq('is_active', true);
        
      next();
      return;
    }

    // Check for business account
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('id, is_active')
      .eq('user_id', user.user.id)
      .single();

    if (!businessError && businessAccount?.is_active) {
      req.businessId = businessAccount.id;
      req.role = 'business';
      next();
      return;
    }

    // No valid account found
    res.status(403).json({ 
      error: 'Access denied - no valid account found',
      code: 'ACCESS_DENIED'
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Invalid request format',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    console.error('Verification auth middleware error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

export const requireAdmin = (
  req: VerificationAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.role !== 'admin') {
    res.status(403).json({ 
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
    return;
  }
  next();
};

export const requireBusiness = (
  req: VerificationAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.role !== 'business') {
    res.status(403).json({ 
      error: 'Business access required',
      code: 'BUSINESS_REQUIRED'
    });
    return;
  }
  next();
};

export const requireAdminOrBusiness = (
  req: VerificationAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.role || (req.role !== 'admin' && req.role !== 'business')) {
    res.status(403).json({ 
      error: 'Admin or business access required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }
  next();
};