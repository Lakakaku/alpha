import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../../packages/database/src/client/supabase';

interface AuthenticatedRequest extends Request {
  business?: {
    id: string;
    userId: string;
    storeIds: string[];
  };
}

export const aiAssistantAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Bearer token required for AI assistant access'
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user.user) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token'
      });
      return;
    }

    // Check if user has business account access
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select(`
        id,
        user_id,
        stores (
          id
        )
      `)
      .eq('user_id', user.user.id)
      .single();

    if (businessError || !businessData) {
      res.status(403).json({
        error: 'BUSINESS_ACCESS_REQUIRED',
        message: 'AI assistant access requires business account'
      });
      return;
    }

    // Check if business has active stores
    if (!businessData.stores || businessData.stores.length === 0) {
      res.status(403).json({
        error: 'NO_ACTIVE_STORES',
        message: 'AI assistant requires at least one active store'
      });
      return;
    }

    // Attach business context to request
    req.business = {
      id: businessData.id,
      userId: user.user.id,
      storeIds: businessData.stores.map((store: any) => store.id)
    };

    next();
  } catch (error) {
    console.error('AI assistant auth error:', error);
    res.status(500).json({
      error: 'AUTH_ERROR',
      message: 'Authentication system error'
    });
  }
};

// Middleware for admin-only AI endpoints
export const adminOnlyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Bearer token required for admin access'
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: user, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user.user) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token'
      });
      return;
    }

    // Check if user has admin privileges
    const { data: adminData, error: adminError } = await supabase
      .from('admin_accounts')
      .select('id, is_super_admin, is_active')
      .eq('user_id', user.user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminData) {
      res.status(403).json({
        error: 'ADMIN_ACCESS_REQUIRED',
        message: 'Admin privileges required for this operation'
      });
      return;
    }

    // Attach admin context to request
    req.business = {
      id: 'admin',
      userId: user.user.id,
      storeIds: [] // Admin has access to all stores via RLS
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      error: 'AUTH_ERROR',
      message: 'Authentication system error'
    });
  }
};